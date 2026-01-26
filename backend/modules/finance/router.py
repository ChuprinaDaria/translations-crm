"""
Finance routes - payments, accounting endpoints з scope-based доступом.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.rbac import require_scope, Scope, filter_by_scope, get_user_scopes
from modules.auth.dependencies import get_current_user_db, role_required
from modules.auth.models import UserRole
from modules.finance.models import Transaction, PaymentMethod
from modules.crm.models import Order
from sqlalchemy.orm import joinedload
import models

router = APIRouter(tags=["finance"])


@router.get("/revenue")
def get_revenue(
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.MANAGER])),
):
    """
    Отримати виручку.
    Доступ: менеджери, продажі, бухгалтер, адмін.
    """
    from core.rbac import get_user_scopes
    
    # Фільтруємо на основі scope
    # Якщо менеджер - показуємо всі продажі
    # Якщо sales-manager - показуємо тільки свої продажі
    
    user_scopes = get_user_scopes(user)
    
    if Scope.FINANCE_VIEW_REVENUE in user_scopes:
        # TODO: Реалізувати розрахунок виручки
        return {"revenue": 0, "currency": "UAH"}


@router.get("/profit")
def get_profit(
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER, UserRole.ACCOUNTANT])),
):
    """
    Отримати прибуток (чистий прибуток).
    Доступ: ТІЛЬКИ бухгалтер та адмін.
    Менеджер НЕ бачить цей endpoint (403).
    """
    # TODO: Реалізувати розрахунок прибутку
    # Прибуток = Виручка - Витрати
    return {"profit": 0, "currency": "UAH", "note": "Only accountant and admin can see this"}


@router.get("/costs")
def get_costs(
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER, UserRole.ACCOUNTANT])),
):
    """
    Отримати витрати.
    Доступ: бухгалтер, адмін.
    """
    # TODO: Реалізувати розрахунок витрат
    return {"costs": 0, "currency": "UAH"}


@router.get("/payments")
def get_payments(
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER, UserRole.ACCOUNTANT, UserRole.MANAGER])),
):
    """
    Отримати список платежів (транзакцій).
    Менеджери бачать тільки свої платежі.
    Бухгалтер та адмін бачать всі.
    """
    user_scopes = get_user_scopes(user)
    
    # Запит транзакцій з завантаженням order та client
    query = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.order).joinedload(Order.client)
        )
        .order_by(Transaction.payment_date.desc())
    )
    
    # Фільтрація на основі scope
    if Scope.CRM_VIEW_ALL not in user_scopes and Scope.ADMIN_ALL not in user_scopes:
        # Тільки свої платежі (де order.manager_id == user.id)
        query = query.join(Order).filter(Order.manager_id == user.id)
    
    transactions = query.all()
    
    # Формуємо відповідь
    payments = []
    for idx, trans in enumerate(transactions, 1):
        order = trans.order
        client = order.client if order else None
        buyer_name = client.full_name if client else "N/A"
        
        payment_data = {
            "id": str(trans.id),
            "lp": idx,  # Порядковий номер
            "order_number": order.order_number if order else "N/A",
            "service_date": trans.service_date.isoformat() if trans.service_date else None,
            "buyer_name": buyer_name,
            "amount_gross": float(trans.amount_gross),
            "payment_date": trans.payment_date.isoformat() if trans.payment_date else None,
            "posting_date": trans.posting_date.isoformat() if trans.posting_date else None,
            "payment_method": trans.payment_method.value if isinstance(trans.payment_method, PaymentMethod) else trans.payment_method,
            "receipt_number": trans.receipt_number,
            "notes": trans.notes,
        }
        payments.append(payment_data)
    
    return {"payments": payments}


@router.get("/payments/export")
def export_payments_excel(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user_db),
):
    """
    Експортувати платежі в Excel.
    Менеджери бачать тільки свої платежі.
    Бухгалтер та адмін бачать всі.
    """
    from fastapi.responses import Response
    from datetime import datetime
    from io import BytesIO
    
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
        from openpyxl.utils import get_column_letter
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl is required for Excel export")
    
    user_scopes = get_user_scopes(user)
    
    # Запит транзакцій з завантаженням order та client
    query = (
        db.query(Transaction)
        .options(
            joinedload(Transaction.order).joinedload(Order.client)
        )
        .order_by(Transaction.payment_date.desc())
    )
    
    # Фільтрація на основі scope
    if Scope.CRM_VIEW_ALL not in user_scopes and Scope.ADMIN_ALL not in user_scopes:
        # Тільки свої платежі (де order.manager_id == user.id)
        query = query.join(Order).filter(Order.manager_id == user.id)
    
    transactions = query.all()
    
    # Створюємо Excel workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Płatności"
    
    # Стилі
    header_font = Font(bold=True, color="000000")
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Кольори для заголовків (згідно з зображенням)
    header_colors = [
        "90EE90",  # LP - зелений
        "87CEEB",  # Numer zlecenia - синій
        "DDA0DD",  # Data wykonania usługi - фіолетовий
        "FFD700",  # Nabywca - жовтий
        "FFA500",  # Kwota płatności brutto - помаранчевий
        "FFB6C1",  # Data płatności - світло-червоний
        "87CEEB",  # Data nabicia na KF - синій
        "FFC0CB",  # Sposób płatności - рожевий
        "FFB6C1",  # Numer dowodu sprzedaży - світло-червоний
        "D3D3D3",  # Uwagi - сірий
    ]
    
    # Заголовки
    headers = [
        "LP",
        "Numer zlecenia",
        "Data wykonania usługi",
        "Nabywca (Imię i nazwisko)",
        "Kwota płatności brutto",
        "Data płatności",
        "Data nabicia na KF",
        "Sposób płatności",
        "Numer dowodu sprzedaży",
        "Uwagi",
    ]
    
    for col_idx, (header, color) in enumerate(zip(headers, header_colors), 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    
    # Дані
    for row_idx, trans in enumerate(transactions, 2):
        order = trans.order
        client = order.client if order else None
        buyer_name = client.full_name if client else "N/A"
        
        # Форматування способу оплати
        payment_method_map = {
            "transfer": "Przelew",
            "card": "Karta",
            "blik": "BLIK",
            "cash": "Gotówka",
        }
        payment_method_display = payment_method_map.get(
            trans.payment_method.value if isinstance(trans.payment_method, PaymentMethod) else trans.payment_method,
            str(trans.payment_method)
        )
        
        # Форматування дат
        def format_date(d):
            if d:
                return d.strftime("%d.%m.%Y")
            return ""
        
        row_data = [
            row_idx - 1,  # LP
            order.order_number if order else "N/A",
            format_date(trans.service_date),
            buyer_name,
            float(trans.amount_gross),
            format_date(trans.payment_date),
            format_date(trans.posting_date),
            payment_method_display,
            trans.receipt_number,
            trans.notes or "",
        ]
        
        for col_idx, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = thin_border
            if col_idx == 5:  # Kwota płatności brutto
                cell.number_format = '#,##0.00'
                cell.alignment = Alignment(horizontal="right")
            elif col_idx in [3, 6, 7]:  # Дати
                cell.alignment = Alignment(horizontal="center")
    
    # Налаштування ширини колонок
    column_widths = [5, 25, 18, 25, 20, 15, 18, 18, 25, 30]
    for col_idx, width in enumerate(column_widths, 1):
        ws.column_dimensions[get_column_letter(col_idx)].width = width
    
    # Зберігаємо в BytesIO
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    # Формуємо назву файлу
    filename = f"platnosci_{datetime.now().strftime('%Y%m%d')}.xlsx"
    
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@router.get("/accounting")
def get_accounting(
    db: Session = Depends(get_db),
    user: models.User = Depends(role_required([UserRole.OWNER, UserRole.ACCOUNTANT])),
):
    """
    Отримати бухгалтерські звіти.
    Доступ: ТІЛЬКИ бухгалтер та адмін.
    """
    # TODO: Реалізувати бухгалтерські звіти
    return {"reports": []}
