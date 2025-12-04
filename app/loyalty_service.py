from datetime import datetime, date
from decimal import Decimal
from sqlalchemy.orm import Session
from . import models

# Рівні лояльності
LOYALTY_TIERS = {
    "silver": {
        "min_spent": 0,
        "max_spent": 150000,
        "cashback_rate": 3.0,
        "benefits": []
    },
    "gold": {
        "min_spent": 150000,
        "max_spent": 300000,
        "cashback_rate": 5.0,
        "benefits": []
    },
    "platinum": {
        "min_spent": 300000,
        "max_spent": 600000,
        "cashback_rate": 7.0,
        "benefits": [
            "Персональний менеджер",
            "Ранній доступ до сезонних меню",
            "Святкові подарунки від DZYGA"
        ]
    },
    "diamond": {
        "min_spent": 600000,
        "max_spent": float('inf'),
        "cashback_rate": 10.0,
        "benefits": [
            "Персональний менеджер",
            "Ранній доступ до сезонних меню",
            "Святкові подарунки від DZYGA",
            "Пріоритетне бронювання у високий сезон",
            "1 раз на рік — фотограф на 1 годину або робот DZYGA"
        ]
    }
}

MAX_CASHBACK_USAGE_PERCENT = 30  # Максимум 30% можна оплатити кешбеком


def calculate_loyalty_tier(lifetime_spent: Decimal) -> tuple[str, Decimal]:
    """
    Розрахунок рівня лояльності на основі загальної суми за весь час
    Returns: (tier_name, cashback_rate)
    """
    lifetime_spent = float(lifetime_spent)
    
    for tier_name in ["diamond", "platinum", "gold", "silver"]:
        tier = LOYALTY_TIERS[tier_name]
        if lifetime_spent >= tier["min_spent"]:
            return tier_name, Decimal(str(tier["cashback_rate"]))
    
    return "silver", Decimal("3.0")


def update_client_loyalty_tier(db: Session, client: models.Client):
    """
    Оновлення рівня лояльності клієнта
    """
    # Якщо індивідуальні умови - не чіпаємо
    if client.is_custom_rate:
        return
    
    # Розрахунок нового рівня
    new_tier, new_rate = calculate_loyalty_tier(client.lifetime_spent)
    
    # Оновлення якщо змінився
    if client.loyalty_tier != new_tier:
        client.loyalty_tier = new_tier
        client.cashback_rate = new_rate
        db.commit()


def calculate_cashback_for_kp(
    menu_total: Decimal,
    cashback_rate: Decimal
) -> Decimal:
    """
    Розрахунок кешбеку для КП
    Кешбек нараховується ТІЛЬКИ на меню (їжу)
    """
    return (menu_total * cashback_rate / 100).quantize(Decimal("0.01"))


def validate_cashback_usage(
    total_amount: Decimal,
    cashback_to_use: Decimal,
    client_balance: Decimal,
    client_expires_at: date = None
) -> tuple[bool, str, Decimal]:
    """
    Перевірка чи можна використати кешбек
    Returns: (is_valid, error_message, max_allowed_cashback)
    """
    # Максимально дозволений кешбек (30% від суми)
    max_allowed = (total_amount * MAX_CASHBACK_USAGE_PERCENT / 100).quantize(Decimal("0.01"))
    
    # Перевірка 1: Чи не перевищує 30%
    if cashback_to_use > max_allowed:
        return False, f"Кешбеком можна оплатити максимум 30% ({max_allowed} грн)", max_allowed
    
    # Перевірка 2: Чи вистачає на балансі
    if cashback_to_use > client_balance:
        return False, f"Недостатньо кешбеку. Доступно: {client_balance} грн", max_allowed
    
    # Перевірка 3: Чи не згорів кешбек
    if client_expires_at:
        today = date.today()
        if client_balance > 0 and today > client_expires_at:
            return False, "Кешбек згорів (кінець року)", max_allowed
    
    return True, "", max_allowed


def apply_cashback_to_kp(
    db: Session,
    kp: models.KP,
    cashback_to_use: Decimal
) -> models.CashbackTransaction:
    """
    Використання кешбеку для оплати КП
    """
    client = kp.client
    
    if not client:
        raise ValueError("КП не пов'язано з клієнтом")
    
    # Валідація
    is_valid, error, _ = validate_cashback_usage(
        Decimal(str(kp.total_amount)),
        cashback_to_use,
        Decimal(str(client.cashback_balance)),
        client.cashback_expires_at
    )
    
    if not is_valid:
        raise ValueError(error)
    
    # Списання кешбеку
    client.cashback_balance = Decimal(str(client.cashback_balance)) - cashback_to_use
    client.cashback_used_total = Decimal(str(client.cashback_used_total)) + cashback_to_use
    
    # Оновлення КП
    kp.cashback_used = float(cashback_to_use)
    total_amount_decimal = Decimal(str(kp.total_amount)) if kp.total_amount else Decimal("0")
    kp.final_amount = float(total_amount_decimal - cashback_to_use)
    
    # Транзакція
    transaction = models.CashbackTransaction(
        client_id=client.id,
        kp_id=kp.id,
        transaction_type="used",
        amount=-cashback_to_use,
        balance_after=client.cashback_balance,
        description=f"Використано для оплати КП #{kp.id}"
    )
    db.add(transaction)
    db.commit()
    
    return transaction


