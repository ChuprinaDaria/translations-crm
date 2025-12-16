"""
Сервіс для роботи з техкартами (рецептами) та імпорту файлу калькуляцій.

Підтримує два типи техкарт:
- catering: проста структура (страва → інгредієнти)
  Формула: вага_інгредієнта × кількість_порцій
  
- box: трирівнева структура (страва → компоненти → інгредієнти)
  Формула: вага_інгредієнта × кількість_компонентів × кількість_порцій
"""

from __future__ import annotations

from io import BytesIO
from typing import Dict, List, Tuple, Literal, Optional
from collections import defaultdict

from sqlalchemy.orm import Session, joinedload

import models

try:
    from openpyxl import load_workbook
except ImportError as e:
    raise RuntimeError("openpyxl is required for recipe import") from e


# ============ Константи маркерів ============
MARKER_POINT = "point"  # Маркер початку страви
MARKER_IN = "in"        # Маркер компонента боксу

# Список помилок Excel, які потрібно ігнорувати
EXCEL_ERRORS = {'#REF!', '#N/A', '#VALUE!', '#DIV/0!', '#NAME?', '#NULL!', '#NUM!', '#ERROR!'}

# Максимальна довжина назви продукту в базі
MAX_PRODUCT_NAME_LENGTH = 500


def is_cooking_step(text: str) -> bool:
    """
    Перевіряє, чи є текст кроком приготування, а не назвою інгредієнта.
    
    Кроки приготування зазвичай:
    - Починаються з цифри та крапки (1., 2., 3.)
    - Містять дієслова у наказовому способі (Змішайте, Додайте, Подавайте)
    - Довші за 100 символів
    """
    if not text or not isinstance(text, str):
        return False
    
    text = text.strip()
    
    # Перевірка на крок з номером (1., 2., 3. і т.д.)
    import re
    if re.match(r'^\d+\.\s', text):
        return True
    
    # Перевірка на довгий текст з дієсловами приготування
    cooking_verbs = [
        'змішайте', 'додайте', 'подавайте', 'запікайте', 'варіть', 
        'смажте', 'нарізати', 'нарізайте', 'залиште', 'охолодіть',
        'перемішайте', 'помістіть', 'сформуйте', 'обверніть', 'викладіть',
        'накрийте', 'зачекайте', 'дайте', 'поставте'
    ]
    
    text_lower = text.lower()
    if len(text) > 100 and any(verb in text_lower for verb in cooking_verbs):
        return True
    
    return False


def clean_product_name(name: str) -> str:
    """
    Очищає та обрізає назву продукту для збереження в базі.
    """
    if not name:
        return ""
    
    # Видаляємо зайві пробіли
    cleaned = str(name).strip()
    
    # Обрізаємо до максимальної довжини
    if len(cleaned) > MAX_PRODUCT_NAME_LENGTH:
        cleaned = cleaned[:MAX_PRODUCT_NAME_LENGTH - 3] + "..."
    
    return cleaned


def safe_float(value, default: float = 0.0) -> Optional[float]:
    """
    Безпечно конвертує значення в float, ігноруючи помилки Excel.
    
    Args:
        value: Значення з клітинки Excel
        default: Значення за замовчуванням якщо конвертація неможлива
    
    Returns:
        float або None
    """
    if value is None:
        return None
    
    # Якщо це вже число - повертаємо
    if isinstance(value, (int, float)):
        return float(value)
    
    # Конвертуємо в строку для перевірки
    str_value = str(value).strip()
    
    # Перевіряємо на помилки Excel
    if str_value.upper() in EXCEL_ERRORS or str_value.startswith('#'):
        return default
    
    # Якщо порожня строка
    if not str_value:
        return None
    
    # Спробуємо конвертувати
    try:
        return float(str_value.replace(',', '.'))
    except (ValueError, TypeError):
        return default


# ============ Імпорт техкарт ============

