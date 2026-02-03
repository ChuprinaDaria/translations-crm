"""
Integrations Router - API endpoints for external integrations (RAG, etc.)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
import logging

from core.database import get_db
from .dependencies import verify_rag_token
from .schemas import LeadData, LeadResponse
from modules.crm import models as crm_models
from modules.crm import schemas as crm_schemas

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.post("/receive-lead", response_model=LeadResponse)
async def receive_lead_from_rag(
    lead_data: LeadData,
    db: Session = Depends(get_db),
    _token: str = Depends(verify_rag_token),  # Перевірка токену
):
    """
    Приймає ліда від AdMe RAG (Sloth).
    
    Перевіряє токен X-RAG-TOKEN та створює клієнта в CRM системі.
    """
    try:
        # Визначаємо повне ім'я (пріоритет: full_name > name)
        full_name = lead_data.full_name or lead_data.name
        if not full_name:
            full_name = "Клієнт з RAG"
        
        # Визначаємо телефон (обов'язкове поле)
        phone = lead_data.phone
        if not phone:
            # Якщо немає телефону, спробуємо використати external_id
            phone = lead_data.external_id or "не вказано"
        
        # Визначаємо джерело клієнта
        # Якщо вказано platform, використовуємо його, інакше MANUAL
        source = crm_models.ClientSource.MANUAL
        if lead_data.platform:
            platform_lower = lead_data.platform.lower()
            if platform_lower == "telegram":
                source = crm_models.ClientSource.TELEGRAM
            elif platform_lower == "whatsapp":
                source = crm_models.ClientSource.WHATSAPP
            elif platform_lower == "email":
                source = crm_models.ClientSource.EMAIL
            elif platform_lower == "instagram":
                source = crm_models.ClientSource.INSTAGRAM
            elif platform_lower == "facebook":
                source = crm_models.ClientSource.FACEBOOK
        
        # Перевірка на дублікати по телефону
        existing_by_phone = db.query(crm_models.Client).filter(
            crm_models.Client.phone == phone
        ).first()
        
        if existing_by_phone:
            logger.info(f"Лід від RAG: клієнт з телефоном {phone} вже існує (ID: {existing_by_phone.id})")
            return LeadResponse(
                status="success",
                source="verified_rag",
                client_id=existing_by_phone.id,
                message=f"Клієнт вже існує: {existing_by_phone.full_name}"
            )
        
        # Перевірка на дублікати по email (якщо вказано)
        if lead_data.email:
            existing_by_email = db.query(crm_models.Client).filter(
                crm_models.Client.email == lead_data.email
            ).first()
            
            if existing_by_email:
                logger.info(f"Лід від RAG: клієнт з email {lead_data.email} вже існує (ID: {existing_by_email.id})")
                return LeadResponse(
                    status="success",
                    source="verified_rag",
                    client_id=existing_by_email.id,
                    message=f"Клієнт з цим email вже існує: {existing_by_email.full_name}"
                )
        
        # Створюємо нового клієнта
        client = crm_models.Client(
            full_name=full_name,
            email=lead_data.email,
            phone=phone,
            source=source,
        )
        
        db.add(client)
        db.commit()
        db.refresh(client)
        
        logger.info(f"✅ Створено нового клієнта від RAG: {full_name} (ID: {client.id})")
        
        # Якщо є conversation_id або external_id + platform, прив'язуємо діалог
        if lead_data.conversation_id or (lead_data.platform and lead_data.external_id):
            try:
                from modules.communications.models import Conversation, PlatformEnum
                
                if lead_data.conversation_id:
                    conversation = db.query(Conversation).filter(
                        Conversation.id == lead_data.conversation_id
                    ).first()
                    if conversation:
                        conversation.client_id = client.id
                        db.commit()
                        logger.info(f"Прив'язано діалог {lead_data.conversation_id} до клієнта {client.id}")
                elif lead_data.platform and lead_data.external_id:
                    try:
                        platform_enum = PlatformEnum(lead_data.platform.lower())
                        conversation = db.query(Conversation).filter(
                            Conversation.platform == platform_enum,
                            Conversation.external_id == lead_data.external_id
                        ).first()
                        if conversation:
                            conversation.client_id = client.id
                            db.commit()
                            logger.info(f"Прив'язано діалог {lead_data.external_id} ({lead_data.platform}) до клієнта {client.id}")
                    except ValueError:
                        # Невірний platform enum, ігноруємо
                        pass
            except Exception as e:
                logger.warning(f"Не вдалося прив'язати діалог до клієнта: {e}")
                # Не блокуємо створення клієнта, якщо не вдалося прив'язати діалог
        
        return LeadResponse(
            status="success",
            source="verified_rag",
            client_id=client.id,
            message=f"Клієнт успішно створено: {full_name}"
        )
        
    except HTTPException:
        # Прокидуємо HTTPException далі
        raise
    except Exception as e:
        logger.error(f"Помилка при обробці ліда від RAG: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Помилка при обробці ліда: {str(e)}"
        )

