"""
Finance routes - payments, accounting endpoints з scope-based доступом.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.rbac import require_scope, Scope, filter_by_scope, get_user_scopes
from modules.auth.dependencies import get_current_user_db
import models

router = APIRouter(prefix="/finance", tags=["finance"])


@router.get("/revenue")
def get_revenue(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_scope(Scope.FINANCE_VIEW_REVENUE)),
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
    user: models.User = Depends(require_scope(Scope.FINANCE_VIEW_PROFIT)),
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
    user: models.User = Depends(require_scope(Scope.FINANCE_VIEW_COSTS)),
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
    user: models.User = Depends(get_current_user_db),
):
    """
    Отримати список платежів.
    Менеджери бачать тільки свої платежі.
    Бухгалтер та адмін бачать всі.
    """
    user_scopes = get_user_scopes(user)
    
    # TODO: Реалізувати отримання платежів з фільтрацією
    # Якщо CRM_VIEW_ALL - показуємо всі
    # Інакше - тільки свої
    
    return {"payments": []}


@router.get("/accounting")
def get_accounting(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_scope(Scope.FINANCE_VIEW_PROFIT)),
):
    """
    Отримати бухгалтерські звіти.
    Доступ: ТІЛЬКИ бухгалтер та адмін.
    """
    # TODO: Реалізувати бухгалтерські звіти
    return {"reports": []}
