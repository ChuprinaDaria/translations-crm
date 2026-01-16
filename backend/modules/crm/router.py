"""
CRM routes - clients, orders, KP endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from core.database import get_db
from modules.auth.dependencies import get_current_user_db
from modules.crm import models, schemas
from modules.crm.services import timeline as timeline_service
from modules.auth import models as auth_models

router = APIRouter(tags=["crm"])


@router.get("/clients", response_model=List[schemas.ClientRead])
def get_clients(
    skip: int = 0,
    limit: int = 100,
    source: Optional[str] = None,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get clients list with optional filtering."""
    query = db.query(models.Client)
    
    if source:
        query = query.filter(models.Client.source == source)
    
    clients = query.order_by(models.Client.created_at.desc()).offset(skip).limit(limit).all()
    return clients


@router.post("/clients", response_model=schemas.ClientRead)
def create_client(
    client_in: schemas.ClientCreate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Create a new client. Checks for duplicates by phone/email/telegram."""
    # Check for existing client by phone
    existing = db.query(models.Client).filter(models.Client.phone == client_in.phone).first()
    if existing:
        raise HTTPException(
            status_code=400, 
            detail={
                "type": "duplicate_client",
                "client_id": str(existing.id),
                "message": f"Клієнт вже існує: {existing.full_name}"
            }
        )
    
    # Check by email if provided
    if client_in.email:
        existing = db.query(models.Client).filter(models.Client.email == client_in.email).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail={
                    "type": "duplicate_client",
                    "client_id": str(existing.id),
                    "message": f"Клієнт з цим email вже існує: {existing.full_name}"
                }
            )
    
    # Create new client
    client = models.Client(
        full_name=client_in.full_name,
        email=client_in.email,
        phone=client_in.phone,
        source=client_in.source or models.ClientSource.MANUAL,
    )
    
    db.add(client)
    db.commit()
    db.refresh(client)
    
    return client


@router.get("/clients/{client_id}", response_model=schemas.ClientRead)
def get_client(
    client_id: str,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get client by ID with orders."""
    from uuid import UUID
    try:
        client_uuid = UUID(client_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid client_id format")
    
    client = db.query(models.Client).filter(models.Client.id == client_uuid).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return client


@router.put("/clients/{client_id}", response_model=schemas.ClientRead)
def update_client(
    client_id: str,
    client_in: schemas.ClientCreate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Update client."""
    from uuid import UUID
    try:
        client_uuid = UUID(client_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid client_id format")
    
    client = db.query(models.Client).filter(models.Client.id == client_uuid).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    client.full_name = client_in.full_name
    client.email = client_in.email
    client.phone = client_in.phone
    if client_in.source:
        client.source = client_in.source
    
    db.commit()
    db.refresh(client)
    return client


@router.delete("/clients/{client_id}")
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Delete client and all related data."""
    from uuid import UUID
    try:
        client_uuid = UUID(client_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid client_id format")
    
    client = db.query(models.Client).filter(models.Client.id == client_uuid).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    db.delete(client)
    db.commit()
    return {"status": "deleted", "id": client_id}


@router.get("/orders", response_model=List[schemas.OrderRead])
def get_orders(
    status: Optional[str] = None,
    client_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get orders list with optional filtering."""
    query = db.query(models.Order)
    
    if status:
        query = query.filter(models.Order.status == status)
    
    if client_id:
        from uuid import UUID
        try:
            client_uuid = UUID(client_id)
            query = query.filter(models.Order.client_id == client_uuid)
        except ValueError:
            pass
    
    orders = query.order_by(models.Order.created_at.desc()).offset(skip).limit(limit).all()
    
    # Fix timeline_steps metadata for response - використовуємо get_attribute для прямого доступу
    from sqlalchemy.orm.attributes import get_attribute
    for order in orders:
        for step in order.timeline_steps:
            # Отримуємо значення напряму з колонки через get_attribute
            try:
                step_metadata = get_attribute(step, 'step_metadata')
                # Перевіряємо, що це рядок або None
                if not isinstance(step_metadata, (str, type(None))):
                    step_metadata = None
            except:
                step_metadata = None
            
            # Встановлюємо як атрибут metadata для правильного маппінгу
            step.metadata = step_metadata
    
    return orders


@router.get("/orders/{order_id}", response_model=schemas.OrderRead)
def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get order by ID with all related data."""
    from uuid import UUID
    try:
        order_uuid = UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid order_id format")
    
    order = db.query(models.Order).filter(models.Order.id == order_uuid).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Fix timeline_steps metadata for response - використовуємо get_attribute для прямого доступу
    from sqlalchemy.orm.attributes import get_attribute
    for step in order.timeline_steps:
        # Отримуємо значення напряму з колонки через get_attribute
        try:
            step_metadata = get_attribute(step, 'step_metadata')
            # Перевіряємо, що це рядок або None
            if not isinstance(step_metadata, (str, type(None))):
                step_metadata = None
        except:
            step_metadata = None
        
        # Встановлюємо як атрибут metadata для правильного маппінгу
        step.metadata = step_metadata
    
    return order


@router.patch("/orders/{order_id}", response_model=schemas.OrderRead)
def update_order(
    order_id: str,
    order_in: schemas.OrderUpdate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Update order (PATCH - partial update)."""
    from uuid import UUID
    try:
        order_uuid = UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid order_id format")
    
    order = db.query(models.Order).filter(models.Order.id == order_uuid).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update fields if provided
    if order_in.client_id:
        order.client_id = order_in.client_id
    if order_in.manager_id:
        order.manager_id = order_in.manager_id
    if order_in.order_number:
        order.order_number = order_in.order_number
    if order_in.description is not None:
        order.description = order_in.description
    if order_in.status:
        order.status = order_in.status
    if order_in.deadline is not None:
        order.deadline = order_in.deadline
    if order_in.file_url is not None:
        order.file_url = order_in.file_url
    
    db.commit()
    db.refresh(order)
    return order


@router.post("/orders", response_model=schemas.OrderRead)
def create_order(
    order_in: schemas.OrderCreate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Create a new order."""
    # Якщо office_id не вказано, використовуємо default офіс
    office_id = order_in.office_id
    if not office_id:
        default_office = db.query(models.Office).filter(
            models.Office.is_default == True,
            models.Office.is_active == True
        ).first()
        if default_office:
            office_id = default_office.id
    
    # Створюємо замовлення
    order = models.Order(
        client_id=order_in.client_id,
        manager_id=order_in.manager_id,
        order_number=order_in.order_number,
        description=order_in.description,
        status=order_in.status or models.OrderStatus.DO_WYKONANIA,
        deadline=order_in.deadline,
        file_url=order_in.file_url,
        office_id=office_id,
    )
    
    db.add(order)
    db.commit()
    db.refresh(order)
    
    # Автоматично додаємо етап "Створено замовлення" (етап 2)
    timeline_service.mark_order_created(db, order.id, order_in.manager_id)
    
    # Якщо клієнт вже існує, додаємо етап "Створено клієнта" (етап 1)
    # Перевіряємо, чи є вже етап для цього клієнта
    client = db.query(models.Client).filter(models.Client.id == order_in.client_id).first()
    if client:
        # Перевіряємо, чи вже є замовлення для цього клієнта
        existing_orders = db.query(models.Order).filter(
            models.Order.client_id == order_in.client_id,
            models.Order.id != order.id
        ).count()
        
        if existing_orders == 0:
            # Це перше замовлення клієнта - додаємо етап "Створено клієнта"
            timeline_service.mark_client_created(db, order.id, order_in.client_id)
    
    db.refresh(order)
    return order


# Internal Notes endpoints
@router.get("/notes", response_model=List[schemas.InternalNoteRead])
def get_notes(
    entity_type: str,
    entity_id: str,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get notes for a specific entity."""
    notes = db.query(models.InternalNote).filter(
        models.InternalNote.entity_type == entity_type,
        models.InternalNote.entity_id == entity_id
    ).order_by(models.InternalNote.created_at.desc()).all()
    
    return notes


@router.post("/notes", response_model=schemas.InternalNoteRead)
def create_note(
    note_in: schemas.InternalNoteCreate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Create a new internal note."""
    # Get user name - використовуємо email
    author_name = user.email
    
    note = models.InternalNote(
        entity_type=note_in.entity_type,
        entity_id=note_in.entity_id,
        author_id=user.id,
        author_name=author_name,
        text=note_in.text,
    )
    
    db.add(note)
    db.commit()
    db.refresh(note)
    
    return note


@router.delete("/notes/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Delete an internal note (only by author or admin)."""
    note = db.query(models.InternalNote).filter(models.InternalNote.id == note_id).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Only author or admin can delete
    if note.author_id != user.id and not (hasattr(user, 'is_admin') and user.is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to delete this note")
    
    db.delete(note)
    db.commit()
    
    return {"status": "deleted", "id": note_id}


# Timeline endpoints
@router.get("/orders/{order_id}/timeline", response_model=list[schemas.TimelineStepRead])
def get_order_timeline(
    order_id: str,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get timeline steps for an order."""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Fix timeline_steps metadata for response - використовуємо get_attribute для прямого доступу
    from sqlalchemy.orm.attributes import get_attribute
    for step in order.timeline_steps:
        # Отримуємо значення напряму з колонки через get_attribute
        try:
            step_metadata = get_attribute(step, 'step_metadata')
            # Перевіряємо, що це рядок або None
            if not isinstance(step_metadata, (str, type(None))):
                step_metadata = None
        except:
            step_metadata = None
        
        # Встановлюємо як атрибут metadata для правильного маппінгу
        step.metadata = step_metadata
    
    return order.timeline_steps


@router.post("/orders/{order_id}/timeline/mark-ready")
def mark_translation_ready(
    order_id: str,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Manual: Позначити переклад готовим (етап 6)"""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    step = timeline_service.mark_translation_ready(db, order.id, user.id)
    return step


@router.post("/orders/{order_id}/timeline/mark-issued")
def mark_order_issued(
    order_id: str,
    tracking_number: Optional[str] = None,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Manual: Позначити замовлення виданим/відправленим (етап 7)"""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    step = timeline_service.mark_issued_sent(db, order.id, user.id, tracking_number)
    return step


@router.post("/orders/{order_id}/timeline/mark-payment-link-sent")
def mark_payment_link_sent(
    order_id: str,
    payment_link: str = None,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Auto: Позначити лінк оплати надісланим (етап 3)"""
    from fastapi import Body
    
    # Якщо payment_link передано як query param, використовуємо його
    # Якщо ні, очікуємо в body
    if payment_link is None:
        body = Body(...)
        payment_link = body.get("payment_link") if isinstance(body, dict) else None
    
    if not payment_link:
        raise HTTPException(status_code=400, detail="payment_link is required")
    
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    step = timeline_service.mark_payment_link_sent(db, order.id, user.id, payment_link)
    return step


@router.post("/orders/{order_id}/timeline/mark-translator-assigned")
def mark_translator_assigned(
    order_id: str,
    translator_id: str,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Auto: Позначити перекладача призначеним (етап 5)"""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    from uuid import UUID
    try:
        translator_uuid = UUID(translator_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid translator_id format")
    
    step = timeline_service.mark_translator_assigned(db, order.id, translator_uuid, user.id)
    return step


@router.post("/orders/{order_id}/timeline/mark-payment-received")
def mark_payment_received(
    order_id: str,
    transaction_id: Optional[str] = None,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Auto/Manual: Позначити оплату отриманою (етап 4)"""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    step = timeline_service.mark_payment_received(db, order.id, transaction_id)
    return step


# Translators endpoints
@router.get("/translators", response_model=List[schemas.TranslatorRead])
def get_translators(
    status: Optional[str] = None,
    language: Optional[str] = None,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get list of translators with optional filters."""
    query = db.query(models.Translator)
    
    if status:
        query = query.filter(models.Translator.status == status)
    
    if language:
        query = query.join(models.TranslatorLanguage).filter(
            models.TranslatorLanguage.language == language
        )
    
    translators = query.all()
    
    # Parse specializations from JSON for each translator's languages
    import json
    for translator in translators:
        for lang in translator.languages:
            if lang.specializations and isinstance(lang.specializations, str):
                try:
                    lang.specializations = json.loads(lang.specializations)
                except:
                    lang.specializations = None
    
    return translators


@router.get("/translators/{translator_id}", response_model=schemas.TranslatorRead)
def get_translator(
    translator_id: int,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get translator by ID."""
    translator = db.query(models.Translator).filter(models.Translator.id == translator_id).first()
    if not translator:
        raise HTTPException(status_code=404, detail="Translator not found")
    
    # Parse specializations from JSON for response
    import json
    for lang in translator.languages:
        if lang.specializations and isinstance(lang.specializations, str):
            try:
                lang.specializations = json.loads(lang.specializations)
            except (json.JSONDecodeError, TypeError, ValueError):
                lang.specializations = None
    
    return translator


@router.post("/translators", response_model=schemas.TranslatorRead)
def create_translator(
    translator_in: schemas.TranslatorCreate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Create a new translator."""
    # Check if email already exists
    existing = db.query(models.Translator).filter(models.Translator.email == translator_in.email).first()
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Перекладач з email {translator_in.email} вже існує. ID: {existing.id}, Ім'я: {existing.name}"
        )
    
    translator = models.Translator(
        name=translator_in.name,
        email=translator_in.email,
        phone=translator_in.phone,
        telegram_id=translator_in.telegram_id,
        whatsapp=translator_in.whatsapp,
        status=translator_in.status or models.TranslatorStatus.ACTIVE,
    )
    
    db.add(translator)
    db.commit()
    db.refresh(translator)
    
    # Add languages
    import json
    for lang_data in translator_in.languages:
        specializations_json = None
        if lang_data.specializations:
            specializations_json = json.dumps(lang_data.specializations)
        
        lang = models.TranslatorLanguage(
            translator_id=translator.id,
            language=lang_data.language,
            rate_per_page=lang_data.rate_per_page,
            specializations=specializations_json,
        )
        db.add(lang)
    
    db.commit()
    db.refresh(translator)
    
    # Parse specializations from JSON for response
    import json
    for lang in translator.languages:
        if lang.specializations and isinstance(lang.specializations, str):
            try:
                lang.specializations = json.loads(lang.specializations)
            except (json.JSONDecodeError, TypeError, ValueError):
                lang.specializations = None
    
    return translator


@router.put("/translators/{translator_id}", response_model=schemas.TranslatorRead)
def update_translator(
    translator_id: int,
    translator_in: schemas.TranslatorUpdate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Update translator."""
    translator = db.query(models.Translator).filter(models.Translator.id == translator_id).first()
    if not translator:
        raise HTTPException(status_code=404, detail="Translator not found")
    
    if translator_in.name:
        translator.name = translator_in.name
    if translator_in.email:
        translator.email = translator_in.email
    if translator_in.phone:
        translator.phone = translator_in.phone
    if translator_in.telegram_id is not None:
        translator.telegram_id = translator_in.telegram_id
    if translator_in.whatsapp is not None:
        translator.whatsapp = translator_in.whatsapp
    if translator_in.status:
        translator.status = translator_in.status
    
    # Update languages if provided
    if translator_in.languages is not None:
        # Delete existing languages
        db.query(models.TranslatorLanguage).filter(
            models.TranslatorLanguage.translator_id == translator_id
        ).delete()
        
        # Add new languages
        import json
        for lang_data in translator_in.languages:
            lang = models.TranslatorLanguage(
                translator_id=translator.id,
                language=lang_data.language,
                rate_per_page=lang_data.rate_per_page,
                specializations=json.dumps(lang_data.specializations) if lang_data.specializations else None,
            )
            db.add(lang)
    
    db.commit()
    db.refresh(translator)
    
    # Parse specializations from JSON for response
    import json
    for lang in translator.languages:
        if lang.specializations and isinstance(lang.specializations, str):
            try:
                lang.specializations = json.loads(lang.specializations)
            except (json.JSONDecodeError, TypeError, ValueError):
                lang.specializations = None
    
    return translator


@router.delete("/translators/{translator_id}")
def delete_translator(
    translator_id: int,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Delete translator."""
    translator = db.query(models.Translator).filter(models.Translator.id == translator_id).first()
    if not translator:
        raise HTTPException(status_code=404, detail="Translator not found")
    
    db.delete(translator)
    db.commit()
    return {"status": "deleted", "id": translator_id}


# Translation Requests endpoints
@router.post("/translation-requests", response_model=schemas.TranslationRequestRead)
def create_translation_request(
    request_in: schemas.TranslationRequestCreate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Create and send translation request to translator."""
    # Verify order exists
    order = db.query(models.Order).filter(models.Order.id == request_in.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Verify translator exists
    translator = db.query(models.Translator).filter(models.Translator.id == request_in.translator_id).first()
    if not translator:
        raise HTTPException(status_code=404, detail="Translator not found")
    
    # Create request
    translation_request = models.TranslationRequest(
        order_id=request_in.order_id,
        translator_id=request_in.translator_id,
        sent_via=request_in.sent_via,
        offered_rate=request_in.offered_rate,
        notes=request_in.notes,
    )
    
    db.add(translation_request)
    db.commit()
    db.refresh(translation_request)
    
    # TODO: Send email/telegram/whatsapp notification to translator
    # This would call a service to send the actual message
    
    return translation_request


@router.post("/translation-requests/{request_id}/accept")
def accept_translation_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Accept translation request (called by translator or admin)."""
    request = db.query(models.TranslationRequest).filter(
        models.TranslationRequest.id == request_id
    ).first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Translation request not found")
    
    if request.status != models.TranslationRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    # Update request status
    from datetime import timezone
    request.status = models.TranslationRequestStatus.ACCEPTED
    request.response_at = datetime.now(timezone.utc)
    db.commit()
    
    # Auto-update Timeline (step 5: Translator Assigned)
    # Note: translator_id is int, but timeline service expects UUID for translator
    # We'll use a placeholder UUID or update the service to accept int
    # For now, we'll create a UUID from the translator_id string
    from uuid import uuid5, NAMESPACE_DNS
    translator_uuid = uuid5(NAMESPACE_DNS, f"translator_{request.translator_id}")
    timeline_service.mark_translator_assigned(
        db, request.order_id, translator_uuid, user.id
    )
    
    # TODO: Update order with translator info
    # TODO: Send email to client (optional)
    
    db.refresh(request)
    return request


@router.post("/translation-requests/{request_id}/decline")
def decline_translation_request(
    request_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Decline translation request."""
    request = db.query(models.TranslationRequest).filter(
        models.TranslationRequest.id == request_id
    ).first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Translation request not found")
    
    if request.status != models.TranslationRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    # Update request status
    from datetime import timezone
    request.status = models.TranslationRequestStatus.DECLINED
    request.response_at = datetime.now(timezone.utc)
    if notes:
        request.notes = notes
    db.commit()
    
    # TODO: Add internal note about decline
    # from modules.crm.models import InternalNote, EntityType
    # note = InternalNote(
    #     entity_type=EntityType.ORDER,
    #     entity_id=str(request.order_id),
    #     author_id=user.id,
    #     author_name=user.email,
    #     text=f"[{request.translator.name}] Відхилив запит: {notes or 'Не вказано причини'}",
    # )
    # db.add(note)
    # db.commit()
    
    db.refresh(request)
    return request


@router.get("/orders/{order_id}/translation-requests", response_model=List[schemas.TranslationRequestRead])
def get_order_translation_requests(
    order_id: str,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get translation requests for an order."""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return order.translation_requests


# Offices endpoints
@router.get("/offices", response_model=List[schemas.OfficeRead])
def get_offices(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get list of offices."""
    query = db.query(models.Office)
    
    if is_active is not None:
        query = query.filter(models.Office.is_active == is_active)
    
    return query.order_by(models.Office.is_default.desc(), models.Office.name).all()


@router.get("/offices/{office_id}", response_model=schemas.OfficeRead)
def get_office(
    office_id: int,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get office by ID."""
    office = db.query(models.Office).filter(models.Office.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    return office


@router.get("/offices/default", response_model=schemas.OfficeRead)
def get_default_office(
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get default office."""
    office = db.query(models.Office).filter(
        models.Office.is_default == True,
        models.Office.is_active == True
    ).first()
    
    if not office:
        # Return first active office if no default
        office = db.query(models.Office).filter(models.Office.is_active == True).first()
    
    if not office:
        raise HTTPException(status_code=404, detail="No active office found")
    
    return office


@router.post("/offices", response_model=schemas.OfficeRead)
def create_office(
    office_in: schemas.OfficeCreate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Create a new office."""
    # If this is set as default, unset other defaults
    if office_in.is_default:
        db.query(models.Office).filter(models.Office.is_default == True).update({"is_default": False})
    
    office = models.Office(
        name=office_in.name,
        address=office_in.address,
        city=office_in.city,
        postal_code=office_in.postal_code,
        phone=office_in.phone,
        email=office_in.email,
        working_hours=office_in.working_hours,
        is_active=office_in.is_active,
        is_default=office_in.is_default,
    )
    
    db.add(office)
    db.commit()
    db.refresh(office)
    return office


@router.put("/offices/{office_id}", response_model=schemas.OfficeRead)
def update_office(
    office_id: int,
    office_in: schemas.OfficeUpdate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Update office."""
    office = db.query(models.Office).filter(models.Office.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    
    # If setting as default, unset other defaults
    if office_in.is_default is True:
        db.query(models.Office).filter(
            models.Office.is_default == True,
            models.Office.id != office_id
        ).update({"is_default": False})
    
    if office_in.name:
        office.name = office_in.name
    if office_in.address:
        office.address = office_in.address
    if office_in.city:
        office.city = office_in.city
    if office_in.postal_code:
        office.postal_code = office_in.postal_code
    if office_in.phone:
        office.phone = office_in.phone
    if office_in.email:
        office.email = office_in.email
    if office_in.working_hours:
        office.working_hours = office_in.working_hours
    if office_in.is_active is not None:
        office.is_active = office_in.is_active
    if office_in.is_default is not None:
        office.is_default = office_in.is_default
    
    db.commit()
    db.refresh(office)
    return office


@router.delete("/offices/{office_id}")
def delete_office(
    office_id: int,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Delete office (soft delete - set is_active=False)."""
    office = db.query(models.Office).filter(models.Office.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    
    # Soft delete
    office.is_active = False
    db.commit()
    return {"status": "deleted", "id": office_id}

