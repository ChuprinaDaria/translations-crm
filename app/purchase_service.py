from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from io import BytesIO
from typing import Dict, List, Tuple, Iterable

from sqlalchemy.orm import Session, joinedload

import models

try:
    from openpyxl import Workbook
except ImportError as e:  # pragma: no cover - захист на випадок проблем з залежностями
    raise RuntimeError("openpyxl is required for purchase Excel export") from e


def _load_kps_with_items(db: Session, kp_ids: List[int]) -> List[models.KP]:
    """
    Завантажує КП разом із позиціями меню, стравами та клієнтом.
    """
    return (
        db.query(models.KP)
        .options(
            joinedload(models.KP.items).joinedload(models.KPItem.item),
            joinedload(models.KP.client),
        )
        .filter(models.KP.id.in_(kp_ids))
        .all()
    )


def _iter_kp_items(kp: models.KP) -> Iterable[Tuple[int, str, float, str | None, float | None, float | None, float]]:
    """
    Повертає ітератор по позиціях КП у вигляді:
    (№, назва, кількість, одиниця, вага, ціна, сума)
    """
    index = 1
    for kp_item in kp.items:
        # Назва
        if kp_item.item and kp_item.item.name:
            name = kp_item.item.name
        elif kp_item.name:
            name = kp_item.name
        else:
            name = "Без назви"

        qty = kp_item.quantity or 0

        # Одиниця
        unit = None
        if kp_item.item and kp_item.item.unit:
            unit = kp_item.item.unit
        elif kp_item.unit:
            unit = kp_item.unit

        # Вага (на 1 од.)
        weight = None
        if kp_item.item and kp_item.item.weight is not None:
            weight = float(kp_item.item.weight)
        elif kp_item.weight is not None:
            weight = float(kp_item.weight)

        # Ціна (на 1 од.)
        price = None
        if kp_item.item and kp_item.item.price is not None:
            price = float(kp_item.item.price)
        elif kp_item.price is not None:
            price = float(kp_item.price)

        total = (price or 0.0) * qty

        yield index, name, qty, unit, weight, price, total
        index += 1


def _safe_sheet_title(base: str) -> str:
    """
    Робить безпечну назву для аркуша Excel (макс. 31 символ, без заборонених символів).
    """
    invalid_chars = set(r"[]:*?/\\")
    cleaned = "".join(c for c in base if c not in invalid_chars)
    if not cleaned:
        cleaned = "Sheet"
    if len(cleaned) > 31:
        cleaned = cleaned[:31]
    return cleaned


def _build_dish_totals(kps: List[models.KP]) -> Dict[str, Dict[str, float | str | None]]:
    """
    Формує агрегований словник страв:
    {
        "Назва страви": {"quantity": <загальна к-сть>, "unit": "шт/кг/..."}
    }
    """
    dish_totals: Dict[str, Dict[str, float | str | None]] = defaultdict(
        lambda: {"quantity": 0, "unit": None}
    )

    for kp in kps:
        for kp_item in kp.items:
            # Назва страви: спочатку з Item, потім з кастомної позиції
            name = None
            if kp_item.item and kp_item.item.name:
                name = kp_item.item.name
            elif kp_item.name:
                name = kp_item.name
            else:
                name = "Без назви"

            qty = kp_item.quantity or 0

            # Одиниця виміру
            unit = None
            if kp_item.item and kp_item.item.unit:
                unit = kp_item.item.unit
            elif kp_item.unit:
                unit = kp_item.unit

            entry = dish_totals[name]
            entry["quantity"] = (entry["quantity"] or 0) + qty
            if entry["unit"] is None and unit:
                entry["unit"] = unit

    return dish_totals


