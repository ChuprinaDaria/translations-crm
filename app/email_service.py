# Email service для відправки КП

import smtplib
import socket
import re
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional

from db import SessionLocal
import crud


def _load_smtp_config() -> dict:
  """
  Завантажує SMTP налаштування з бази даних (app_settings),
  а якщо їх немає — підтягує значення з env як fallback.
  """
  db = SessionLocal()
  try:
      settings = crud.get_smtp_settings(db)
  finally:
      db.close()

  host = (settings.get("smtp_host") or os.getenv("SMTP_HOST", "smtp.gmail.com")).strip()
  port_str = (settings.get("smtp_port") or os.getenv("SMTP_PORT", "587")).strip()
  user = (settings.get("smtp_user") or os.getenv("SMTP_USER", "")).strip()
  password = (settings.get("smtp_password") or os.getenv("SMTP_PASSWORD", "")).strip()
  from_email = (settings.get("smtp_from_email") or os.getenv("SMTP_FROM_EMAIL", user) or user).strip()
  from_name = (settings.get("smtp_from_name") or os.getenv("SMTP_FROM_NAME", "BOX Catering")).strip()

  try:
      port = int(port_str)
  except (TypeError, ValueError):
      port = 587

  return {
      "host": host,
      "port": port,
      "user": user,
      "password": password,
      "from_email": from_email,
      "from_name": from_name,
  }

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
    config = _load_smtp_config()
    host = config["host"]
    port = config["port"]
    user = config["user"]
    password = config["password"]
    from_email = config["from_email"]
    from_name = config["from_name"]

    if not user or not password:
        raise ValueError("SMTP credentials not configured. Please set SMTP settings in the system settings.")
    
    if not host:
        raise ValueError("SMTP host is empty. Please configure SMTP settings.")
    
    # Діагностика: виводимо налаштування (без пароля)
    print(f"Attempting to send KP email via SMTP:")
    print(f"  Host: '{host}' (length: {len(host)})")
    print(f"  Port: {port}")
    print(f"  User: '{user}'")
    print(f"  From: {from_email} ({from_name})")
    print(f"  To: {to_email}")
    print(f"  Subject: Комерційна пропозиція: {kp_title}")
    
    try:
        # Створюємо повідомлення
        msg = MIMEMultipart()
        msg['From'] = f"{from_name} <{from_email}>"
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
        print(f"Connecting to SMTP server {host}:{port}...")
        
        # Спробуємо резолвити DNS, якщо це не IP адреса
        smtp_host = host
        if not re.match(r'^\d+\.\d+\.\d+\.\d+$', host):
            try:
                # Спробуємо резолвити DNS
                ip_address = socket.gethostbyname(host)
                print(f"Resolved {host} to {ip_address}")
                smtp_host = ip_address
            except socket.gaierror as dns_error:
                print(f"DNS resolution failed for {host}: {dns_error}")
                print(f"  Trying direct connection with hostname...")
                smtp_host = host
        
        # Порт 465 використовує SSL з самого початку, інші порти використовують STARTTLS
        try:
            if port == 465:
                print(f"Using SSL connection (port 465) to {smtp_host}...")
                server = smtplib.SMTP_SSL(smtp_host, port, timeout=30)
            else:
                print(f"Using STARTTLS connection (port {port}) to {smtp_host}...")
                server = smtplib.SMTP(smtp_host, port, timeout=30)
                print(f"Starting TLS...")
                server.starttls()
            print(f"Logging in as {user}...")
            server.login(user, password)
            print(f"Sending message...")
            server.send_message(msg)
            server.quit()
            print(f"Email sent successfully!")
            
            return True
        except (OSError, socket.gaierror) as conn_error:
            # Якщо не вдалося підключитися через DNS, спробуємо використати IP
            error_msg = f"Connection error: {conn_error}"
            print(f"Error connecting to {smtp_host}:{port}: {error_msg}")
            print(f"  This might be a DNS resolution issue. If you know the IP address, try using it instead.")
            if host == "serwer2555348.home.pl":
                print(f"  For serwer2555348.home.pl, try using IP: 46.242.246.132")
            raise Exception(f"Помилка підключення до SMTP сервера {host}:{port}. Перевірте правильність адреси сервера та доступність мережі. Якщо використовуєте Docker, спробуйте використати IP адресу (46.242.246.132) замість доменного імені.")
    except Exception as e:
        error_msg = f"Unexpected error: {e}"
        print(f"Error sending email: {error_msg}")
        raise


