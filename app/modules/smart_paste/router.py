"""
Smart Paste API - парсинг тексту з буфера обміну
"""
import re
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/smart-paste", tags=["smart-paste"])


class ParseRequest(BaseModel):
    text: str


class ParseResponse(BaseModel):
    client_name: Optional[str] = None
    event_date: Optional[str] = None
    event_location: Optional[str] = None
    event_time: Optional[str] = None
    coordinator_name: Optional[str] = None
    coordinator_phone: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    event_format: Optional[str] = None
    people_count: Optional[int] = None
    language: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


def parse_order_text(text: str) -> ParseResponse:
    """
    Парсить текст заявки з мейлу/WhatsApp і витягує структуровані дані.
    Використовує regex для витягування ключових полів.
    """
    result = ParseResponse()

    # Номер замовлення (N/01/02/01/26/dnk)
    order_pattern = r'N[/\-]\d{2}[/\-]\d{2}[/\-]\d{2}[/\-]\d{2}[/\-]\w+'
    order_match = re.search(order_pattern, text)
    if order_match:
        result.notes = f"Номер замовлення: {order_match.group()}"

    # Ім'я клієнта (різні варіанти)
    name_patterns = [
        r'(?:Клієнт|Контакт|Ім\'я|Name)[:\s]+([А-ЯІЇЄҐ][а-яіїєґ\']+\s+[А-ЯІЇЄҐ][а-яіїєґ\']+)',
        r'^([А-ЯІЇЄҐ][а-яіїєґ\']+\s+[А-ЯІЇЄҐ][а-яіїєґ\']+)',
    ]
    for pattern in name_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            result.client_name = match.group(1).strip()
            break

    # Телефон
    phone_patterns = [
        r'(\+?38\s?\(?\d{3}\)?\s?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})',
        r'(0\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})',
    ]
    for pattern in phone_patterns:
        match = re.search(pattern, text)
        if match:
            phone = re.sub(r'[\s\-\(\)]', '', match.group(1))
            if not result.client_phone:
                result.client_phone = phone
            elif not result.coordinator_phone:
                result.coordinator_phone = phone
            break

    # Email
    email_pattern = r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
    email_match = re.search(email_pattern, text)
    if email_match:
        result.client_email = email_match.group(1)

    # Дата (різні формати)
    date_patterns = [
        r'(\d{1,2}[./]\d{1,2}[./]\d{2,4})',
        r'(\d{1,2}\s+(?:січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)\s+\d{4})',
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                date_str = match.group(1)
                # Спробуємо розпарсити дату
                result.event_date = date_str
            except:
                pass
            break

    # Час
    time_pattern = r'(\d{1,2}[:.]\d{2})'
    time_match = re.search(time_pattern, text)
    if time_match:
        result.event_time = time_match.group(1).replace('.', ':')

    # Кількість осіб
    people_patterns = [
        r'(\d+)\s*(?:осіб|людей|гостей|персон)',
        r'на\s+(\d+)\s*(?:осіб|людей|гостей)',
    ]
    for pattern in people_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result.people_count = int(match.group(1))
            break

    # Мова перекладу
    language_patterns = [
        r'(?:мова|language)[:\s]+([а-яіїєґА-ЯІЇЄҐ\w]+)',
        r'(?:переклад|translation)[:\s]+([а-яіїєґА-ЯІЇЄҐ\w]+)',
    ]
    for pattern in language_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result.language = match.group(1).strip()
            break

    # Тип оплати
    payment_patterns = [
        r'(?:оплата|payment)[:\s]+([а-яіїєґА-ЯІЇЄҐ\w\s]+)',
        r'(готівка|картка|безготівковий|накладний)',
    ]
    for pattern in payment_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result.payment_method = match.group(1).strip()
            break

    # Локація
    location_patterns = [
        r'(?:адреса|локація|location|місце)[:\s]+([А-ЯІЇЄҐ][А-ЯІЇЄҐа-яіїєґ\s,\d\-]+)',
    ]
    for pattern in location_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result.event_location = match.group(1).strip()
            break

    # Формат заходу
    format_patterns = [
        r'(?:формат|format)[:\s]+([а-яіїєґА-ЯІЇЄҐ\w\s]+)',
        r'(кейтеринг|фуршет|банкет|бокси|кава-пауза)',
    ]
    for pattern in format_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            result.event_format = match.group(1).strip()
            break

    return result


@router.post("/parse-order", response_model=ParseResponse)
def parse_order(request: ParseRequest):
    """
    Парсить текст заявки з буфера обміну.
    Використовує regex для витягування структурованих даних.
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Текст не може бути порожнім")

    try:
        result = parse_order_text(request.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка парсингу: {str(e)}")

