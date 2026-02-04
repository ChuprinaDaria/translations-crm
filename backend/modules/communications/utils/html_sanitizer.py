"""
Утиліти для безпечного рендерингу HTML.
"""
import bleach
import re
from typing import Optional

# Дозволені теги
ALLOWED_TAGS = [
    'b', 'i', 'u', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'p', 'br',
    'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre', 'hr', 'div', 'span'
]

# Дозволені атрибути
ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'table': ['border', 'cellpadding', 'cellspacing'],
    'td': ['colspan', 'rowspan'],
    'th': ['colspan', 'rowspan'],
    'div': ['class'],
    'span': ['class'],
}

# Дозволені протоколи
ALLOWED_PROTOCOLS = ['http', 'https', 'mailto']


def remove_style_and_script_tags(html_content: str) -> str:
    """
    Видалити <style> та <script> теги РАЗОМ з їх вмістом.
    Це потрібно зробити ДО bleach, бо bleach видаляє тільки теги, а не вміст.
    """
    if not html_content:
        return ""
    
    # Видаляємо <style>...</style> разом з вмістом
    html_content = re.sub(r'<style[^>]*>[\s\S]*?</style>', '', html_content, flags=re.IGNORECASE)
    
    # Видаляємо <script>...</script> разом з вмістом
    html_content = re.sub(r'<script[^>]*>[\s\S]*?</script>', '', html_content, flags=re.IGNORECASE)
    
    # Видаляємо HTML коментарі (часто містять CSS для Outlook)
    html_content = re.sub(r'<!--[\s\S]*?-->', '', html_content)
    
    # Видаляємо <head>...</head> разом з вмістом (там зазвичай стилі)
    html_content = re.sub(r'<head[^>]*>[\s\S]*?</head>', '', html_content, flags=re.IGNORECASE)
    
    return html_content


def sanitize_html(html_content: str) -> str:
    """
    Очистити HTML від небезпечних тегів та атрибутів.
    
    Args:
        html_content: HTML контент для очищення
        
    Returns:
        Очищений HTML
    """
    if not html_content:
        return ""
    
    # СПОЧАТКУ видалити style/script теги РАЗОМ з їх вмістом
    html_content = remove_style_and_script_tags(html_content)
    
    # Потім очистити решту через bleach
    cleaned = bleach.clean(
        html_content,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,  # Видалити недозволені теги замість екранування
    )
    
    return cleaned


def html_to_text(html_content: str) -> str:
    """
    Конвертувати HTML в простий текст.
    
    Args:
        html_content: HTML контент
        
    Returns:
        Простий текст
    """
    if not html_content:
        return ""
    
    # СПОЧАТКУ видалити style/script теги РАЗОМ з їх вмістом
    html_content = remove_style_and_script_tags(html_content)
    
    # Видалити всі HTML теги
    text = bleach.clean(html_content, tags=[], strip=True)
    
    # Декодувати HTML entities
    import html as html_module
    text = html_module.unescape(text)
    
    return text.strip()

