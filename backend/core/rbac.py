"""
Role-Based Access Control (RBAC) з scope-based доступом.
Підтримує ролі та scopes для контролю доступу до даних.
"""
from enum import Enum
from typing import List, Set, Optional
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_user_payload
import models


class Scope(str, Enum):
    """Scopes для контролю доступу до даних."""
    # CRM scopes
    CRM_VIEW_ALL = "crm:view:all"  # Перегляд всіх клієнтів
    CRM_VIEW_OWN = "crm:view:own"  # Перегляд тільки своїх клієнтів
    CRM_EDIT_ALL = "crm:edit:all"  # Редагування всіх клієнтів
    CRM_EDIT_OWN = "crm:edit:own"  # Редагування тільки своїх клієнтів
    
    # Finance scopes
    FINANCE_VIEW_REVENUE = "finance:view:revenue"  # Перегляд виручки
    FINANCE_VIEW_PROFIT = "finance:view:profit"  # Перегляд прибутку (тільки адмін/бухгалтер)
    FINANCE_VIEW_COSTS = "finance:view:costs"  # Перегляд витрат
    FINANCE_EDIT = "finance:edit"  # Редагування фінансів
    
    # Analytics scopes
    ANALYTICS_VIEW_ALL = "analytics:view:all"  # Перегляд всієї аналітики
    ANALYTICS_VIEW_OWN = "analytics:view:own"  # Перегляд тільки своєї аналітики
    
    # Admin scopes
    ADMIN_ALL = "admin:all"  # Повний доступ (тільки адмін)


# Мапінг ролей на scopes
ROLE_SCOPES: dict[str, List[Scope]] = {
    "admin": [
        Scope.ADMIN_ALL,
        Scope.CRM_VIEW_ALL,
        Scope.CRM_EDIT_ALL,
        Scope.FINANCE_VIEW_REVENUE,
        Scope.FINANCE_VIEW_PROFIT,
        Scope.FINANCE_VIEW_COSTS,
        Scope.FINANCE_EDIT,
        Scope.ANALYTICS_VIEW_ALL,
    ],
    "manager": [
        Scope.CRM_VIEW_ALL,
        Scope.CRM_EDIT_ALL,
        Scope.FINANCE_VIEW_REVENUE,  # Менеджер бачить виручку
        # НЕ бачить FINANCE_VIEW_PROFIT - це тільки для адміна/бухгалтера
        Scope.ANALYTICS_VIEW_ALL,
    ],
    "sales-manager": [
        Scope.CRM_VIEW_OWN,
        Scope.CRM_EDIT_OWN,
        Scope.FINANCE_VIEW_REVENUE,  # Бачить виручку від своїх продажів
        Scope.ANALYTICS_VIEW_OWN,
    ],
    "accountant": [
        Scope.CRM_VIEW_ALL,  # Бухгалтер бачить всіх клієнтів для звітів
        Scope.FINANCE_VIEW_REVENUE,
        Scope.FINANCE_VIEW_PROFIT,  # Бухгалтер бачить прибуток
        Scope.FINANCE_VIEW_COSTS,
        Scope.FINANCE_EDIT,
        Scope.ANALYTICS_VIEW_ALL,
    ],
    "user": [
        Scope.CRM_VIEW_OWN,
        Scope.CRM_EDIT_OWN,
        Scope.ANALYTICS_VIEW_OWN,
    ],
}


def get_user_scopes(user: models.User) -> Set[Scope]:
    """
    Отримати scopes користувача на основі його ролі.
    
    Args:
        user: Об'єкт користувача
        
    Returns:
        Множина scopes
    """
    role = user.role or "user"
    scopes = ROLE_SCOPES.get(role, ROLE_SCOPES["user"])
    
    # Якщо адмін, додаємо всі scopes
    if user.is_admin:
        scopes = list(Scope)
    
    return set(scopes)


def require_scope(*required_scopes: Scope):
    """
    Dependency для перевірки наявності scope у користувача.
    
    Використання:
        @router.get("/finance/profit")
        def get_profit(user: User = Depends(require_scope(Scope.FINANCE_VIEW_PROFIT))):
            ...
    """
    def scope_checker(
        user_payload: dict = Depends(get_current_user_payload),
        db: Session = Depends(get_db),
    ) -> models.User:
        from uuid import UUID
        user_id_str = user_payload.get("sub")
        if not user_id_str:
            raise HTTPException(status_code=401, detail="Invalid token")
        try:
            user_id = UUID(user_id_str)
        except (ValueError, TypeError):
            raise HTTPException(status_code=401, detail="Invalid user ID in token")
        
        user = db.query(models.User).filter(models.User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_scopes = get_user_scopes(user)
        
        # Перевіряємо чи є хоча б один з необхідних scopes
        if not any(scope in user_scopes for scope in required_scopes):
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required: {[s.value for s in required_scopes]}"
            )
        
        return user
    
    return scope_checker


def check_scope(user: models.User, scope: Scope) -> bool:
    """
    Перевірити чи має користувач певний scope.
    
    Args:
        user: Об'єкт користувача
        scope: Scope для перевірки
        
    Returns:
        True якщо користувач має scope
    """
    user_scopes = get_user_scopes(user)
    return scope in user_scopes


def filter_by_scope(query, model_class, user: models.User, owner_field: str = "created_by_id"):
    """
    Фільтрувати запит на основі scope користувача.
    
    Args:
        query: SQLAlchemy query
        model_class: Клас моделі
        user: Об'єкт користувача
        owner_field: Поле яке вказує на власника
        
    Returns:
        Відфільтрований query
    """
    user_scopes = get_user_scopes(user)
    
    # Якщо має CRM_VIEW_ALL або адмін - показуємо все
    if Scope.CRM_VIEW_ALL in user_scopes or Scope.ADMIN_ALL in user_scopes:
        return query
    
    # Інакше показуємо тільки свої записи
    if Scope.CRM_VIEW_OWN in user_scopes:
        return query.filter(getattr(model_class, owner_field) == user.id)
    
    # Якщо немає жодного scope - порожній результат
    return query.filter(False)

