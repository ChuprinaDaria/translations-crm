import os
import asyncio
from io import BytesIO
from typing import Optional

from telethon import TelegramClient
from telethon.sessions import StringSession

from db import SessionLocal
import crud


def _load_telegram_config() -> dict:
    """
    Завантажує Telegram API налаштування з бази (app_settings),
    з fallback до env якщо в БД поки нічого немає.
    """
    db = SessionLocal()
    try:
        settings = crud.get_telegram_api_settings(db)
    finally:
        db.close()

    api_id_str = settings.get("telegram_api_id") or os.getenv("TELEGRAM_API_ID", "0")
    api_hash = settings.get("telegram_api_hash") or os.getenv("TELEGRAM_API_HASH", "")
    sender_name = settings.get("telegram_sender_name") or os.getenv("TELEGRAM_SENDER_NAME", "BOX Catering")

    try:
        api_id = int(api_id_str)
    except (TypeError, ValueError):
        api_id = 0

    return {
        "api_id": api_id,
        "api_hash": api_hash,
        "sender_name": sender_name,
    }


async def _send_kp_telegram_async(
    session_string: str,
    to_phone: str,
    pdf_content: bytes,
    pdf_filename: str,
    message: Optional[str] = None,
    api_id: Optional[int] = None,
    api_hash: Optional[str] = None,
) -> None:
    """
    Відправляє PDF‑файл КП користувачу в Telegram за номером телефону.
    Працює від імені звичайного акаунта (не бота).
    
    Args:
        session_string: Session string для Telegram акаунта
        to_phone: Номер телефону отримувача
        pdf_content: Вміст PDF файлу
        pdf_filename: Ім'я PDF файлу
        message: Додаткове повідомлення
        api_id: API ID для цього акаунта (якщо не вказано - використовується глобальне)
        api_hash: API Hash для цього акаунта (якщо не вказано - використовується глобальне)
    """
    cfg = _load_telegram_config()
    
    # Використовуємо api_id/api_hash з акаунта, якщо вказано, інакше - глобальні
    api_id = api_id if api_id is not None else cfg["api_id"]
    api_hash = api_hash if api_hash is not None else cfg["api_hash"]
    sender_name = cfg["sender_name"]

    if not api_id or not api_hash:
        raise ValueError("Telegram API налаштування не задані. Заповніть їх у налаштуваннях системи або для конкретного акаунта.")

    # Створюємо клієнта Telethon з сесії користувача
    client = TelegramClient(StringSession(session_string), api_id, api_hash)

    async with client:
        # Шукаємо користувача за номером телефону
        try:
            entity = await client.get_entity(to_phone)
        except Exception as e:
            raise ValueError(f"Не вдалося знайти користувача з телефоном {to_phone}: {e}")

        caption = message or f"Комерційна пропозиція від {sender_name}"

        # Готуємо PDF як файловий об'єкт із ім'ям, щоб Telegram коректно
        # відображав назву файлу та тип (PDF), а не "unnamed".
        pdf_stream = BytesIO(pdf_content)

        # Якщо ім'я не закінчується на .pdf — додаємо розширення
        safe_filename = pdf_filename or "kp.pdf"
        if not safe_filename.lower().endswith(".pdf"):
            safe_filename = f"{safe_filename}.pdf"
        pdf_stream.name = safe_filename

        # Надсилаємо PDF як документ
        await client.send_file(
            entity,
            file=pdf_stream,
            caption=caption,
            force_document=True,
        )


def send_kp_telegram(
    session_string: str,
    to_phone: str,
    pdf_content: bytes,
    pdf_filename: str,
    message: Optional[str] = None,
    api_id: Optional[int] = None,
    api_hash: Optional[str] = None,
) -> None:
    """
    Синхронна обгортка над асинхронною функцією відправки.
    Викликається з роутів FastAPI.
    
    Args:
        session_string: Session string для Telegram акаунта
        to_phone: Номер телефону отримувача
        pdf_content: Вміст PDF файлу
        pdf_filename: Ім'я PDF файлу
        message: Додаткове повідомлення
        api_id: API ID для цього акаунта (якщо не вказано - використовується глобальне)
        api_hash: API Hash для цього акаунта (якщо не вказано - використовується глобальне)
    """
    asyncio.run(
        _send_kp_telegram_async(
            session_string=session_string,
            to_phone=to_phone,
            pdf_content=pdf_content,
            pdf_filename=pdf_filename,
            message=message,
            api_id=api_id,
            api_hash=api_hash,
        )
    )