def earn_cashback_from_kp(
    db: Session,
    kp: models.KP
) -> models.CashbackTransaction:
    """
    Нарахування кешбеку після створення/підтвердження КП
    """
    client = kp.client
    
    if not client:
        raise ValueError("КП не пов'язано з клієнтом")
    
    # Розрахунок кешбеку тільки на меню
    menu_total = Decimal(str(kp.menu_total)) if kp.menu_total else Decimal("0")
    cashback_rate = Decimal(str(client.cashback_rate)) if client.cashback_rate else Decimal("3.0")
    
    cashback_amount = calculate_cashback_for_kp(
        menu_total,
        cashback_rate
    )
    
    # Нарахування
    client.cashback_balance = Decimal(str(client.cashback_balance)) + cashback_amount
    client.cashback_earned_total = Decimal(str(client.cashback_earned_total)) + cashback_amount
    total_amount_decimal = Decimal(str(kp.total_amount)) if kp.total_amount else Decimal("0")
    client.lifetime_spent = Decimal(str(client.lifetime_spent)) + total_amount_decimal
    client.current_year_spent = Decimal(str(client.current_year_spent)) + total_amount_decimal
    client.total_orders += 1
    
    # Оновлення дати згоряння (31 грудня поточного року)
    current_year = datetime.now().year
    client.cashback_expires_at = date(current_year, 12, 31)
    
    # Оновлення КП
    kp.cashback_earned = float(cashback_amount)
    kp.cashback_rate_applied = float(cashback_rate)
    
    # Перевірка чи підвищився рівень
    update_client_loyalty_tier(db, client)
    
    # Транзакція
    transaction = models.CashbackTransaction(
        client_id=client.id,
        kp_id=kp.id,
        transaction_type="earned",
        amount=cashback_amount,
        balance_after=client.cashback_balance,
        description=f"Нараховано за КП #{kp.id} ({float(cashback_rate)}%)"
    )
    db.add(transaction)
    db.commit()
    
    return transaction


def expire_cashback_year_end(db: Session):
    """
    Cron job - Згоряння кешбеку в кінці року
    Запускати 1 січня
    """
    today = date.today()
    
    # Знайти всіх клієнтів з кешбеком що згорів
    clients = db.query(models.Client).filter(
        models.Client.cashback_balance > 0,
        models.Client.cashback_expires_at < today
    ).all()
    
    for client in clients:
        expired_amount = Decimal(str(client.cashback_balance))
        
        # Обнулення
        client.cashback_balance = Decimal("0")
        client.cashback_expires_at = date(today.year, 12, 31)
        client.current_year_spent = Decimal("0")  # Скинути поточний рік
        
        # Скинути бонуси Diamond
        client.yearly_photographer_used = False
        client.yearly_robot_used = False
        client.bonus_year = today.year
        
        # Транзакція
        transaction = models.CashbackTransaction(
            client_id=client.id,
            transaction_type="expired",
            amount=-expired_amount,
            balance_after=Decimal("0"),
            description=f"Кешбек згорів (кінець {today.year - 1} року)"
        )
        db.add(transaction)
    
    db.commit()
    print(f"Expired cashback for {len(clients)} clients")


def use_diamond_bonus(
    db: Session,
    client: models.Client,
    bonus_type: str  # "photographer" | "robot"
):
    """
    Використання річного бонусу для Diamond клієнтів
    """
    if client.loyalty_tier != "diamond":
        raise ValueError("Бонус доступний тільки для Diamond клієнтів")
    
    current_year = datetime.now().year
    
    # Перевірка чи не використано вже цього року
    if client.bonus_year != current_year:
        # Новий рік - скинути бонуси
        client.yearly_photographer_used = False
        client.yearly_robot_used = False
        client.bonus_year = current_year
    
    if bonus_type == "photographer":
        if client.yearly_photographer_used:
            raise ValueError("Бонус 'Фотограф' вже використано цього року")
        client.yearly_photographer_used = True
    elif bonus_type == "robot":
        if client.yearly_robot_used:
            raise ValueError("Бонус 'Робот' вже використано цього року")
        client.yearly_robot_used = True
    else:
        raise ValueError("Невідомий тип бонусу")
    
    db.commit()

