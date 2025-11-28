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


def create_kp(db: Session, kp_in: schemas.KPCreate):

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
        client_email=kp_in.client_email,
        client_phone=kp_in.client_phone,
        status=kp_in.status or "sent",
    )

    db.add(kp)
    db.flush()  # get kp.id

    # validate item ids and create KPItem rows
    item_ids = [it.item_id for it in kp_in.items]
    if item_ids:
        existing = {i.id for i in db.query(models.Item).filter(models.Item.id.in_(item_ids)).all()}
        for it in kp_in.items:
            if it.item_id not in existing:
                raise ValueError(f"Item id {it.item_id} not found")
            kp_item = models.KPItem(kp_id=kp.id, item_id=it.item_id, quantity=it.quantity)
            db.add(kp_item)

    db.commit()
    db.refresh(kp)
    # eager load items+item for immediate use
    return (
        db.query(models.KP)
        .options(selectinload(models.KP.items).selectinload(models.KPItem.item))
        .filter(models.KP.id == kp.id)
        .first()
    )

def get_kp(db: Session, kp_id: int):
    return db.query(models.KP).filter(models.KP.id == kp_id).first()


def get_all_kps(db: Session):
    # Повертаємо КП разом з позиціями, щоб фронтенд міг показувати деталізацію
    return (
        db.query(models.KP)
        .options(selectinload(models.KP.items).selectinload(models.KPItem.item))
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