def import_calculations_file(
    db: Session, 
    file_content: bytes, 
    recipe_type: Literal["catering", "box"] = "catering"
) -> Dict:
    """
    Імпортує файл калькуляцій (техкарт) у форматі Excel.
    
    Структура файлу:
    - Лист "калькуляции": техкарти страв
      - Колонка A: категорія або кількість
      - Колонка C: назва страви/інгредієнта
      - Колонка E: вага в грамах
      - Колонка G: маркер 'point' для початку техкарти, 'in' для компонента (бокси)
    
    - Лист "список продуктов": словник продуктів
    
    Args:
        db: Сесія бази даних
        file_content: Вміст Excel файлу
        recipe_type: Тип техкарт ('catering' або 'box')
    
    Повертає словник з результатами імпорту.
    """
    wb = load_workbook(BytesIO(file_content), data_only=True)
    
    result = {
        "recipes_imported": 0,
        "components_imported": 0,
        "products_imported": 0,
        "errors": [],
        "recipe_type": recipe_type
    }
    
    # Імпорт техкарт
    if "калькуляции" in wb.sheetnames:
        sheet = wb["калькуляции"]
    else:
        sheet = wb.worksheets[0]
    
    if recipe_type == "box":
        recipes_result = _import_box_recipes_from_sheet(db, sheet)
        result["components_imported"] = recipes_result.get("components_count", 0)
    else:
        recipes_result = _import_catering_recipes_from_sheet(db, sheet)
    
    result["recipes_imported"] = recipes_result["count"]
    result["errors"].extend(recipes_result["errors"])
    
    # Імпорт продуктів
    if "список продуктов" in wb.sheetnames:
        products_sheet = wb["список продуктов"]
        products_result = _import_products_from_sheet(db, products_sheet)
        result["products_imported"] = products_result["count"]
        result["errors"].extend(products_result["errors"])
    
    db.commit()
    return result


def _import_catering_recipes_from_sheet(db: Session, sheet) -> Dict:
    """
    Імпортує техкарти для кейтерінгу (проста структура).
    Страва → Інгредієнти
    """
    result = {"count": 0, "errors": []}
    
    max_row = sheet.max_row
    current_recipe = None
    current_category = None
    ingredient_index = 0
    
    for row in range(1, max_row + 1):
        col_a = sheet.cell(row=row, column=1).value
        col_c = sheet.cell(row=row, column=3).value
        col_e = sheet.cell(row=row, column=5).value
        col_g = sheet.cell(row=row, column=7).value
        
        # Пропускаємо заголовки
        if col_c == "Назва" or col_c is None:
            continue
        
        # Якщо в колонці A є текст без числа і маркер 'point' - це категорія
        if col_a and isinstance(col_a, str) and col_g == MARKER_POINT:
            current_category = col_a
            continue
        
        # Якщо є маркер 'point' і назва - це нова страва
        if col_g == MARKER_POINT and col_c:
            # Зберігаємо попередню страву
            if current_recipe:
                try:
                    db.add(current_recipe)
                    result["count"] += 1
                except Exception as e:
                    result["errors"].append(f"Помилка збереження страви '{current_recipe.name}': {str(e)}")
            
            # Перевіряємо, чи така страва вже існує
            existing = db.query(models.Recipe).filter(
                models.Recipe.name == str(col_c).strip(),
                models.Recipe.recipe_type == "catering"
            ).first()
            
            if existing:
                current_recipe = existing
                # Очищаємо старі інгредієнти
                db.query(models.RecipeIngredient).filter(
                    models.RecipeIngredient.recipe_id == existing.id
                ).delete()
            else:
                current_recipe = models.Recipe(
                    name=str(col_c).strip(),
                    category=current_category,
                    weight_per_portion=safe_float(col_e),
                    recipe_type="catering"
                )
            ingredient_index = 0
            continue
        
        # Якщо немає маркера і є назва - це інгредієнт
        if current_recipe and col_c and col_e:
            product_name = str(col_c).strip()
            
            # Пропускаємо кроки приготування
            if is_cooking_step(product_name):
                continue
            
            weight = safe_float(col_e, 0)
            if weight is not None:
                ingredient = models.RecipeIngredient(
                    product_name=clean_product_name(product_name),
                    weight_per_portion=weight,
                    unit="г",
                    order_index=ingredient_index
                )
                current_recipe.ingredients.append(ingredient)
                ingredient_index += 1
    
    # Зберігаємо останню страву
    if current_recipe:
        try:
            db.add(current_recipe)
            result["count"] += 1
        except Exception as e:
            result["errors"].append(f"Помилка збереження страви '{current_recipe.name}': {str(e)}")
    
    return result