def send_password_reset_code(to_email: str, code: str) -> bool:
    """
    Відправляє код скидання пароля на email
    
    Args:
        to_email: Email адреса отримувача
        code: 6-значний код для скидання пароля
    
    Returns:
        True якщо відправка успішна, False інакше
    """
    config = _load_smtp_config()
    host = config["host"]
    port = config["port"]
    user = config["user"]
    password = config["password"]
    from_email = config["from_email"]
    from_name = config["from_name"]

    if not user or not password:
        raise ValueError("SMTP credentials not configured. Please set SMTP settings in the system settings.")
    
    try:
        # Діагностика: виводимо налаштування (без пароля)
        print(f"Attempting to send email via SMTP:")
        print(f"  Host: '{host}' (length: {len(host)})")
        print(f"  Port: {port}")
        print(f"  User: '{user}'")
        print(f"  From: {from_email} ({from_name})")
        print(f"  To: {to_email}")
        
        # Перевірка на порожній host
        if not host:
            raise ValueError("SMTP host is empty. Please configure SMTP settings.")
        
        # Створюємо повідомлення
        msg = MIMEMultipart()
        msg['From'] = f"{from_name} <{from_email}>"
        msg['To'] = to_email
        msg['Subject'] = "Код для скидання пароля"
        
        # Тіло листа
        body_text = f"""
Шановний(а) користувачу!

Ви запросили скидання пароля для вашого облікового запису.

Ваш код для скидання пароля: {code}

Цей код дійсний протягом 15 хвилин.

Якщо ви не запитували скидання пароля, проігноруйте цей лист.

З повагою,
Команда BOX Catering

---
Це автоматичне повідомлення. Будь ласка, не відповідайте на цей email.
"""
        
        msg.attach(MIMEText(body_text, 'plain', 'utf-8'))
        
        # Відправляємо email
        print(f"Connecting to SMTP server {host}:{port}...")
        
        # Спробуємо резолвити DNS, якщо це не IP адреса
        smtp_host = host
        if not re.match(r'^\d+\.\d+\.\d+\.\d+$', host):
            try:
                # Спробуємо резолвити DNS
                ip_address = socket.gethostbyname(host)
                print(f"Resolved {host} to {ip_address}")
                smtp_host = ip_address
            except socket.gaierror as dns_error:
                print(f"DNS resolution failed for {host}: {dns_error}")
                print(f"  Trying direct connection with hostname...")
                smtp_host = host
        
        # Порт 465 використовує SSL з самого початку, інші порти використовують STARTTLS
        try:
            if port == 465:
                print(f"Using SSL connection (port 465) to {smtp_host}...")
                server = smtplib.SMTP_SSL(smtp_host, port, timeout=30)
            else:
                print(f"Using STARTTLS connection (port {port}) to {smtp_host}...")
                server = smtplib.SMTP(smtp_host, port, timeout=30)
                print(f"Starting TLS...")
                server.starttls()
            print(f"Logging in as {user}...")
            server.login(user, password)
            print(f"Sending message...")
            server.send_message(msg)
            server.quit()
            print(f"Email sent successfully!")
            
            return True
        except (OSError, socket.gaierror) as conn_error:
            # Якщо не вдалося підключитися через DNS, спробуємо використати IP
            error_msg = f"Connection error: {conn_error}"
            print(f"Error connecting to {smtp_host}:{port}: {error_msg}")
            print(f"  This might be a DNS resolution issue. If you know the IP address, try using it instead.")
            if host == "serwer2555348.home.pl":
                print(f"  For serwer2555348.home.pl, try using IP: 46.242.246.132")
            raise Exception(f"Помилка підключення до SMTP сервера {host}:{port}. Перевірте правильність адреси сервера та доступність мережі. Якщо використовуєте Docker, спробуйте використати IP адресу (46.242.246.132) замість доменного імені.")
    except Exception as e:
        error_msg = f"Unexpected error: {e}"
        print(f"Error sending password reset email: {error_msg}")
        raise

