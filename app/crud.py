from sqlalchemy.orm import Session, selectinload

import models as models
import schema as schemas

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

    update_data = item_data.dict(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_item, key, value)

    db.commit()
    db.refresh(db_item)
    return db_item


def delete_item(db: Session, item_id: int):
    db_item = get_item(db, item_id)
    if not db_item:
        return None

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
    if category_id:
        query = query.filter(models.Subcategory.category_id == category_id)
    return query.all()

def delete_subcategory(db: Session, subcategory_id: int = None):
    ...


# KP CRUD
def delete_kp(db: Session, kp_id: int):
    db_item = get_kp(db, kp_id)
    if not db_item:
        return None

    db.delete(db_item)
    db.commit()
    return True


def create_kp(db: Session, kp_in: schemas.KPCreate, created_by_id: int | None = None):

    price_per_person = kp_in.price_per_person
    print(f"Price per person: {price_per_person}")
    
    if not price_per_person:
        price_per_person = kp_in.total_price / kp_in.people_count

    kp = models.KP(
        title=kp_in.title,
        people_count=kp_in.people_count,
        total_price=kp_in.total_price,
        price_per_person=price_per_person,
        template_id=kp_in.template_id,
        # Загальні дані про клієнта та захід
        client_name=kp_in.client_name,
        event_format=kp_in.event_format,
        event_group=kp_in.event_group,
        event_date=kp_in.event_date,
        event_location=kp_in.event_location,
        event_time=kp_in.event_time,
        coordinator_name=kp_in.coordinator_name,
        coordinator_phone=kp_in.coordinator_phone,
        client_email=kp_in.client_email,
        client_phone=kp_in.client_phone,
        equipment_total=kp_in.equipment_total,
        service_total=kp_in.service_total,
        transport_total=getattr(kp_in, "transport_total", None),
        created_by_id=created_by_id,
        status=kp_in.status or "sent",
        discount_id=getattr(kp_in, "discount_id", None),
        cashback_id=getattr(kp_in, "cashback_id", None),
        use_cashback=getattr(kp_in, "use_cashback", False),
        discount_amount=getattr(kp_in, "discount_amount", None),
        cashback_amount=getattr(kp_in, "cashback_amount", None),
        discount_include_menu=getattr(kp_in, "discount_include_menu", True),
        discount_include_equipment=getattr(kp_in, "discount_include_equipment", False),
        discount_include_service=getattr(kp_in, "discount_include_service", False),
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
    
    if item_ids:
        existing_items = {i.id: i for i in db.query(models.Item).filter(models.Item.id.in_(item_ids)).all()}
        for it in kp_in.items:
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
    kp.coordinator_name = kp_in.coordinator_name
    kp.coordinator_phone = kp_in.coordinator_phone
    kp.client_email = kp_in.client_email
    kp.client_phone = kp_in.client_phone
    kp.equipment_total = kp_in.equipment_total
    kp.service_total = kp_in.service_total
    kp.transport_total = getattr(kp_in, "transport_total", None)
    kp.discount_id = getattr(kp_in, "discount_id", None)
    kp.cashback_id = getattr(kp_in, "cashback_id", None)
    kp.use_cashback = getattr(kp_in, "use_cashback", False)
    kp.discount_amount = getattr(kp_in, "discount_amount", None)
    kp.cashback_amount = getattr(kp_in, "cashback_amount", None)
    kp.discount_include_menu = getattr(kp_in, "discount_include_menu", True)
    kp.discount_include_equipment = getattr(kp_in, "discount_include_equipment", False)
    kp.discount_include_service = getattr(kp_in, "discount_include_service", False)
    
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
    item_ids = [it.item_id for it in kp_in.items]
    total_weight_grams = 0.0
    
    if item_ids:
        existing_items = {i.id: i for i in db.query(models.Item).filter(models.Item.id.in_(item_ids)).all()}
        for it in kp_in.items:
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
            .selectinload(models.Subcategory.category)  # then load Category on each Subcategory
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
    setting = db.query(models.AppSetting).filter(models.AppSetting.key == key).first()
    if not setting:
        setting = models.AppSetting(key=key, value=value or "")
        db.add(setting)
    else:
        setting.value = value or ""
    db.commit()
    db.refresh(setting)
    return setting


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

    # Якщо не оплачена сума не задана явно — рахуємо як total - paid
    if "kp_total_amount" in update_data or "paid_amount" in update_data:
        total = client.kp_total_amount or 0
        paid = client.paid_amount or 0
        client.unpaid_amount = max(total - paid, 0)

    db.commit()
    db.refresh(client)
    return client


def upsert_client_from_kp(db: Session, kp: models.KP):
    """
    Автоматично створює або оновлює клієнта на основі даних КП.
    Пошук клієнта: спочатку по телефону, потім по email, потім по імені.
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

    if not client:
        client = models.Client(
            name=kp.client_name or kp.title,
            phone=kp.client_phone,
            email=kp.client_email,
            status="новий",
        )
        db.add(client)

    # Оновлюємо актуальні дані заходу
    client.event_date = kp.event_date
    client.event_format = kp.event_format
    client.event_group = kp.event_group
    client.event_time = kp.event_time
    client.event_location = kp.event_location

    # Підсумки по КП
    client.kp_total_amount = kp.total_price
    if client.paid_amount is not None and kp.total_price is not None:
        client.unpaid_amount = max(kp.total_price - client.paid_amount, 0)
    else:
        client.unpaid_amount = kp.total_price
    
    # Оновлення знижки та кешбеку
    if kp.discount_id and kp.discount_amount:
        # Завантажуємо benefit для отримання значення
        discount_benefit = db.query(models.Benefit).filter(models.Benefit.id == kp.discount_id).first()
        discount_value = discount_benefit.value if discount_benefit else '?'
        # Додаємо інформацію про знижку до текстового поля
        discount_text = f"{discount_value}% до КП #{kp.id}"
        if client.discount:
            client.discount = f"{client.discount}; {discount_text}"
        else:
            client.discount = discount_text
    
    # Оновлюємо кешбек (сумуємо всі кешбеки з усіх КП клієнта)
    # Знаходимо всі КП цього клієнта та сумуємо кешбек
    all_client_kps = db.query(models.KP).filter(
        (models.KP.client_name == client.name) |
        (models.KP.client_phone == client.phone) |
        (models.KP.client_email == client.email)
    ).all()
    total_cashback = sum(k.cashback_amount or 0 for k in all_client_kps)
    client.cashback = total_cashback

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