def _import_box_recipes_from_sheet(db: Session, sheet) -> Dict:
    """
    Імпортує техкарти для боксів (трирівнева структура).
    Страва → Компоненти → Інгредієнти
    
    Маркери:
    - 'point' - початок страви
    - 'in' - початок компонента боксу
    """
    result = {"count": 0, "components_count": 0, "errors": []}
    
    max_row = sheet.max_row
    current_recipe = None
    current_component = None
    current_category = None
    component_index = 0
    ingredient_index = 0
    
    for row in range(1, max_row + 1):
        col_a = sheet.cell(row=row, column=1).value
        col_c = sheet.cell(row=row, column=3).value
        col_e = sheet.cell(row=row, column=5).value
        col_g = sheet.cell(row=row, column=7).value
        
        # Пропускаємо заголовки
        if col_c == "Назва" or col_c is None:
            continue
        
        # Якщо в колонці A є текст без числа і маркер 'point' - це категорія
        if col_a and isinstance(col_a, str) and col_g == MARKER_POINT:
            current_category = col_a
            continue
        
        # Якщо є маркер 'point' і назва - це нова страва (бокс)
        if col_g == MARKER_POINT and col_c:
            # Зберігаємо попередню страву
            if current_recipe:
                try:
                    db.add(current_recipe)
                    result["count"] += 1
                except Exception as e:
                    result["errors"].append(f"Помилка збереження боксу '{current_recipe.name}': {str(e)}")
            
            # Перевіряємо, чи такий бокс вже існує
            existing = db.query(models.Recipe).filter(
                models.Recipe.name == str(col_c).strip(),
                models.Recipe.recipe_type == "box"
            ).first()
            
            if existing:
                current_recipe = existing
                # Очищаємо старі компоненти
                db.query(models.RecipeComponent).filter(
                    models.RecipeComponent.recipe_id == existing.id
                ).delete()
            else:
                current_recipe = models.Recipe(
                    name=str(col_c).strip(),
                    category=current_category,
                    weight_per_portion=safe_float(col_e),
                    recipe_type="box"
                )
            
            current_component = None
            component_index = 0
            continue
        
        # Якщо є маркер 'in' - це компонент боксу
        if col_g == MARKER_IN and col_c and current_recipe:
            current_component = models.RecipeComponent(
                name=str(col_c).strip(),
                quantity_per_portion=safe_float(col_a, 1.0) or 1.0,
                order_index=component_index
            )
            current_recipe.components.append(current_component)
            result["components_count"] += 1
            component_index += 1
            ingredient_index = 0
            continue
        
        # Якщо є компонент і є назва/вага - це інгредієнт компонента
        if current_component and col_c and col_e:
            product_name = str(col_c).strip()
            
            # Пропускаємо кроки приготування
            if is_cooking_step(product_name):
                continue
            
            weight = safe_float(col_e, 0)
            if weight is not None:
                ingredient = models.RecipeComponentIngredient(
                    product_name=clean_product_name(product_name),
                    weight_per_unit=weight,
                    unit="г",
                    order_index=ingredient_index
                )
                current_component.ingredients.append(ingredient)
                ingredient_index += 1
        
        # Якщо немає компонента, але є страва і інгредієнт - додаємо як прямий інгредієнт
        elif current_recipe and not current_component and col_c and col_e:
            product_name = str(col_c).strip()
            
            # Пропускаємо кроки приготування
            if is_cooking_step(product_name):
                continue
            
            weight = safe_float(col_e, 0)
            if weight is not None:
                ingredient = models.RecipeIngredient(
                    product_name=clean_product_name(product_name),
                    weight_per_portion=weight,
                    unit="г",
                    order_index=ingredient_index
                )
                current_recipe.ingredients.append(ingredient)
                ingredient_index += 1
    
    # Зберігаємо останню страву
    if current_recipe:
        try:
            db.add(current_recipe)
            result["count"] += 1
        except Exception as e:
            result["errors"].append(f"Помилка збереження боксу '{current_recipe.name}': {str(e)}")
    
    return result


