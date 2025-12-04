from telethon.sync import TelegramClient
from telethon.sessions import StringSession

API_ID = int(input("API_ID: "))
API_HASH = input("API_HASH: ")

with TelegramClient(StringSession(), API_ID, API_HASH) as client:
    print("Увійди в акаунт Telegram (код/пароль)...")
    client.start()  # тут спитає номер, код, пароль 2FA (якщо є)
    session_str = client.session.save()
    print("\n=== SESSION STRING (скопіюй у CRM) ===\n")
    print(session_str)
    print("\n=======================================")