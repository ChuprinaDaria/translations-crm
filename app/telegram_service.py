import os
import asyncio
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
) -> None:
    """
    Відправляє PDF‑файл КП користувачу в Telegram за номером телефону.
    Працює від імені звичайного акаунта (не бота).
    """
    cfg = _load_telegram_config()
    api_id = cfg["api_id"]
    api_hash = cfg["api_hash"]
    sender_name = cfg["sender_name"]

    if not api_id or not api_hash:
        raise ValueError("Telegram API налаштування не задані. Заповніть їх у налаштуваннях системи.")

    # Створюємо клієнта Telethon з сесії користувача
    client = TelegramClient(StringSession(session_string), api_id, api_hash)

    async with client:
        # Шукаємо користувача за номером телефону
        try:
            entity = await client.get_entity(to_phone)
        except Exception as e:
            raise ValueError(f"Не вдалося знайти користувача з телефоном {to_phone}: {e}")

        caption = message or f"Комерційна пропозиція від {sender_name}"

        # Надсилаємо PDF як документ
        await client.send_file(
            entity,
            file=pdf_content,
            caption=caption,
            force_document=True,
            filename=pdf_filename,
        )


def send_kp_telegram(
    session_string: str,
    to_phone: str,
    pdf_content: bytes,
    pdf_filename: str,
    message: Optional[str] = None,
) -> None:
    """
    Синхронна обгортка над асинхронною функцією відправки.
    Викликається з роутів FastAPI.
    """
    asyncio.run(
        _send_kp_telegram_async(
            session_string=session_string,
            to_phone=to_phone,
            pdf_content=pdf_content,
            pdf_filename=pdf_filename,
            message=message,
        )
    )