def _import_products_from_sheet(db: Session, sheet) -> Dict:
    """Імпортує продукти з листа 'список продуктов'."""
    result = {"count": 0, "errors": [], "skipped": 0}
    
    max_row = sheet.max_row
    current_category = None
    current_subcategory = None
    
    # Отримуємо всі існуючі продукти одразу (для швидкості)
    existing_products = set(
        name for (name,) in db.query(models.Product.name).all()
    )
    # Також тримаємо список нових продуктів з цього імпорту
    added_in_this_import = set()
    
    for row in range(1, max_row + 1):
        col_a = sheet.cell(row=row, column=1).value
        
        if not col_a:
            continue
        
        col_a = str(col_a).strip()
        
        # Пропускаємо заголовки
        if col_a == "Позначення":
            continue
        
        # Визначаємо категорії (великими літерами)
        if col_a.isupper() and len(col_a) > 2:
            if any(char.isalpha() for char in col_a):
                if current_category is None or col_a in ["РИБНИЙ", "М'ЯСНИЙ", "ОВОЧІ", "МОЛОЧНИЙ", "БАКАЛІЯ", "ІНШЕ"]:
                    current_category = col_a
                    current_subcategory = None
                else:
                    current_subcategory = col_a
                continue
        
        # Пропускаємо якщо продукт вже існує або вже додано в цьому імпорті
        if col_a in existing_products or col_a in added_in_this_import:
            result["skipped"] += 1
            continue
        
        # Це новий продукт
        product = models.Product(
            name=col_a,
            category=current_category,
            subcategory=current_subcategory,
            unit="г"
        )
        try:
            db.add(product)
            added_in_this_import.add(col_a)
            result["count"] += 1
        except Exception as e:
            result["errors"].append(f"Помилка збереження продукту '{col_a}': {str(e)}")
    
    return result


# ============ Отримання техкарт ============

def get_all_recipes(
    db: Session, 
    recipe_type: Optional[Literal["catering", "box"]] = None
) -> List[models.Recipe]:
    """
    Отримує всі техкарти.
    
    Args:
        db: Сесія бази даних
        recipe_type: Фільтр за типом (None = всі)
    """
    query = db.query(models.Recipe).options(
        joinedload(models.Recipe.ingredients),
        joinedload(models.Recipe.components).joinedload(models.RecipeComponent.ingredients)
    )
    
    if recipe_type:
        query = query.filter(models.Recipe.recipe_type == recipe_type)
    
    return query.all()


def get_recipe_by_name(
    db: Session, 
    name: str,
    recipe_type: Optional[Literal["catering", "box"]] = None
) -> Optional[models.Recipe]:
    """
    Шукає техкарту за назвою страви (нечутливий до регістру).
    
    Args:
        db: Сесія бази даних
        name: Назва страви
        recipe_type: Фільтр за типом (None = будь-який)
    """
    query = db.query(models.Recipe).options(
        joinedload(models.Recipe.ingredients),
        joinedload(models.Recipe.components).joinedload(models.RecipeComponent.ingredients)
    ).filter(models.Recipe.name.ilike(f"%{name}%"))
    
    if recipe_type:
        query = query.filter(models.Recipe.recipe_type == recipe_type)
    
    return query.first()


