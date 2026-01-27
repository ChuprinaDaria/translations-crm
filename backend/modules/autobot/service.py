from datetime import datetime, time, date
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from uuid import UUID, uuid4
import pytz

from .models import AutobotSettings, AutobotHoliday, AutobotLog
from .schemas import AutobotSettingsCreate, AutobotSettingsUpdate, HolidayCreate
from ..crm.models import Client, Order, ClientSource, OrderStatus, Office
from ..communications.models import Message


class AutobotService:
    """Сервіс для роботи автобота"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_settings(self, office_id: int) -> Optional[AutobotSettings]:
        """Отримати налаштування бота для офісу"""
        return self.db.query(AutobotSettings).filter(
            AutobotSettings.office_id == office_id
        ).first()
    
    def create_settings(self, settings_data: AutobotSettingsCreate) -> AutobotSettings:
        """Створити налаштування бота"""
        # Перевірити чи існує офіс
        office = self.db.query(Office).filter(Office.id == settings_data.office_id).first()
        if not office:
            raise ValueError(f"Office with id {settings_data.office_id} does not exist")
        
        # Конвертуємо WorkingHours в окремі поля
        db_settings = AutobotSettings(
            office_id=settings_data.office_id,
            enabled=settings_data.enabled,
            auto_reply_message=settings_data.auto_reply_message,
            auto_create_client=settings_data.auto_create_client,
            auto_create_order=settings_data.auto_create_order,
            auto_save_files=settings_data.auto_save_files,
        )
        
        # Встановлюємо робочі години для кожного дня
        day_mapping = {
            'monday': settings_data.monday,
            'tuesday': settings_data.tuesday,
            'wednesday': settings_data.wednesday,
            'thursday': settings_data.thursday,
            'friday': settings_data.friday,
            'saturday': settings_data.saturday,
            'sunday': settings_data.sunday,
        }
        
        for day_name, working_hours in day_mapping.items():
            if working_hours:
                setattr(db_settings, f"{day_name}_start", working_hours.start)
                setattr(db_settings, f"{day_name}_end", working_hours.end)
        
        self.db.add(db_settings)
        self.db.commit()
        self.db.refresh(db_settings)
        return db_settings
    
    def update_settings(
        self, 
        office_id: int, 
        settings_data: AutobotSettingsUpdate
    ) -> Optional[AutobotSettings]:
        """Оновити налаштування бота"""
        db_settings = self.get_settings(office_id)
        if not db_settings:
            return None
        
        # Оновлюємо прості поля
        if settings_data.enabled is not None:
            db_settings.enabled = settings_data.enabled
        if settings_data.auto_reply_message is not None:
            db_settings.auto_reply_message = settings_data.auto_reply_message
        if settings_data.auto_create_client is not None:
            db_settings.auto_create_client = settings_data.auto_create_client
        if settings_data.auto_create_order is not None:
            db_settings.auto_create_order = settings_data.auto_create_order
        if settings_data.auto_save_files is not None:
            db_settings.auto_save_files = settings_data.auto_save_files
        
        # Оновлюємо робочі години
        day_mapping = {
            'monday': settings_data.monday,
            'tuesday': settings_data.tuesday,
            'wednesday': settings_data.wednesday,
            'thursday': settings_data.thursday,
            'friday': settings_data.friday,
            'saturday': settings_data.saturday,
            'sunday': settings_data.sunday,
        }
        
        for day_name, working_hours in day_mapping.items():
            if working_hours is not None:
                setattr(db_settings, f"{day_name}_start", working_hours.start)
                setattr(db_settings, f"{day_name}_end", working_hours.end)
        
        self.db.commit()
        self.db.refresh(db_settings)
        return db_settings
    
    def is_working_hours(
        self, 
        office_id: int, 
        check_time: Optional[datetime] = None
    ) -> Tuple[bool, str]:
        """
        Перевірити чи зараз робочі години
        
        Returns:
            Tuple[bool, str]: (чи робочі години, причина)
        """
        settings = self.get_settings(office_id)
        if not settings or not settings.enabled:
            return True, "Бот вимкнено"
        
        # Використовуємо поточний час або переданий
        now = check_time or datetime.now(pytz.timezone('Europe/Warsaw'))
        current_date = now.date()
        current_time = now.time()
        weekday = now.weekday()  # 0 = Monday
        
        # Перевірка на свято
        if self._is_holiday(settings.id, current_date):
            return False, "Сьогодні неробочий день (свято)"
        
        # Отримати робочі години для поточного дня
        day_names = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        day_name = day_names[weekday]
        
        start_time = getattr(settings, f"{day_name}_start")
        end_time = getattr(settings, f"{day_name}_end")
        
        # Якщо не задано робочі години для цього дня
        if not start_time or not end_time:
            return False, "Сьогодні неробочий день"
        
        # Перевірка часу
        if start_time <= current_time <= end_time:
            return True, "Робочий час"
        
        return False, "Зараз неробочий час"
    
    def _is_holiday(self, settings_id: int, check_date: date) -> bool:
        """Перевірити чи є дата святом"""
        # Точна дата
        exact_match = self.db.query(AutobotHoliday).filter(
            and_(
                AutobotHoliday.settings_id == settings_id,
                AutobotHoliday.date == check_date
            )
        ).first()
        
        if exact_match:
            return True
        
        # Щорічне свято (день і місяць співпадають)
        # Отримуємо всі щорічні свята і перевіряємо в Python
        recurring_holidays = self.db.query(AutobotHoliday).filter(
            and_(
                AutobotHoliday.settings_id == settings_id,
                AutobotHoliday.is_recurring == True
            )
        ).all()
        
        for holiday in recurring_holidays:
            if holiday.date.month == check_date.month and holiday.date.day == check_date.day:
                return True
        
        return False
    
    def add_holiday(
        self, 
        settings_id: int, 
        holiday: HolidayCreate
    ) -> AutobotHoliday:
        """Додати свято"""
        db_holiday = AutobotHoliday(
            settings_id=settings_id,
            date=holiday.date,
            name=holiday.name,
            is_recurring=holiday.is_recurring
        )
        self.db.add(db_holiday)
        self.db.commit()
        self.db.refresh(db_holiday)
        return db_holiday
    
    def remove_holiday(self, holiday_id: int) -> bool:
        """Видалити свято"""
        holiday = self.db.query(AutobotHoliday).filter(
            AutobotHoliday.id == holiday_id
        ).first()
        
        if not holiday:
            return False
        
        self.db.delete(holiday)
        self.db.commit()
        return True
    
    def get_holidays(self, settings_id: int) -> List[AutobotHoliday]:
        """Отримати всі свята"""
        return self.db.query(AutobotHoliday).filter(
            AutobotHoliday.settings_id == settings_id
        ).order_by(AutobotHoliday.date).all()
    
    async def process_incoming_message(
        self,
        office_id: int,
        message: Message,
        sender_info: dict
    ) -> dict:
        """
        Обробити вхідне повідомлення
        
        Args:
            office_id: ID офісу
            message: Об'єкт повідомлення
            sender_info: Інформація про відправника (email, phone, name)
        
        Returns:
            dict: Результат обробки
        """
        result = {
            "auto_reply_sent": False,
            "client_created": False,
            "order_created": False,
            "files_saved": 0,
            "client_id": None,
            "order_id": None
        }
        
        settings = self.get_settings(office_id)
        if not settings or not settings.enabled:
            return result
        
        # Перевірка робочих годин
        is_working, reason = self.is_working_hours(office_id)
        
        if is_working:
            # Робочий час - нічого не робимо
            return result
        
        # Неробочий час - активуємо бота
        
        # 1. Надіслати автовідповідь
        if settings.auto_reply_message:
            try:
                # TODO: Інтеграція з communication модулем для відправки
                await self._send_auto_reply(message, settings.auto_reply_message)
                result["auto_reply_sent"] = True
                
                self._log_action(
                    settings_id=settings.id,
                    office_id=office_id,
                    message_id=str(message.id),
                    action_taken="auto_reply",
                    success=True
                )
            except Exception as e:
                self._log_action(
                    settings_id=settings.id,
                    office_id=office_id,
                    message_id=str(message.id),
                    action_taken="auto_reply",
                    success=False,
                    error_message=str(e)
                )
        
        # 2. Створити клієнта (якщо не існує)
        if settings.auto_create_client:
            client = self._find_or_create_client(
                office_id=office_id,
                sender_info=sender_info
            )
            if client:
                result["client_created"] = True
                result["client_id"] = str(client.id)
                
                self._log_action(
                    settings_id=settings.id,
                    office_id=office_id,
                    message_id=str(message.id),
                    client_id=client.id,
                    action_taken="client_created",
                    success=True
                )
        
        # 3. Створити замовлення
        if settings.auto_create_order and result["client_id"]:
            order = self._create_order(
                office_id=office_id,
                client_id=UUID(result["client_id"]),
                message=message
            )
            if order:
                result["order_created"] = True
                result["order_id"] = str(order.id)
                
                self._log_action(
                    settings_id=settings.id,
                    office_id=office_id,
                    message_id=str(message.id),
                    client_id=UUID(result["client_id"]),
                    order_id=order.id,
                    action_taken="order_created",
                    success=True
                )
        
        # 4. Зберегти файли
        if settings.auto_save_files and result["order_id"] and message.attachments:
            files_saved = self._save_attachments(
                order_id=UUID(result["order_id"]),
                attachments=message.attachments
            )
            result["files_saved"] = files_saved
            
            if files_saved > 0:
                self._log_action(
                    settings_id=settings.id,
                    office_id=office_id,
                    message_id=str(message.id),
                    order_id=UUID(result["order_id"]),
                    action_taken="file_saved",
                    success=True,
                    meta_data={"files_count": files_saved}
                )
        
        return result
    
    def _find_or_create_client(
        self, 
        office_id: int, 
        sender_info: dict
    ) -> Optional[Client]:
        """Знайти або створити клієнта"""
        # Пошук існуючого клієнта
        query = self.db.query(Client)
        
        if sender_info.get('email'):
            client = query.filter(Client.email == sender_info['email']).first()
            if client:
                return client
        
        if sender_info.get('phone'):
            client = query.filter(Client.phone == sender_info['phone']).first()
            if client:
                return client
        
        # Створити нового клієнта
        new_client = Client(
            full_name=sender_info.get('name', 'Новий клієнт'),
            email=sender_info.get('email'),
            phone=sender_info.get('phone', '000000000'),
            source=ClientSource.MANUAL  # Можна змінити на ClientSource.AUTOBOT якщо додати в enum
        )
        
        self.db.add(new_client)
        self.db.commit()
        self.db.refresh(new_client)
        
        return new_client
    
    def _create_order(
        self,
        office_id: int,
        client_id: UUID,
        message: Message
    ) -> Optional[Order]:
        """Створити замовлення"""
        # Знайти менеджера за замовчуванням (перший активний менеджер або адмін)
        from ..auth.models import User
        manager = self.db.query(User).filter(
            User.is_active == True
        ).first()
        
        if not manager:
            # Якщо немає менеджера, не можемо створити замовлення
            return None
        
        # Генерувати номер замовлення
        order_number = f"N/{datetime.now().strftime('%d/%m/%y')}/autobot/{str(message.id)[:8]}"
        
        # Перевірити унікальність
        existing = self.db.query(Order).filter(Order.order_number == order_number).first()
        if existing:
            # Додати timestamp для унікальності
            order_number = f"{order_number}-{int(datetime.now().timestamp())}"
        
        new_order = Order(
            client_id=client_id,
            manager_id=manager.id,
            order_number=order_number,
            description=f"Автоматично створено з повідомлення: {message.content[:100] if message.content else 'Без тексту'}",
            status=OrderStatus.DO_WYKONANIA,
            office_id=office_id
        )
        
        self.db.add(new_order)
        self.db.commit()
        self.db.refresh(new_order)
        
        return new_order
    
    def _save_attachments(
        self,
        order_id: UUID,
        attachments: List[dict]
    ) -> int:
        """Зберегти вкладення до замовлення"""
        # TODO: Імплементувати збереження файлів
        # Це буде інтеграція з файловою системою/S3
        saved_count = 0
        
        for attachment in attachments:
            try:
                # Логіка збереження файлу
                # file_url = save_to_storage(attachment)
                # link_to_order(order_id, file_url)
                saved_count += 1
            except Exception as e:
                print(f"Error saving attachment: {e}")
        
        return saved_count
    
    async def _send_auto_reply(self, message: Message, reply_text: str):
        """Надіслати автоматичну відповідь"""
        # TODO: Інтеграція з communication модулем
        # Потрібно створити нове повідомлення з direction=OUTBOUND
        pass
    
    def _log_action(
        self,
        settings_id: int,
        office_id: int,
        message_id: str,
        action_taken: str,
        success: bool,
        client_id: Optional[UUID] = None,
        order_id: Optional[UUID] = None,
        error_message: Optional[str] = None,
        meta_data: Optional[dict] = None
    ):
        """Записати лог дії бота"""
        log_entry = AutobotLog(
            settings_id=settings_id,
            office_id=office_id,
            message_id=message_id,
            client_id=client_id,
            order_id=order_id,
            action_taken=action_taken,
            success=success,
            error_message=error_message,
            meta_data=meta_data
        )
        
        self.db.add(log_entry)
        self.db.commit()

