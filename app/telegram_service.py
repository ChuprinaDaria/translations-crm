import os
import asyncio
from typing import Optional

from telethon import TelegramClient
from telethon.sessions import StringSession


TELEGRAM_API_ID = int(os.getenv("TELEGRAM_API_ID", "0"))
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH", "")
TELEGRAM_SENDER_NAME = os.getenv("TELEGRAM_SENDER_NAME", "BOX Catering")


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
    if not TELEGRAM_API_ID or not TELEGRAM_API_HASH:
        raise ValueError("TELEGRAM_API_ID / TELEGRAM_API_HASH не налаштовані в оточенні")

    # Створюємо клієнта Telethon з сесії користувача
    client = TelegramClient(StringSession(session_string), TELEGRAM_API_ID, TELEGRAM_API_HASH)

    async with client:
        # Шукаємо користувача за номером телефону
        try:
            entity = await client.get_entity(to_phone)
        except Exception as e:
            raise ValueError(f"Не вдалося знайти користувача з телефоном {to_phone}: {e}")

        caption = message or f"Комерційна пропозиція від {TELEGRAM_SENDER_NAME}"

        # Надсилаємо PDF як документ
        await client.send_file(
            entity,
            file=pdf_content,
            caption=caption,
            force_document=True,
            attributes=[],
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