def get_recipe_by_id(db: Session, recipe_id: int) -> Optional[models.Recipe]:
    """Отримує техкарту за ID."""
    return db.query(models.Recipe).options(
        joinedload(models.Recipe.ingredients),
        joinedload(models.Recipe.components).joinedload(models.RecipeComponent.ingredients)
    ).filter(models.Recipe.id == recipe_id).first()


# ============ Розрахунок закупки ============

def calculate_purchase_from_kps(
    db: Session, 
    kp_ids: List[int],
    calculation_type: Optional[Literal["catering", "box", "auto"]] = "auto"
) -> Dict[str, Dict]:
    """
    Розраховує закупку продуктів на основі вибраних КП.
    
    Алгоритм залежить від типу:
    
    **Кейтерінг (catering):**
    1. Беремо страви з КП
    2. Для кожної страви шукаємо техкарту
    3. Множимо: вага_інгредієнта × кількість_порцій
    
    **Бокси (box):**
    1. Беремо страви (бокси) з КП
    2. Для кожного боксу шукаємо техкарту
    3. Множимо: вага_інгредієнта × кількість_компонентів × кількість_порцій
    
    **Auto:**
    - Визначає тип автоматично на основі event_group КП
    
    Args:
        db: Сесія бази даних
        kp_ids: Список ID КП
        calculation_type: Тип розрахунку
    
    Повертає: {product_name: {"quantity": float, "unit": str}}
    """
    # Завантажуємо КП з позиціями
    kps = (
        db.query(models.KP)
        .options(
            joinedload(models.KP.items).joinedload(models.KPItem.item),
        )
        .filter(models.KP.id.in_(kp_ids))
        .all()
    )
    
    if not kps:
        return {
            "products": {},
            "dishes_without_recipe": [],
            "total_dishes": 0,
            "dishes_with_recipe": 0,
            "calculation_type": calculation_type
        }
    
    # Визначаємо тип розрахунку автоматично
    if calculation_type == "auto":
        # Перевіряємо event_group першого КП
        first_kp = kps[0]
        if first_kp.event_group and "бокс" in first_kp.event_group.lower():
            calculation_type = "box"
        else:
            calculation_type = "catering"
    
    # Збираємо страви та їх кількості
    dish_quantities: Dict[str, float] = defaultdict(float)
    
    for kp in kps:
        for kp_item in kp.items:
            # Визначаємо назву страви
            if kp_item.item and kp_item.item.name:
                dish_name = kp_item.item.name
            elif kp_item.name:
                dish_name = kp_item.name
            else:
                continue
            
            # Визначаємо тип - нас цікавлять тільки страви (menu)
            item_type = None
            if kp_item.type:
                item_type = kp_item.type
            elif kp_item.item and hasattr(kp_item.item, 'type'):
                item_type = kp_item.item.type
            
            # Пропускаємо обладнання та сервіс
            if item_type in ['equipment', 'service']:
                continue
            
            qty = kp_item.quantity or 0
            dish_quantities[dish_name] += qty
    
    # Розраховуємо продукти
    product_totals: Dict[str, Dict] = defaultdict(lambda: {"quantity": 0.0, "unit": "г"})
    dishes_without_recipe = []
    dishes_with_recipe = 0
    
    for dish_name, quantity in dish_quantities.items():
        recipe = get_recipe_by_name(db, dish_name, calculation_type)
        
        # Якщо не знайшли за типом - шукаємо будь-яку
        if not recipe:
            recipe = get_recipe_by_name(db, dish_name)
        
        if recipe:
            dishes_with_recipe += 1
            
            if recipe.recipe_type == "box" and recipe.components:
                # Трирівнева структура для боксів
                _calculate_box_products(recipe, quantity, product_totals)
            else:
                # Проста структура для кейтерінгу
                _calculate_catering_products(recipe, quantity, product_totals)
        else:
            dishes_without_recipe.append(dish_name)
    
    return {
        "products": dict(product_totals),
        "dishes_without_recipe": dishes_without_recipe,
        "total_dishes": len(dish_quantities),
        "dishes_with_recipe": dishes_with_recipe,
        "calculation_type": calculation_type
    }


