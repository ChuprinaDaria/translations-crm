"""
Утиліти для безпечного рендерингу HTML.
"""
import bleach
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
    
    # Видалити скрипти та стилі
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
    
    # Видалити всі HTML теги
    text = bleach.clean(html_content, tags=[], strip=True)
    
    # Декодувати HTML entities
    import html as html_module
    text = html_module.unescape(text)
    
    return text.strip()

