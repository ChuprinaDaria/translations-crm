"""
Matrix Router - FastAPI endpoints для Matrix Bridge інтеграції.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from uuid import UUID
import logging

from core.database import get_db
from modules.auth.dependencies import get_current_user_db
from modules.auth.models import User
from .schemas import MatrixConfig, MatrixRoomInfo, MatrixEventInfo
from .service import MatrixWhatsAppService
from .provider import MatrixProvider
import crud

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/matrix", tags=["matrix"])


@router.get("/config")
async def get_matrix_config(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_db),
):
    """
    Отримати конфігурацію Matrix Bridge.
    
    Повертає homeserver, access_token (якщо є) та інші налаштування.
    """
    settings = crud.get_matrix_settings(db)
    
    return {
        "homeserver": settings.get("matrix_homeserver", ""),
        "user_id": settings.get("matrix_user_id"),
        "device_id": settings.get("matrix_device_id"),
        "has_access_token": bool(settings.get("matrix_access_token")),
    }


@router.post("/config")
async def update_matrix_config(
    homeserver: str = Body(...),
    access_token: Optional[str] = Body(None),
    user_id: Optional[str] = Body(None),
    device_id: Optional[str] = Body(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_db),
):
    """
    Оновити конфігурацію Matrix Bridge.
    
    Зберігає Matrix Access Token під поточним користувачем.
    """
    # Зберігаємо homeserver
    crud.set_setting(db, "matrix_homeserver", homeserver)
    
    # Зберігаємо access_token (якщо надано)
    if access_token:
        crud.set_setting(db, "matrix_access_token", access_token)
    
    # Зберігаємо user_id та device_id (якщо надано)
    if user_id:
        crud.set_setting(db, "matrix_user_id", user_id)
    if device_id:
        crud.set_setting(db, "matrix_device_id", device_id)
    
    return {"status": "success", "message": "Matrix configuration updated"}


@router.get("/rooms")
async def get_matrix_rooms(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_db),
):
    """
    Отримати список Matrix кімнат (WhatsApp чатів).
    """
    try:
        settings = crud.get_matrix_settings(db)
        
        if not settings.get("matrix_homeserver") or not settings.get("matrix_access_token"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Matrix configuration not set"
            )
        
        config = MatrixConfig(
            homeserver=settings["matrix_homeserver"],
            access_token=settings["matrix_access_token"],
            user_id=settings.get("matrix_user_id"),
            device_id=settings.get("matrix_device_id"),
        )
        
        provider = MatrixProvider(config)
        await provider.connect()
        
        rooms = await provider.get_rooms()
        await provider.disconnect()
        
        return {"rooms": [room.dict() for room in rooms]}
        
    except Exception as e:
        logger.error(f"Failed to get Matrix rooms: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Matrix rooms: {str(e)}"
        )


@router.get("/rooms/{room_id}/messages")
async def get_room_messages(
    room_id: str,
    limit: int = Query(50, ge=1, le=100),
    from_token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_db),
):
    """
    Отримати повідомлення з Matrix кімнати.
    """
    try:
        settings = crud.get_matrix_settings(db)
        
        if not settings.get("matrix_homeserver") or not settings.get("matrix_access_token"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Matrix configuration not set"
            )
        
        config = MatrixConfig(
            homeserver=settings["matrix_homeserver"],
            access_token=settings["matrix_access_token"],
            user_id=settings.get("matrix_user_id"),
            device_id=settings.get("matrix_device_id"),
        )
        
        provider = MatrixProvider(config)
        await provider.connect()
        
        messages = await provider.get_room_messages(
            room_id=room_id,
            limit=limit,
            from_token=from_token,
        )
        await provider.disconnect()
        
        return {"messages": messages}
        
    except Exception as e:
        logger.error(f"Failed to get room messages: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get room messages: {str(e)}"
        )


@router.post("/sync")
async def sync_matrix(
    timeout: int = Body(30000, ge=1000, le=60000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_db),
):
    """
    Синхронізувати стан з Matrix homeserver.
    
    Отримує нові повідомлення та оновлює їх в системі.
    """
    try:
        settings = crud.get_matrix_settings(db)
        
        if not settings.get("matrix_homeserver") or not settings.get("matrix_access_token"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Matrix configuration not set"
            )
        
        config = MatrixConfig(
            homeserver=settings["matrix_homeserver"],
            access_token=settings["matrix_access_token"],
            user_id=settings.get("matrix_user_id"),
            device_id=settings.get("matrix_device_id"),
        )
        
        provider = MatrixProvider(config)
        await provider.connect()
        
        sync_response = await provider.sync(timeout=timeout)
        
        if sync_response:
            # Обробити events
            service = MatrixWhatsAppService(db, {
                "homeserver": settings["matrix_homeserver"],
                "access_token": settings["matrix_access_token"],
                "user_id": settings.get("matrix_user_id"),
                "device_id": settings.get("matrix_device_id"),
            })
            
            events = provider.parse_sync_events(sync_response)
            processed = 0
            
            for event in events:
                try:
                    await service.process_matrix_event(event)
                    processed += 1
                except Exception as e:
                    logger.error(f"Failed to process event {event.get('event_id')}: {e}")
            
            await provider.disconnect()
            
            return {
                "status": "success",
                "processed": processed,
                "next_batch": sync_response.next_batch if sync_response else None,
            }
        else:
            await provider.disconnect()
            return {
                "status": "success",
                "processed": 0,
                "next_batch": None,
            }
        
    except Exception as e:
        logger.error(f"Failed to sync Matrix: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync Matrix: {str(e)}"
        )


@router.post("/webhook")
async def matrix_webhook(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """
    Webhook endpoint для отримання подій від Matrix Bridge.
    
    mautrix-whatsapp може надсилати події через webhook.
    """
    try:
        # Перевірити, чи Matrix Bridge активний
        import os
        whatsapp_mode = os.getenv("WHATSAPP_MODE", "matrix")
        if whatsapp_mode != "matrix":
            logger.warning(f"Matrix webhook received but WhatsApp mode is '{whatsapp_mode}'")
            return {"status": "ignored", "reason": f"WhatsApp mode is '{whatsapp_mode}'"}
        
        # Обробити подію
        service = MatrixWhatsAppService(db)
        
        # Структура payload залежить від mautrix-whatsapp
        # Може бути event або список events
        events = payload.get("events", [])
        if not events:
            # Якщо це один event
            events = [payload]
        
        processed = 0
        for event in events:
            try:
                await service.process_matrix_event(event)
                processed += 1
            except Exception as e:
                logger.error(f"Failed to process webhook event: {e}")
        
        return {"status": "success", "processed": processed}
        
    except Exception as e:
        logger.error(f"Failed to process Matrix webhook: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process webhook: {str(e)}"
        )


@router.get("/system-config")
async def get_system_config(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_db),
):
    """
    Отримати системні налаштування Matrix (тільки для адміна).
    
    Повертає homeserver URL, server name, bridge admin secret (без пароля).
    """
    # Перевірка прав адміна
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = crud.get_matrix_system_settings(db)
    
    return {
        "homeserver_url": settings.get("matrix_homeserver_url", ""),
        "server_name": settings.get("matrix_server_name", ""),
        "admin_login": settings.get("matrix_admin_login", ""),
        "has_admin_password": bool(settings.get("matrix_admin_password")),
        "has_bridge_admin_secret": bool(settings.get("matrix_bridge_admin_secret")),
    }


@router.post("/system-config")
async def update_system_config(
    homeserver_url: str = Body(...),
    server_name: str = Body(...),
    admin_login: str = Body(...),
    admin_password: str = Body(...),
    bridge_admin_secret: str = Body(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_db),
):
    """
    Оновити системні налаштування Matrix (тільки для адміна).
    
    При збереженні пароля адміна, автоматично виконується логін та зберігається access token.
    """
    # Перевірка прав адміна
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Зберігаємо системні налаштування
    crud.set_setting(db, "matrix_homeserver_url", homeserver_url)
    crud.set_setting(db, "matrix_server_name", server_name)
    crud.set_setting(db, "matrix_admin_login", admin_login)
    crud.set_setting(db, "matrix_admin_password", admin_password)  # TODO: зашифрувати
    crud.set_setting(db, "matrix_bridge_admin_secret", bridge_admin_secret)
    
    # Автоматично логінимося адміном та зберігаємо access token
    try:
        from .schemas import MatrixConfig
        from .provider import MatrixProvider
        
        config = MatrixConfig(
            homeserver=homeserver_url,
            access_token="",  # Буде отримано при логіні
        )
        provider = MatrixProvider(config)
        
        # Логінимося адміном
        login_result = await provider.login_user(admin_login, admin_password)
        
        if login_result and login_result.get("access_token"):
            # Зберігаємо admin access token
            crud.set_setting(db, "matrix_admin_access_token", login_result["access_token"])
            crud.set_setting(db, "matrix_admin_device_id", login_result.get("device_id", ""))
            crud.set_setting(db, "matrix_admin_user_id", login_result.get("user_id", ""))
            
            logger.info("Matrix admin logged in successfully")
        else:
            logger.warning("Failed to login Matrix admin, but settings saved")
    except Exception as e:
        logger.error(f"Failed to auto-login Matrix admin: {e}")
        # Не блокуємо збереження налаштувань
    
    return {"status": "success", "message": "Matrix system configuration updated"}


@router.post("/users/{user_id}/connect-whatsapp")
async def connect_user_whatsapp(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_db),
):
    """
    Підключити WhatsApp для користувача (генерує QR-код).
    
    Магія:
    1. Створює Matrix користувача (якщо немає)
    2. Логінить його
    3. Запитує QR-код у мосту
    4. Повертає QR на фронт
    """
    from .schemas import MatrixQRResponse
    from .provider import MatrixProvider
    from .schemas import MatrixConfig
    import crud_user
    
    # Перевірка: користувач може підключити тільки свій WhatsApp
    if str(current_user.id) != str(user_id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Can only connect your own WhatsApp")
    
    # Отримати користувача
    user = crud_user.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Отримати системні налаштування
    system_settings = crud.get_matrix_system_settings(db)
    homeserver_url = system_settings.get("matrix_homeserver_url")
    server_name = system_settings.get("matrix_server_name")
    admin_access_token = crud.get_setting(db, "matrix_admin_access_token")
    bridge_admin_secret = system_settings.get("matrix_bridge_admin_secret")
    
    if not homeserver_url or not server_name or not admin_access_token:
        raise HTTPException(
            status_code=400,
            detail="Matrix system configuration not complete. Please configure in admin settings."
        )
    
    try:
        # Генеруємо username для Matrix (на основі email користувача)
        matrix_username = user.email.split("@")[0].replace(".", "_").replace("-", "_")
        matrix_user_id = f"@{matrix_username}:{server_name}"
        
        # Перевіряємо, чи користувач вже існує в Matrix
        user_matrix_settings = crud.get_matrix_user_settings(db, str(user_id))
        existing_access_token = user_matrix_settings.get(f"matrix_user_{user_id}_access_token")
        
        if not existing_access_token:
            # Створюємо користувача в Matrix
            config = MatrixConfig(homeserver=homeserver_url, access_token="")
            provider = MatrixProvider(config)
            
            # Генеруємо пароль для Matrix користувача
            import secrets
            matrix_password = secrets.token_urlsafe(32)
            
            # Створюємо користувача через admin API
            create_result = await provider.create_user(
                username=matrix_username,
                password=matrix_password,
                admin_access_token=admin_access_token,
            )
            
            if not create_result:
                raise HTTPException(status_code=500, detail="Failed to create Matrix user")
            
            # Зберігаємо пароль та access token
            crud.set_setting(db, f"matrix_user_{user_id}_password", matrix_password)
            crud.set_setting(db, f"matrix_user_{user_id}_access_token", create_result["access_token"])
            crud.set_setting(db, f"matrix_user_{user_id}_device_id", create_result.get("device_id", ""))
            crud.set_setting(db, f"matrix_user_{user_id}_matrix_id", create_result["user_id"])
            
            access_token = create_result["access_token"]
        else:
            # Логінимося існуючим користувачем
            matrix_password = crud.get_setting(db, f"matrix_user_{user_id}_password")
            if not matrix_password:
                raise HTTPException(status_code=400, detail="Matrix user password not found")
            
            config = MatrixConfig(homeserver=homeserver_url, access_token="")
            provider = MatrixProvider(config)
            
            login_result = await provider.login_user(matrix_username, matrix_password)
            if not login_result:
                raise HTTPException(status_code=500, detail="Failed to login Matrix user")
            
            access_token = login_result["access_token"]
            # Оновлюємо токен
            crud.set_setting(db, f"matrix_user_{user_id}_access_token", access_token)
        
        # Отримуємо QR-код через bridge
        # TODO: Реалізувати отримання QR-коду через bridge API
        # Поки що повертаємо room_id для подальшої обробки
        
        return MatrixQRResponse(
            qr_code="",  # TODO: Отримати QR-код від bridge
            qr_url=f"matrix://room/{matrix_user_id}",  # Placeholder
            expires_at=None,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to connect user WhatsApp: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to connect WhatsApp: {str(e)}"
        )