def generate_purchase_excel(db: Session, kp_ids: List[int]) -> Tuple[bytes, str]:
    """
    Генерує Excel-файл для закупки на основі вибраних КП.

    Повертає (bytes, filename).
    """
    if not kp_ids:
        raise ValueError("Список KP ID порожній")

    kps = _load_kps_with_items(db, kp_ids)
    if not kps:
        raise ValueError("Не знайдено жодного КП для вказаних ID")

    dish_totals = _build_dish_totals(kps)

    wb = Workbook()

    # ---------- Лист "Закупка" (агрегація по всіх КП) ----------
    ws_purchase = wb.active
    ws_purchase.title = "Закупка"
    ws_purchase.append(["Страва", "Одиниця", "Кількість"])

    for name, data in sorted(dish_totals.items(), key=lambda x: str(x[0])):
        ws_purchase.append(
            [
                name,
                data.get("unit") or "",
                data.get("quantity") or 0,
            ]
        )

    # ---------- Лист "КП" з деталями ----------
    ws_kps = wb.create_sheet("КП")
    ws_kps.append(
        [
            "KP ID",
            "Назва КП",
            "Клієнт",
            "Дата події",
            "Локація",
            "К-сть гостей",
            "Статус",
            "Сума загальна",
        ]
    )

    for kp in kps:
        client_name = kp.client_name or (kp.client.name if kp.client else "")
        event_date_str = ""
        if kp.event_date:
            if isinstance(kp.event_date, datetime):
                event_date_str = kp.event_date.strftime("%Y-%m-%d")
            else:
                # На випадок, якщо це date
                event_date_str = str(kp.event_date)

        ws_kps.append(
            [
                kp.id,
                kp.title,
                client_name,
                event_date_str,
                kp.event_location or "",
                kp.people_count or 0,
                kp.status or "",
                float(kp.total_amount or 0),
            ]
        )

    # ---------- Окремі листи "Меню {клієнт}" для кожного КП ----------
    for kp in kps:
        client_name = kp.client_name or (kp.client.name if kp.client else "")
        menu_title = client_name or kp.title or f"KP {kp.id}"
        ws_menu = wb.create_sheet(_safe_sheet_title(f"Меню {menu_title}"))

        # Шапка, максимально наближена до Excel Роми
        # Рядок 1: Дата
        ws_menu["A1"] = "Дата проведення:"
        if kp.event_date:
            if isinstance(kp.event_date, datetime):
                ws_menu["B1"] = kp.event_date.strftime("%d.%m.%Y")
            else:
                ws_menu["B1"] = str(kp.event_date)

        # Рядок 2: Замовник
        ws_menu["A2"] = "Замовник:"
        ws_menu["B2"] = client_name

        # Рядок 3: Локація
        ws_menu["A3"] = "Місце проведення:"
        ws_menu["B3"] = kp.event_location or ""

        # Рядок 4: Формат / назва проекту
        ws_menu["A4"] = "Назва проекту (привід):"
        ws_menu["B4"] = kp.event_format or kp.title or ""

        # Рядок 5: Кількість осіб
        ws_menu["A5"] = "Кількість осіб:"
        ws_menu["B5"] = kp.people_count or 0

        # Рядок 6: Коментар (поки залишаємо порожнім)
        ws_menu["A6"] = "Коментар:"

        # Рядок 7: заголовок таблиці меню
        ws_menu.append(
            [
                "№ п/п",
                "Назва страви",
                "Кількість",
                "Одиниця",
                "Вага, г",
                "Ціна, грн",
                "Сума, грн",
            ]
        )

        # Рядки з позиціями меню, починаючи з 8-го
        for index, name, qty, unit, weight, price, total in _iter_kp_items(kp):
            ws_menu.append(
                [
                    index,
                    name,
                    qty,
                    unit or "",
                    weight or "",
                    price or "",
                    total,
                ]
            )

    # ---------- (Майбутнє) Листи "техкарта {клієнт}" ----------
    # Поки що створюємо спрощений варіант: список страв і їх кількості по кожному КП,
    # щоб наблизити структуру до скриптів Роми і мати основу під інтеграцію з файлом техкарт.
    for kp in kps:
        client_name = kp.client_name or (kp.client.name if kp.client else "")
        tech_title = client_name or kp.title or f"KP {kp.id}"
        ws_tech = wb.create_sheet(_safe_sheet_title(f"техкарта {tech_title}"))

        ws_tech.append(["Назва страви", "Кількість", "Одиниця"])

        # Агрегуємо страви в межах одного КП
        local_totals: Dict[str, Dict[str, float | str | None]] = defaultdict(
            lambda: {"quantity": 0, "unit": None}
        )
        for _idx, name, qty, unit, _weight, _price, _total in _iter_kp_items(kp):
            entry = local_totals[name]
            entry["quantity"] = (entry["quantity"] or 0) + qty
            if entry["unit"] is None and unit:
                entry["unit"] = unit

        for name, data in sorted(local_totals.items(), key=lambda x: str(x[0])):
            ws_tech.append(
                [
                    name,
                    data.get("quantity") or 0,
                    data.get("unit") or "",
                ]
            )

    # Збереження у bytes
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    # Ім'я файлу: якщо всі КП з однієї дати — використовуємо її, інакше без дати
    unique_dates = {
        (kp.event_date.date() if isinstance(kp.event_date, datetime) else kp.event_date)
        for kp in kps
        if kp.event_date
    }
    if len(unique_dates) == 1:
        only_date = next(iter(unique_dates))
        filename = f"purchase_{only_date}.xlsx"
    else:
        filename = "purchase.xlsx"

    return buffer.getvalue(), filename


