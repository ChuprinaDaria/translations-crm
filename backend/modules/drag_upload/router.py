"""
Drag Upload API - завантаження файлів перетягуванням
"""
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional

router = APIRouter(prefix="/drag-upload", tags=["drag-upload"])

# Директорія для завантаження файлів
BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = BASE_DIR / "uploads" / "order_files"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    order_id: str = Form(...),
):
    """
    Завантажує файл для замовлення через drag-and-drop.
    """
    try:
        # Генеруємо унікальне ім'я файлу
        file_ext = Path(file.filename).suffix
        file_id = str(uuid.uuid4())
        filename = f"{order_id}_{file_id}{file_ext}"
        file_path = UPLOADS_DIR / filename

        # Зберігаємо файл
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)

        # Формуємо URL для доступу до файлу
        file_url = f"/uploads/order_files/{filename}"

        return JSONResponse(
            content={
                "url": file_url,
                "filename": filename,
                "size": len(content),
                "content_type": file.content_type,
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка завантаження файлу: {str(e)}")

