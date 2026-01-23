from sqlalchemy.orm import Session, selectinload
import re
from datetime import datetime

import models as models
import schema as schemas


def parse_weight_to_float(weight_str: str | float | None) -> float:
    """
    Парсить вагу з формату "150/75" або числа.
    Для обчислень беремо перше число (основну вагу).
    """
    if weight_str is None:
        return 0.0
    
    if isinstance(weight_str, (int, float)):
        return float(weight_str)
    
    if isinstance(weight_str, str):
        # Якщо є слеш, беремо перше число
        if '/' in weight_str:
            match = re.search(r'(\d+(?:\.\d+)?)', weight_str)
            if match:
                return float(match.group(1))
        else:
            # Спробуємо конвертувати весь рядок в число
            try:
                return float(weight_str)
            except ValueError:
                # Якщо не вдалося, спробуємо знайти перше число
                match = re.search(r'(\d+(?:\.\d+)?)', weight_str)
                if match:
                    return float(match.group(1))
    
    return 0.0

def get_items(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Item).offset(skip).limit(limit).all()


def get_item(db: Session, item_id: int):
    return db.query(models.Item).filter(models.Item.id == item_id).first()


def create_item(db: Session, item: schemas.ItemUpdate):
    db_item = models.Item(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def update_item(db: Session, item_id: int, item_data: schemas.ItemUpdate):
    db_item = get_item(db, item_id)
    if not db_item:
        return None

    # Використовуємо model_dump з exclude_none=True, щоб не оновлювати поля зі значенням None
    update_data = item_data.model_dump(exclude_none=True, exclude_unset=True)
    
    print(f"[CRUD] update_item: ID={item_id}, update_data={update_data}")

    for key, value in update_data.items():
        old_value = getattr(db_item, key, None)
        setattr(db_item, key, value)
        print(f"[CRUD] Updated {key}: {old_value} -> {value}")

    db.commit()
    db.refresh(db_item)
    
    print(f"[CRUD] Item after update: id={db_item.id}, name={db_item.name}, price={db_item.price}, subcategory_id={db_item.subcategory_id}")
    
    return db_item


def delete_item(db: Session, item_id: int):
    db_item = get_item(db, item_id)
    if not db_item:
        return None

    # Перед видаленням item, встановлюємо item_id = None для всіх Recipe, які посилаються на цей item
    db.query(models.Recipe).filter(models.Recipe.item_id == item_id).update({"item_id": None})
    
    # KPItem має nullable item_id, тому там не потрібно нічого робити
    # Але можна перевірити, чи немає активних KP з цим item
    # (це не блокує видалення, але можна додати перевірку якщо потрібно)

    db.delete(db_item)
    db.commit()
    return True


# Category CRUD
def create_category(db: Session, name: str):
    db_category = models.Category(name=name)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

def get_categories(db: Session):
    return db.query(models.Category).all()

def delete_category(db: Session, category_id: int):
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        return False
    db.delete(category)
    db.commit()
    return True


# Subcategory CRUD
def create_subcategory(db: Session, name: str, category_id: int):
    db_subcategory = models.Subcategory(name=name, category_id=category_id)
    db.add(db_subcategory)
    db.commit()
    db.refresh(db_subcategory)
    return db_subcategory

def get_subcategories(db: Session, category_id: int = None):
    query = db.query(models.Subcategory)
    # Захист від битих рядків: інколи в БД є підкатегорії з category_id = NULL,
    # що ламає ResponseModel (schema.Subcategory очікує int).
    query = query.filter(models.Subcategory.category_id.isnot(None))
    if category_id:
        query = query.filter(models.Subcategory.category_id == category_id)
    return query.all()

def delete_subcategory(db: Session, subcategory_id: int):
    subcategory = db.query(models.Subcategory).filter(models.Subcategory.id == subcategory_id).first()
    if not subcategory:
        return False
    db.delete(subcategory)
    db.commit()
    return True


def delete_categories(db: Session, category_ids: list[int]):
    """Видаляє кілька категорій одразу."""
    categories = db.query(models.Category).filter(models.Category.id.in_(category_ids)).all()
    if not categories:
        return False
    for category in categories:
        db.delete(category)
    db.commit()
    return True


def delete_subcategories(db: Session, subcategory_ids: list[int]):
    """Видаляє кілька підкатегорій одразу."""
    subcategories = db.query(models.Subcategory).filter(models.Subcategory.id.in_(subcategory_ids)).all()
    if not subcategories:
        return False
    for subcategory in subcategories:
        db.delete(subcategory)
    db.commit()
    return True


# KP CRUD
def delete_kp(db: Session, kp_id: int):
    db_item = get_kp(db, kp_id)
    if not db_item:
        return None

    db.delete(db_item)
    db.commit()
    return True


def create_kp(db: Session, kp_in: schemas.KPCreate, created_by_id: int | None = None):
    import crud_user

    price_per_person = kp_in.price_per_person
    print(f"Price per person: {price_per_person}")
    
    if not price_per_person and kp_in.people_count and kp_in.people_count > 0:
        price_per_person = kp_in.total_price / kp_in.people_count

    # Отримуємо дані менеджера (координатора) з залогіненого користувача
    coordinator_name = None
    coordinator_phone = None
    if created_by_id:
        user = crud_user.get_user_by_id(db, created_by_id)
        if user:
            # Формуємо ім'я з first_name та last_name
            name_parts = []
            if user.first_name:
                name_parts.append(user.first_name)
            if user.last_name:
                name_parts.append(user.last_name)
            if name_parts:
                coordinator_name = " ".join(name_parts)
            else:
                # Якщо немає first_name/last_name, використовуємо email
                coordinator_name = user.email or None
            # Телефон менеджера (поки що немає поля phone в User, тому залишаємо None)
            # coordinator_phone = getattr(user, "phone", None)  # Поки що не використовуємо
            coordinator_phone = None
    
    # Якщо дані менеджера не знайдені, використовуємо дані з kp_in (fallback)
    if not coordinator_name:
        coordinator_name = kp_in.coordinator_name
    if not coordinator_phone:
        coordinator_phone = kp_in.coordinator_phone

    kp = models.KP(
        title=kp_in.title,
        people_count=kp_in.people_count,
        total_price=kp_in.total_price,
        price_per_person=price_per_person,
        template_id=kp_in.template_id,
        # Загальні дані про клієнта та захід
        client_id=getattr(kp_in, "client_id", None),
        client_name=kp_in.client_name,
        event_format=kp_in.event_format,
        event_group=kp_in.event_group,
        event_date=kp_in.event_date,
        event_location=kp_in.event_location,
        event_time=kp_in.event_time,
        coordinator_name=coordinator_name,
        coordinator_phone=coordinator_phone,
        client_email=kp_in.client_email,
        client_phone=kp_in.client_phone,
        # Фінансові дані
        menu_total=getattr(kp_in, "menu_total", None),
        equipment_total=kp_in.equipment_total,
        service_total=kp_in.service_total,
        transport_total=getattr(kp_in, "transport_total", None),
        transport_equipment_total=getattr(kp_in, "transport_equipment_total", None),
        transport_personnel_total=getattr(kp_in, "transport_personnel_total", None),
        total_amount=getattr(kp_in, "total_amount", None),
        final_amount=getattr(kp_in, "final_amount", None),
        created_by_id=created_by_id,
        status=kp_in.status or "in_progress",
        # Знижки (стара система - deprecated)
        discount_id=getattr(kp_in, "discount_id", None),
        cashback_id=getattr(kp_in, "cashback_id", None),
        use_cashback=getattr(kp_in, "use_cashback", False),
        discount_amount=getattr(kp_in, "discount_amount", None),
        cashback_amount=getattr(kp_in, "cashback_amount", None),
        discount_include_menu=getattr(kp_in, "discount_include_menu", True),
        discount_include_equipment=getattr(kp_in, "discount_include_equipment", False),
        discount_include_service=getattr(kp_in, "discount_include_service", False),
        discount_menu_id=getattr(kp_in, "discount_menu_id", None),
        discount_equipment_id=getattr(kp_in, "discount_equipment_id", None),
        discount_service_id=getattr(kp_in, "discount_service_id", None),
        discount_equipment_subcategories=getattr(kp_in, "discount_equipment_subcategories", None),
        # Знижки (нова система)
        discount_type=getattr(kp_in, "discount_type", None),
        discount_value=getattr(kp_in, "discount_value", None),
        discount_reason=getattr(kp_in, "discount_reason", None),
        # Кешбек (нова система)
        cashback_earned=getattr(kp_in, "cashback_earned", None),
        cashback_used=getattr(kp_in, "cashback_used", None),
        cashback_rate_applied=getattr(kp_in, "cashback_rate_applied", None),
        # Умови бронювання та фото галереї
        booking_terms=getattr(kp_in, "booking_terms", None),
        gallery_photos=getattr(kp_in, "gallery_photos", None),
    )

    db.add(kp)
    db.flush()  # get kp.id

    # Створюємо формати заходу (KPEventFormat), якщо вони передані
    event_format_id_map: dict[int, int] = {}
    if getattr(kp_in, "event_formats", None):
        for idx, ef_in in enumerate(kp_in.event_formats or []):
            db_event_format = models.KPEventFormat(
                kp_id=kp.id,
                name=ef_in.name,
                event_time=ef_in.event_time,
                people_count=ef_in.people_count,
                order_index=ef_in.order_index if ef_in.order_index is not None else idx,
            )
            db.add(db_event_format)
            db.flush()
            # Використовуємо індекс у списку як ключ для подальшого мапінгу елементів меню
            event_format_id_map[idx] = db_event_format.id

    # validate item ids and create KPItem rows
    item_ids = [it.item_id for it in kp_in.items]
    total_weight_grams = 0.0
    
    # Обробляємо items з item_id (страви з меню)
    item_ids = [it.item_id for it in kp_in.items if it.item_id is not None]
    if item_ids:
        existing_items = {i.id: i for i in db.query(models.Item).filter(models.Item.id.in_(item_ids)).all()}
        for it in kp_in.items:
            if it.item_id is None:
                continue  # Custom items обробимо окремо
            if it.item_id not in existing_items:
                raise ValueError(f"Item id {it.item_id} not found")
            
            item = existing_items[it.item_id]
            # Розраховуємо вагу в грамах
            if item.weight:
                item_weight = item.weight
                unit = (item.unit or 'кг').lower()
                # Конвертуємо в грами
                if unit == 'кг':
                    item_weight_grams = item_weight * 1000
                elif unit == 'г':
                    item_weight_grams = item_weight
                elif unit == 'л' or unit == 'мл':
                    # Для рідини приблизно 1л = 1000г
                    if unit == 'л':
                        item_weight_grams = item_weight * 1000
                    else:
                        item_weight_grams = item_weight
                else:
                    # Для інших одиниць (шт тощо) вважаємо вагу 0
                    item_weight_grams = 0
                
                # Множимо на кількість
                total_weight_grams += item_weight_grams * it.quantity
            
            # Визначаємо формат заходу для цього елементу (якщо задано event_format_id)
            db_event_format_id = None
            if getattr(it, "event_format_id", None) is not None:
                idx = it.event_format_id
                if isinstance(idx, int):
                    db_event_format_id = event_format_id_map.get(idx)

            kp_item = models.KPItem(
                kp_id=kp.id,
                item_id=it.item_id,
                quantity=it.quantity,
                event_format_id=db_event_format_id,
                is_alternative=getattr(it, "is_alternative", False) or False,
                alternative_group_id=getattr(it, "alternative_group_id", None),
            )
            db.add(kp_item)
    
    # Обробляємо custom items (equipment/service без item_id)
    # Розподіляємо їх між equipment та service на основі equipment_total та service_total
    custom_items = [it for it in kp_in.items if it.item_id is None and it.name]
    equipment_total_expected = float(getattr(kp_in, "equipment_total", None) or 0)
    service_total_expected = float(getattr(kp_in, "service_total", None) or 0)
    
    # Розраховуємо суми custom items
    custom_items_total = sum((it.price or 0) * it.quantity for it in custom_items)
    
    # Розподіляємо custom items між equipment та service
    # Якщо equipment_total > 0, то перші custom items - це equipment
    equipment_items_added = 0.0
    for it in custom_items:
        item_total = (it.price or 0) * it.quantity
        # Якщо ще не досягли equipment_total, то це equipment
        if equipment_items_added + item_total <= equipment_total_expected + 0.01:  # Допуск на округлення
            equipment_items_added += item_total
        # Інакше це service (або якщо equipment_total = 0)
        
        kp_item = models.KPItem(
            kp_id=kp.id,
            item_id=None,  # Custom item
            quantity=it.quantity,
            name=it.name,
            price=it.price,
            weight=it.weight,
            unit=it.unit,
            event_format_id=None,  # Custom items не прив'язані до форматів
        )
        db.add(kp_item)
    
    # Розраховуємо вагу на 1 гостя
    weight_per_person = None
    if total_weight_grams > 0 and kp_in.people_count and kp_in.people_count > 0:
        weight_per_person = total_weight_grams / kp_in.people_count
    
    # Оновлюємо вагу в KP (якщо не передано явно)
    if kp_in.total_weight is None:
        kp.total_weight = total_weight_grams if total_weight_grams > 0 else None
    else:
        kp.total_weight = kp_in.total_weight
    
    if kp_in.weight_per_person is None:
        kp.weight_per_person = weight_per_person
    else:
        kp.weight_per_person = kp_in.weight_per_person

    db.commit()
    db.refresh(kp)
    
    # Автоматично оновлюємо клієнта з даними про знижки та кешбек
    upsert_client_from_kp(db, kp)
    
    # eager load items+item for immediate use
    return (
        db.query(models.KP)
        .options(selectinload(models.KP.items).selectinload(models.KPItem.item))
        .filter(models.KP.id == kp.id)
        .first()
    )

def get_kp(db: Session, kp_id: int):
    return (
        db.query(models.KP)
        .options(
            selectinload(models.KP.items).selectinload(models.KPItem.item),
            selectinload(models.KP.event_formats).selectinload(models.KPEventFormat.items),
            selectinload(models.KP.created_by),
        )
        .filter(models.KP.id == kp_id)
        .first()
    )


def update_kp(db: Session, kp_id: int, kp_in: schemas.KPCreate):
    """Оновлення існуючого КП"""
    kp = db.query(models.KP).filter(models.KP.id == kp_id).first()
    if not kp:
        return None
    
    # Оновлюємо основні поля
    kp.title = kp_in.title
    kp.people_count = kp_in.people_count
    kp.total_price = kp_in.total_price
    kp.price_per_person = kp_in.price_per_person or (kp_in.total_price / kp_in.people_count if kp_in.people_count > 0 else None)
    kp.template_id = kp_in.template_id
    kp.client_name = kp_in.client_name
    kp.event_format = kp_in.event_format
    kp.event_group = kp_in.event_group
    kp.event_date = kp_in.event_date
    kp.event_location = kp_in.event_location
    kp.event_time = kp_in.event_time
    # Оновлюємо coordinator_name та coordinator_phone тільки якщо вони передані явно
    # Інакше залишаємо поточні значення (які були встановлені при створенні з даних менеджера)
    if kp_in.coordinator_name is not None:
        kp.coordinator_name = kp_in.coordinator_name
    if kp_in.coordinator_phone is not None:
        kp.coordinator_phone = kp_in.coordinator_phone
    kp.client_email = kp_in.client_email
    kp.client_phone = kp_in.client_phone
    
    # Фінансові дані - НЕ перезаписуємо якщо None (зберігаємо попередні значення)
    if kp_in.equipment_total is not None:
        kp.equipment_total = kp_in.equipment_total
    if kp_in.service_total is not None:
        kp.service_total = kp_in.service_total
    if getattr(kp_in, "transport_total", None) is not None:
        kp.transport_total = kp_in.transport_total
    if getattr(kp_in, "menu_total", None) is not None:
        kp.menu_total = kp_in.menu_total
    if getattr(kp_in, "total_amount", None) is not None:
        kp.total_amount = kp_in.total_amount
    if getattr(kp_in, "final_amount", None) is not None:
        kp.final_amount = kp_in.final_amount
    
    # Статус - оновлюємо тільки якщо передано
    if getattr(kp_in, "status", None):
        kp.status = kp_in.status
    
    # Клієнт
    if getattr(kp_in, "client_id", None) is not None:
        kp.client_id = kp_in.client_id
    
    # Знижки та кешбек (стара система)
    kp.discount_id = getattr(kp_in, "discount_id", None)
    kp.cashback_id = getattr(kp_in, "cashback_id", None)
    kp.use_cashback = getattr(kp_in, "use_cashback", False)
    kp.discount_amount = getattr(kp_in, "discount_amount", None)
    kp.cashback_amount = getattr(kp_in, "cashback_amount", None)
    kp.discount_include_menu = getattr(kp_in, "discount_include_menu", True)  # Deprecated
    kp.discount_include_equipment = getattr(kp_in, "discount_include_equipment", False)  # Deprecated
    kp.discount_include_service = getattr(kp_in, "discount_include_service", False)  # Deprecated
    kp.discount_menu_id = getattr(kp_in, "discount_menu_id", None)
    kp.discount_equipment_id = getattr(kp_in, "discount_equipment_id", None)
    kp.discount_service_id = getattr(kp_in, "discount_service_id", None)
    kp.discount_equipment_subcategories = getattr(kp_in, "discount_equipment_subcategories", None)
    
    # Знижки та кешбек (нова система)
    if getattr(kp_in, "discount_type", None) is not None:
        kp.discount_type = kp_in.discount_type
    if getattr(kp_in, "discount_value", None) is not None:
        kp.discount_value = kp_in.discount_value
    if getattr(kp_in, "discount_reason", None) is not None:
        kp.discount_reason = kp_in.discount_reason
    if getattr(kp_in, "cashback_earned", None) is not None:
        kp.cashback_earned = kp_in.cashback_earned
    if getattr(kp_in, "cashback_used", None) is not None:
        kp.cashback_used = kp_in.cashback_used
    if getattr(kp_in, "cashback_rate_applied", None) is not None:
        kp.cashback_rate_applied = kp_in.cashback_rate_applied
    
    # Умови бронювання та фото галереї - оновлюємо тільки якщо передано (не None)
    if getattr(kp_in, "booking_terms", None) is not None:
        kp.booking_terms = kp_in.booking_terms
    if getattr(kp_in, "gallery_photos", None) is not None:
        kp.gallery_photos = kp_in.gallery_photos
    
    # Спочатку видаляємо старі формати та позиції
    db.query(models.KPItem).filter(models.KPItem.kp_id == kp_id).delete()
    db.query(models.KPEventFormat).filter(models.KPEventFormat.kp_id == kp_id).delete()
    
    # Створюємо нові формати заходу
    event_format_id_map: dict[int, int] = {}
    if getattr(kp_in, "event_formats", None):
        for idx, ef_in in enumerate(kp_in.event_formats or []):
            db_event_format = models.KPEventFormat(
                kp_id=kp.id,
                name=ef_in.name,
                event_time=ef_in.event_time,
                people_count=ef_in.people_count,
                order_index=ef_in.order_index if ef_in.order_index is not None else idx,
            )
            db.add(db_event_format)
            db.flush()
            event_format_id_map[idx] = db_event_format.id
    
    # Додаємо нові позиції
    # Обробляємо items з item_id (страви з меню)
    item_ids = [it.item_id for it in kp_in.items if it.item_id is not None]
    total_weight_grams = 0.0
    
    if item_ids:
        existing_items = {i.id: i for i in db.query(models.Item).filter(models.Item.id.in_(item_ids)).all()}
        for it in kp_in.items:
            if it.item_id is None:
                continue  # Custom items обробимо окремо
            if it.item_id not in existing_items:
                raise ValueError(f"Item id {it.item_id} not found")
            
            item = existing_items[it.item_id]
            # Розраховуємо вагу в грамах
            if item.weight:
                item_weight = parse_weight_to_float(item.weight)
                unit = (item.unit or 'кг').lower()
                # Конвертуємо в грами
                if unit == 'кг':
                    item_weight_grams = item_weight * 1000
                elif unit == 'г':
                    item_weight_grams = item_weight
                elif unit == 'л' or unit == 'мл':
                    # Для рідини приблизно 1л = 1000г
                    if unit == 'л':
                        item_weight_grams = item_weight * 1000
                    else:
                        item_weight_grams = item_weight
                else:
                    # Для інших одиниць (шт тощо) вважаємо вагу 0
                    item_weight_grams = 0
                
                # Множимо на кількість
                total_weight_grams += item_weight_grams * it.quantity
            
            db_event_format_id = None
            if getattr(it, "event_format_id", None) is not None:
                idx = it.event_format_id
                if isinstance(idx, int):
                    db_event_format_id = event_format_id_map.get(idx)

            kp_item = models.KPItem(
                kp_id=kp.id,
                item_id=it.item_id,
                quantity=it.quantity,
                event_format_id=db_event_format_id,
                is_alternative=getattr(it, "is_alternative", False) or False,
                alternative_group_id=getattr(it, "alternative_group_id", None),
            )
            db.add(kp_item)
    
    # Обробляємо custom items (equipment/service без item_id)
    custom_items = [it for it in kp_in.items if it.item_id is None and it.name]
    equipment_total_expected = float(getattr(kp_in, "equipment_total", None) or 0)
    service_total_expected = float(getattr(kp_in, "service_total", None) or 0)
    
    # Розраховуємо суми custom items
    custom_items_total = sum((it.price or 0) * it.quantity for it in custom_items)
    
    # Розподіляємо custom items між equipment та service
    equipment_items_added = 0.0
    for it in custom_items:
        item_total = (it.price or 0) * it.quantity
        # Якщо ще не досягли equipment_total, то це equipment
        if equipment_items_added + item_total <= equipment_total_expected + 0.01:  # Допуск на округлення
            equipment_items_added += item_total
        # Інакше це service (або якщо equipment_total = 0)
        
        kp_item = models.KPItem(
            kp_id=kp.id,
            item_id=None,  # Custom item
            quantity=it.quantity,
            name=it.name,
            price=it.price,
            weight=it.weight,
            unit=it.unit,
            event_format_id=None,  # Custom items не прив'язані до форматів
        )
        db.add(kp_item)
    
    # Розраховуємо вагу на 1 гостя
    weight_per_person = None
    if total_weight_grams > 0 and kp_in.people_count and kp_in.people_count > 0:
        weight_per_person = total_weight_grams / kp_in.people_count
    
    # Оновлюємо вагу в KP (якщо не передано явно)
    if kp_in.total_weight is None:
        kp.total_weight = total_weight_grams if total_weight_grams > 0 else None
    else:
        kp.total_weight = kp_in.total_weight
    
    if kp_in.weight_per_person is None:
        kp.weight_per_person = weight_per_person
    else:
        kp.weight_per_person = kp_in.weight_per_person
    
    db.commit()
    
    # Автоматично оновлюємо клієнта з даними про знижки та кешбек
    # ВАЖЛИВО: upsert_client_from_kp викликає db.commit(), тому потрібно перезавантажити KP
    upsert_client_from_kp(db, kp)
    
    # Перезавантажуємо KP з усіма необхідними зв'язками після commit в upsert_client_from_kp
    updated_kp = (
        db.query(models.KP)
        .options(
            selectinload(models.KP.items)
                .selectinload(models.KPItem.item)
                .selectinload(models.Item.subcategory)
                .selectinload(models.Subcategory.category),
            selectinload(models.KP.items).selectinload(models.KPItem.event_format),
            selectinload(models.KP.event_formats),
            selectinload(models.KP.created_by),
            selectinload(models.KP.client),
        )
        .filter(models.KP.id == kp_id)
        .first()
    )
    
    if not updated_kp:
        # Якщо не знайдено, спробуємо знайти без eager loading
        updated_kp = db.query(models.KP).filter(models.KP.id == kp_id).first()
        if not updated_kp:
            raise ValueError(f"KP {kp_id} not found after update")
    
    return updated_kp


def get_all_kps(db: Session):
    # Повертаємо КП разом з позиціями та менеджером, щоб фронтенд міг показувати деталізацію
    return (
        db.query(models.KP)
        .options(
            selectinload(models.KP.items).selectinload(models.KPItem.item),
            selectinload(models.KP.event_formats),
            selectinload(models.KP.created_by),
        )
        .all()
    )


def delete_kp(db: Session, kp_id: int):
    kp = get_kp(db, kp_id)
    if not kp:
        return None
    db.delete(kp)
    db.commit()
    return True

# KPItem CRUD
def add_item_to_kp(db: Session, kp_id: int, item_id: int, quantity: int):
    kp_item = models.KPItem(
        kp_id=kp_id,
        item_id=item_id,
        quantity=quantity
    )
    db.add(kp_item)
    db.commit()
    db.refresh(kp_item)
    return kp_item


def get_kp_items(db: Session, kp_id: int):
    return (
        db.query(models.KP)
        .options(
            selectinload(models.KP.items)           # load KPItem rows
            .selectinload(models.KPItem.item)       # then load Item on each KPItem
            .selectinload(models.Item.subcategory)  # then load Subcategory on each Item
            .selectinload(models.Subcategory.category),  # then load Category on each Subcategory
            selectinload(models.KP.event_formats),  # load event formats
            selectinload(models.KP.created_by),  # load manager (created_by)
        )
        .filter(models.KP.id == kp_id)
        .first()
    )


def delete_kp_item(db: Session, kp_item_id: int):
    kp_item = db.query(models.KPItem).filter(models.KPItem.id == kp_item_id).first()
    if not kp_item:
        return None
    db.delete(kp_item)
    db.commit()
    return True

# Template CRUD
def create_template(db: Session, template_in: schemas.TemplateCreate):
    """
    Створює запис шаблону КП.
    
    html_content вже має бути записаний у файл до виклику цієї функції
    (це робиться в routes), тут ми лише зберігаємо метадані.
    """
    # Якщо встановлюється як default, знімаємо default з інших шаблонів
    if template_in.is_default:
        db.query(models.Template).update({models.Template.is_default: False})
    
    db_template = models.Template(
        name=template_in.name,
        filename=template_in.filename,
        description=template_in.description,
        preview_image_url=template_in.preview_image_url,
        header_image_url=template_in.header_image_url,
        background_image_url=template_in.background_image_url,
        primary_color=template_in.primary_color,
        secondary_color=template_in.secondary_color,
        text_color=template_in.text_color,
        font_family=template_in.font_family,
        # Заголовок / шрифти / кольори
        title_text=getattr(template_in, "title_text", None),
        company_name=getattr(template_in, "company_name", None),
        title_font=getattr(template_in, "title_font", None),
        header_font=getattr(template_in, "header_font", None),
        body_font=getattr(template_in, "body_font", None),
        table_font=getattr(template_in, "table_font", None),
        format_bg_color=getattr(template_in, "format_bg_color", None),
        table_header_bg_color=getattr(template_in, "table_header_bg_color", None),
        category_bg_color=getattr(template_in, "category_bg_color", None),
        summary_bg_color=getattr(template_in, "summary_bg_color", None),
        total_bg_color=getattr(template_in, "total_bg_color", None),
        # Структура
        show_item_photo=getattr(template_in, "show_item_photo", None),
        show_item_weight=getattr(template_in, "show_item_weight", None),
        show_item_quantity=getattr(template_in, "show_item_quantity", None),
        show_item_price=getattr(template_in, "show_item_price", None),
        show_item_total=getattr(template_in, "show_item_total", None),
        show_item_description=getattr(template_in, "show_item_description", None),
        show_weight_summary=getattr(template_in, "show_weight_summary", None),
        show_weight_per_person=getattr(template_in, "show_weight_per_person", None),
        show_discount_block=getattr(template_in, "show_discount_block", None),
        show_equipment_block=getattr(template_in, "show_equipment_block", None),
        show_service_block=getattr(template_in, "show_service_block", None),
        show_transport_block=getattr(template_in, "show_transport_block", None),
        menu_sections=getattr(template_in, "menu_sections", None),
        menu_title=getattr(template_in, "menu_title", None),
        summary_title=getattr(template_in, "summary_title", None),
        footer_text=getattr(template_in, "footer_text", None),
        page_orientation=getattr(template_in, "page_orientation", None),
        items_per_page=getattr(template_in, "items_per_page", None),
        booking_terms=getattr(template_in, "booking_terms", None),
        is_default=template_in.is_default or False
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

def get_templates(db: Session):
    return db.query(models.Template).all()

def get_template(db: Session, template_id: int):
    return db.query(models.Template).filter(models.Template.id == template_id).first()

def get_default_template(db: Session):
    return db.query(models.Template).filter(models.Template.is_default == True).first()

def update_template(db: Session, template_id: int, template_data: schemas.TemplateUpdate):
    """
    Оновлює запис шаблону КП.
    html_content тут ігнорується — вміст файлу вже оновлений у routes.
    """
    db_template = get_template(db, template_id)
    if not db_template:
        return None

    # Витягуємо дані без html_content (воно не є колонкою в моделі)
    update_data = template_data.dict(exclude_unset=True, exclude={"html_content"})
    
    # Якщо встановлюється як default, знімаємо default з інших шаблонів
    if update_data.get('is_default') == True:
        db.query(models.Template).filter(models.Template.id != template_id).update({models.Template.is_default: False})

    for key, value in update_data.items():
        setattr(db_template, key, value)

    db.commit()
    db.refresh(db_template)
    return db_template

def delete_template(db: Session, template_id: int):
    db_template = get_template(db, template_id)
    if not db_template:
        return None
    
    db.delete(db_template)
    db.commit()
    return True


# Telegram accounts CRUD
def create_telegram_account(db: Session, account_in: schemas.TelegramAccountCreate):
    db_account = models.TelegramAccount(
        name=account_in.name,
        phone=account_in.phone,
        session_string=account_in.session_string,
        api_id=account_in.api_id,
        api_hash=account_in.api_hash,
        is_active=True,
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account


def get_telegram_accounts(db: Session):
    return db.query(models.TelegramAccount).filter(models.TelegramAccount.is_active == True).all()


def get_telegram_account(db: Session, account_id: int):
    return db.query(models.TelegramAccount).filter(models.TelegramAccount.id == account_id, models.TelegramAccount.is_active == True).first()


def get_first_active_telegram_account(db: Session):
    return (
        db.query(models.TelegramAccount)
        .filter(models.TelegramAccount.is_active == True)
        .order_by(models.TelegramAccount.id.asc())
        .first()
    )


def delete_telegram_account(db: Session, account_id: int):
    account = db.query(models.TelegramAccount).filter(models.TelegramAccount.id == account_id).first()
    if not account:
        return False
    db.delete(account)
    db.commit()
    return True


# App settings (SMTP, Telegram API, etc.)
def set_setting(db: Session, key: str, value: str | None):
    try:
        # Нормалізуємо значення - завжди рядок, навіть якщо None
        normalized_value = value if value is not None else ""
        
        setting = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
        if not setting:
            setting = models.AppSetting(key=key, value=normalized_value)
            db.add(setting)
        else:
            setting.value = normalized_value
        db.commit()
        db.refresh(setting)
        return setting
    except Exception as e:
        db.rollback()
        print(f"❌ Error in set_setting for key '{key}': {e}")
        raise


def get_setting(db: Session, key: str) -> str | None:
    setting = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
    return setting.value if setting else None


def get_settings(db: Session, keys: list[str]) -> dict[str, str | None]:
    rows = (
        db.query(models.AppSetting)
        .filter(models.AppSetting.key.in_(keys))
        .all()
    )
    mapping = {row.key: row.value for row in rows}
    return {k: mapping.get(k) for k in keys}


# Password Reset Code CRUD
def create_password_reset_code(db: Session, email: str, code: str, expires_at: datetime) -> models.PasswordResetCode:
    """Створює код скидання пароля"""
    reset_code = models.PasswordResetCode(
        email=email,
        code=code,
        expires_at=expires_at,
        used=False
    )
    db.add(reset_code)
    db.commit()
    db.refresh(reset_code)
    return reset_code


def get_valid_reset_code(db: Session, email: str, code: str) -> models.PasswordResetCode | None:
    """Отримує валідний (не використаний, не прострочений) код скидання"""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    
    return db.query(models.PasswordResetCode).filter(
        models.PasswordResetCode.email == email,
        models.PasswordResetCode.code == code,
        models.PasswordResetCode.used == False,
        models.PasswordResetCode.expires_at > now
    ).first()


def mark_reset_code_as_used(db: Session, reset_code: models.PasswordResetCode):
    """Позначає код як використаний"""
    reset_code.used = True
    db.commit()


def get_smtp_settings(db: Session) -> dict[str, str | None]:
    keys = [
        "smtp_host",
        "smtp_port",
        "smtp_user",
        "smtp_password",
        "smtp_from_email",
        "smtp_from_name",
    ]
    return get_settings(db, keys)


def get_telegram_api_settings(db: Session) -> dict[str, str | None]:
    keys = [
        "telegram_api_id",
        "telegram_api_hash",
        "telegram_sender_name",
    ]
    return get_settings(db, keys)


def get_whatsapp_settings(db: Session) -> dict[str, str | None]:
    keys = [
        "whatsapp_access_token",
        "whatsapp_phone_number_id",
        "whatsapp_app_secret",
        "whatsapp_verify_token",
    ]
    return get_settings(db, keys)


def get_instagram_settings(db: Session) -> dict[str, str | None]:
    keys = [
        "instagram_app_secret",
    ]
    return get_settings(db, keys)


def get_facebook_settings(db: Session) -> dict[str, str | None]:
    keys = [
        "facebook_access_token",
        "facebook_app_secret",
        "facebook_verify_token",
        "facebook_page_id",
    ]
    return get_settings(db, keys)


def get_stripe_settings(db: Session) -> dict[str, str | None]:
    keys = [
        "stripe_secret_key",
    ]
    return get_settings(db, keys)


def get_inpost_settings(db: Session) -> dict[str, str | None]:
    keys = [
        "inpost_api_key",
    ]
    return get_settings(db, keys)


############################################################
# Menus CRUD
############################################################
def get_menus(db: Session):
    """
    Повертає всі меню з підвантаженими елементами.
    """
    return (
        db.query(models.Menu)
        .options(selectinload(models.Menu.items).selectinload(models.MenuItem.item))
        .all()
    )


def get_menu(db: Session, menu_id: int):
    return (
        db.query(models.Menu)
        .options(selectinload(models.Menu.items).selectinload(models.MenuItem.item))
        .filter(models.Menu.id == menu_id)
        .first()
    )


def create_menu(db: Session, menu_in: schemas.MenuCreate):
    menu = models.Menu(
        name=menu_in.name,
        description=menu_in.description,
        event_format=menu_in.event_format,
        people_count=menu_in.people_count,
    )
    db.add(menu)
    db.flush()  # щоб отримати menu.id

    item_ids = [it.item_id for it in menu_in.items]
    if item_ids:
        existing = {
            i.id
            for i in db.query(models.Item)
            .filter(models.Item.id.in_(item_ids))
            .all()
        }
        for it in menu_in.items:
            if it.item_id not in existing:
                raise ValueError(f"Item id {it.item_id} not found")
            db.add(
                models.MenuItem(
                    menu_id=menu.id,
                    item_id=it.item_id,
                    quantity=it.quantity,
                )
            )

    db.commit()
    db.refresh(menu)
    return get_menu(db, menu.id)


def update_menu(db: Session, menu_id: int, menu_in: schemas.MenuUpdate):
    menu = db.query(models.Menu).filter(models.Menu.id == menu_id).first()
    if not menu:
        return None

    update_data = menu_in.dict(exclude_unset=True, exclude={"items"})
    for key, value in update_data.items():
        setattr(menu, key, value)

    # Якщо передано items – повністю перезаписуємо склад меню
    if menu_in.items is not None:
        db.query(models.MenuItem).filter(models.MenuItem.menu_id == menu_id).delete()

        item_ids = [it.item_id for it in menu_in.items]
        if item_ids:
            existing = {
                i.id
                for i in db.query(models.Item)
                .filter(models.Item.id.in_(item_ids))
                .all()
            }
            for it in menu_in.items:
                if it.item_id not in existing:
                    raise ValueError(f"Item id {it.item_id} not found")
                db.add(
                    models.MenuItem(
                        menu_id=menu.id,
                        item_id=it.item_id,
                        quantity=it.quantity,
                    )
                )

    db.commit()
    db.refresh(menu)
    return get_menu(db, menu.id)


def delete_menu(db: Session, menu_id: int):
    menu = db.query(models.Menu).filter(models.Menu.id == menu_id).first()
    if not menu:
        return False
    db.delete(menu)
    db.commit()
    return True


############################################################
# Clients CRUD
############################################################

def get_clients(db: Session):
    return db.query(models.Client).order_by(models.Client.created_at.desc()).all()


def get_client(db: Session, client_id: int):
    return db.query(models.Client).filter(models.Client.id == client_id).first()


def create_client(db: Session, client_in: schemas.ClientCreate):
    client = models.Client(**client_in.dict(exclude_unset=True))
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def update_client(db: Session, client_id: int, client_in: schemas.ClientUpdate):
    client = get_client(db, client_id)
    if not client:
        return None

    update_data = client_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(client, key, value)

    db.commit()
    db.refresh(client)
    return client


def upsert_client_from_kp(db: Session, kp: models.KP):
    """
    Автоматично створює або оновлює клієнта на основі даних КП.
    Пошук клієнта: спочатку по телефону, потім по email, потім по імені.
    Оновлює накопичувальну статистику клієнта.
    """
    if not (kp.client_name or kp.client_phone or kp.client_email):
        return None

    query = db.query(models.Client)
    client = None

    if kp.client_phone:
        client = query.filter(models.Client.phone == kp.client_phone).first()
    if not client and kp.client_email:
        client = query.filter(models.Client.email == kp.client_email).first()
    if not client and kp.client_name:
        client = query.filter(models.Client.name == kp.client_name).first()

    is_new_client = False
    if not client:
        is_new_client = True
        client = models.Client(
            name=kp.client_name or kp.title,
            phone=kp.client_phone or "",
            email=kp.client_email,
        )
        db.add(client)
        db.flush()  # Отримуємо ID клієнта

    # Прив'язуємо КП до клієнта
    if not kp.client_id:
        kp.client_id = client.id

    # Оновлюємо накопичувальну статистику (тільки для нових КП)
    # Це базова логіка - детальне оновлення робиться в loyalty_service
    if is_new_client:
        client.total_orders = 1
        client.lifetime_spent = kp.total_price or 0
    # Для існуючих клієнтів статистика оновлюється окремо при зміні статусу КП

    db.commit()
    db.refresh(client)
    return client

############################################################
# Benefits (discounts and cashback levels)
############################################################

def get_benefits(db: Session, type_filter: str | None = None, active_only: bool = True):
    query = db.query(models.Benefit)
    if type_filter:
        query = query.filter(models.Benefit.type == type_filter)
    if active_only:
        query = query.filter(models.Benefit.is_active == True)
    return query.order_by(models.Benefit.value.desc()).all()


def get_benefit(db: Session, benefit_id: int):
    return db.query(models.Benefit).filter(models.Benefit.id == benefit_id).first()


def create_benefit(db: Session, benefit_in: schemas.BenefitCreate):
    benefit = models.Benefit(**benefit_in.dict())
    db.add(benefit)
    db.commit()
    db.refresh(benefit)
    return benefit


def update_benefit(db: Session, benefit_id: int, benefit_in: schemas.BenefitUpdate):
    benefit = get_benefit(db, benefit_id)
    if not benefit:
        return None
    
    update_data = benefit_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(benefit, key, value)
    
    db.commit()
    db.refresh(benefit)
    return benefit


def delete_benefit(db: Session, benefit_id: int):
    benefit = get_benefit(db, benefit_id)
    if not benefit:
        return False
    db.delete(benefit)
    db.commit()
    return True