def _calculate_catering_products(
    recipe: models.Recipe, 
    quantity: float, 
    product_totals: Dict[str, Dict]
) -> None:
    """
    Розраховує продукти для кейтерінгу.
    Формула: вага_інгредієнта × кількість_порцій
    """
    for ingredient in recipe.ingredients:
        total_weight = ingredient.weight_per_portion * quantity
        product_totals[ingredient.product_name]["quantity"] += total_weight
        product_totals[ingredient.product_name]["unit"] = ingredient.unit or "г"


def _calculate_box_products(
    recipe: models.Recipe, 
    quantity: float, 
    product_totals: Dict[str, Dict]
) -> None:
    """
    Розраховує продукти для боксів.
    Формула: вага_інгредієнта × кількість_компонентів × кількість_порцій
    """
    for component in recipe.components:
        component_qty = component.quantity_per_portion or 1.0
        
        for ingredient in component.ingredients:
            # Формула: вага × кількість_компонентів × кількість_порцій
            total_weight = ingredient.weight_per_unit * component_qty * quantity
            product_totals[ingredient.product_name]["quantity"] += total_weight
            product_totals[ingredient.product_name]["unit"] = ingredient.unit or "г"
    
    # Також додаємо прямі інгредієнти (якщо є)
    for ingredient in recipe.ingredients:
        total_weight = ingredient.weight_per_portion * quantity
        product_totals[ingredient.product_name]["quantity"] += total_weight
        product_totals[ingredient.product_name]["unit"] = ingredient.unit or "г"


# ============ CRUD операції ============

def create_recipe(
    db: Session,
    name: str,
    recipe_type: Literal["catering", "box"],
    category: Optional[str] = None,
    weight_per_portion: Optional[float] = None,
    ingredients: Optional[List[Dict]] = None,
    components: Optional[List[Dict]] = None
) -> models.Recipe:
    """
    Створює нову техкарту.
    
    Args:
        db: Сесія бази даних
        name: Назва страви
        recipe_type: Тип техкарти
        category: Категорія
        weight_per_portion: Вага порції
        ingredients: Список інгредієнтів (для кейтерінгу)
        components: Список компонентів з інгредієнтами (для боксів)
    """
    recipe = models.Recipe(
        name=name,
        recipe_type=recipe_type,
        category=category,
        weight_per_portion=weight_per_portion
    )
    
    if ingredients:
        for idx, ing_data in enumerate(ingredients):
            ingredient = models.RecipeIngredient(
                product_name=ing_data["product_name"],
                weight_per_portion=ing_data["weight_per_portion"],
                unit=ing_data.get("unit", "г"),
                order_index=idx
            )
            recipe.ingredients.append(ingredient)
    
    if components and recipe_type == "box":
        for comp_idx, comp_data in enumerate(components):
            component = models.RecipeComponent(
                name=comp_data["name"],
                quantity_per_portion=comp_data.get("quantity_per_portion", 1.0),
                order_index=comp_idx
            )
            
            for ing_idx, ing_data in enumerate(comp_data.get("ingredients", [])):
                ingredient = models.RecipeComponentIngredient(
                    product_name=ing_data["product_name"],
                    weight_per_unit=ing_data["weight_per_unit"],
                    unit=ing_data.get("unit", "г"),
                    order_index=ing_idx
                )
                component.ingredients.append(ingredient)
            
            recipe.components.append(component)
    
    db.add(recipe)
    db.commit()
    db.refresh(recipe)
    return recipe


def delete_recipe(db: Session, recipe_id: int) -> bool:
    """Видаляє техкарту за ID."""
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if recipe:
        db.delete(recipe)
        db.commit()
        return True
    return False
