# Email service для відправки КП

import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional

# Конфігурація SMTP з змінних оточення
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "BOX Catering")

def send_kp_email(
    to_email: str,
    kp_title: str,
    pdf_content: bytes,
    pdf_filename: str,
    message: Optional[str] = None
) -> bool:
    """
    Відправляє КП на email клієнта
    
    Args:
        to_email: Email адреса отримувача
        kp_title: Назва комерційної пропозиції
        pdf_content: Вміст PDF файлу (bytes)
        pdf_filename: Ім'я файлу PDF
        message: Додаткове повідомлення (опціонально)
    
    Returns:
        True якщо відправка успішна, False інакше
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        raise ValueError("SMTP credentials not configured. Please set SMTP_USER and SMTP_PASSWORD environment variables.")
    
    try:
        # Створюємо повідомлення
        msg = MIMEMultipart()
        msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg['To'] = to_email
        msg['Subject'] = f"Комерційна пропозиція: {kp_title}"
        
        # Тіло листа
        body_text = f"""
Шановний(а) клієнте!

Дякуємо за ваш інтерес до наших послуг.

Додатково надаємо комерційну пропозицію "{kp_title}" у вкладенні.

"""
        if message:
            body_text += f"\n{message}\n\n"
        
        body_text += """
З повагою,
Команда BOX Catering

---
Це автоматичне повідомлення. Будь ласка, не відповідайте на цей email.
"""
        
        msg.attach(MIMEText(body_text, 'plain', 'utf-8'))
        
        # Додаємо PDF як вкладення
        attachment = MIMEBase('application', 'pdf')
        attachment.set_payload(pdf_content)
        encoders.encode_base64(attachment)
        attachment.add_header(
            'Content-Disposition',
            f'attachment; filename= "{pdf_filename}"'
        )
        msg.attach(attachment)
        
        # Відправляємо email
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        raise

