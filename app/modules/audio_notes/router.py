"""
Audio Notes API - транскрипція аудіо нотаток через Whisper API
"""
import os
import tempfile
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
from openai import OpenAI

router = APIRouter(prefix="/audio-notes", tags=["audio-notes"])

# OpenAI API ключ (потрібно додати в змінні оточення)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = None
if OPENAI_API_KEY:
    client = OpenAI(api_key=OPENAI_API_KEY)


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    order_id: str = Form(...),
):
    """
    Транскрибує аудіо нотатку в текст за допомогою Whisper API.
    """
    if not client:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API ключ не налаштований. Додайте OPENAI_API_KEY в змінні оточення."
        )

    try:
        # Зберігаємо тимчасовий файл
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_file:
            content = await audio.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name

        try:
            # Відкриваємо файл для Whisper API
            with open(tmp_file_path, "rb") as audio_file:
                # Викликаємо Whisper API
                transcript = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="uk",  # Українська мова
                )

            text = transcript.text

            return JSONResponse(
                content={
                    "text": text,
                    "order_id": order_id,
                }
            )
        finally:
            # Видаляємо тимчасовий файл
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Помилка транскрипції аудіо: {str(e)}"
        )
