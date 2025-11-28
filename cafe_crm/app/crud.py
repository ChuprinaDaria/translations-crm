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
    return db.query(models.KP).all()


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
    db_template = get_template(db, template_id)
    if not db_template:
        return None

    update_data = template_data.dict(exclude_unset=True)
    
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