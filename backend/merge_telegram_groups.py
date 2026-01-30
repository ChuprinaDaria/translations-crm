#!/usr/bin/env python3
"""
Міграція для об'єднання існуючих Telegram груп/каналів.

Проблема: До виправлення, для кожної групи створювалися окремі conversation для кожного користувача.
Після виправлення: Всі повідомлення з однієї групи мають бути в одному conversation.

Цей скрипт:
1. Знаходить всі Telegram conversation з external_id що починаються з user_id (не chat_id)
2. Групує їх по chat_id з meta_data повідомлень
3. Об'єднує conversation в один (залишає найстаріший)
4. Переносить всі повідомлення в об'єднаний conversation
"""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text
from collections import defaultdict

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Set DATABASE_URL if not set
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql://translator:traslatorini2025@localhost:5434/crm_db"

from core.config import settings

def merge_telegram_groups():
    """Об'єднати Telegram групи в один conversation."""
    print("🚀 Початок міграції Telegram груп...")
    
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.begin() as conn:
        # 1. Знайти всі Telegram conversation
        result = conn.execute(text("""
            SELECT id, external_id, subject, created_at
            FROM communications_conversations
            WHERE platform = 'telegram'
            ORDER BY created_at
        """))
        
        conversations = result.fetchall()
        print(f"📊 Знайдено {len(conversations)} Telegram conversation")
        
        # 2. Знайти всі повідомлення з meta_data для визначення chat_id
        messages_result = conn.execute(text("""
            SELECT conversation_id, meta_data
            FROM communications_messages
            WHERE meta_data IS NOT NULL
            AND (meta_data::text LIKE '%telegram_chat_id%' OR meta_data::text LIKE '%is_group_message%')
        """))
        
        # Групуємо conversation по chat_id з meta_data
        chat_id_to_conversations = defaultdict(list)
        conversation_to_chat_id = {}
        username_to_chat_id = {}  # Для зіставлення username з chat_id
        
        for msg_row in messages_result:
            conv_id = str(msg_row[0])
            meta_data = msg_row[1] if msg_row[1] else {}
            
            chat_id = meta_data.get('telegram_chat_id')
            is_group = meta_data.get('is_group_message', False)
            username = meta_data.get('telegram_username')
            
            # Перевіряємо чи це група/канал (chat_id < 0 або is_group_message = True)
            # Також враховуємо випадки, коли is_group_message може бути не встановлено
            if chat_id:
                try:
                    chat_id_int = int(chat_id) if isinstance(chat_id, str) else chat_id
                    # Якщо chat_id < 0, це точно група/канал
                    # Або якщо is_group_message = True
                    if chat_id_int < 0 or is_group:
                        chat_id_str = str(chat_id_int)
                        conversation_to_chat_id[conv_id] = chat_id_str
                        
                        if chat_id_str not in chat_id_to_conversations:
                            chat_id_to_conversations[chat_id_str] = []
                        if conv_id not in chat_id_to_conversations[chat_id_str]:
                            chat_id_to_conversations[chat_id_str].append(conv_id)
                        
                        # Зберігаємо зіставлення username -> chat_id для груп
                        if username and chat_id_int < 0:
                            username_to_chat_id[username.lower()] = chat_id_str
                except (ValueError, TypeError):
                    pass
        
        # 3. Також шукаємо conversation з external_id що починається з "-" (це chat_id для груп)
        # або з "@" (це username для груп/каналів)
        # Це допоможе знайти групи, які вже мають правильний external_id, але не мають повідомлень з meta_data
        for conv in conversations:
            conv_id = str(conv[0])
            external_id = conv[1]
            
            # Якщо external_id починається з "-", це може бути chat_id групи
            if external_id and external_id.startswith('-'):
                try:
                    # Перевіряємо чи це числовий chat_id (наприклад, "-1001234567890")
                    chat_id_int = int(external_id)
                    if chat_id_int < 0:
                        chat_id_str = str(chat_id_int)
                        conversation_to_chat_id[conv_id] = chat_id_str
                        
                        if chat_id_str not in chat_id_to_conversations:
                            chat_id_to_conversations[chat_id_str] = []
                        if conv_id not in chat_id_to_conversations[chat_id_str]:
                            chat_id_to_conversations[chat_id_str].append(conv_id)
                except (ValueError, TypeError):
                    pass
            # Якщо external_id починається з "@", це може бути username групи/каналу
            elif external_id and external_id.startswith('@'):
                username = external_id[1:].lower()  # Прибираємо "@" і приводимо до нижнього регістру
                # Перевіряємо чи є зіставлення username -> chat_id з meta_data
                if username in username_to_chat_id:
                    chat_id_str = username_to_chat_id[username]
                    conversation_to_chat_id[conv_id] = chat_id_str
                    
                    if chat_id_str not in chat_id_to_conversations:
                        chat_id_to_conversations[chat_id_str] = []
                    if conv_id not in chat_id_to_conversations[chat_id_str]:
                        chat_id_to_conversations[chat_id_str].append(conv_id)
        
        print(f"📊 Знайдено {len(chat_id_to_conversations)} унікальних груп/каналів")
        
        # Діагностика: показати знайдені групи
        if chat_id_to_conversations:
            print("\n📋 Знайдені групи/канали:")
            for chat_id_str, conv_ids in sorted(chat_id_to_conversations.items()):
                print(f"  • Група {chat_id_str}: {len(conv_ids)} conversation")
                for conv_id in conv_ids:
                    conv_info = conn.execute(text("""
                        SELECT external_id, subject FROM communications_conversations
                        WHERE id = :conv_id
                    """), {"conv_id": conv_id}).fetchone()
                    if conv_info:
                        print(f"    - {conv_id}: external_id={conv_info[0]}, subject={conv_info[1]}")
        else:
            print("⚠️  Не знайдено жодної групи/каналу для об'єднання")
            print("\n🔍 Перевірка conversation з external_id що починається з '-' або '@'...")
            groups_by_external_id = conn.execute(text("""
                SELECT id, external_id, subject, 
                       (SELECT COUNT(*) FROM communications_messages WHERE conversation_id = communications_conversations.id) as msg_count
                FROM communications_conversations
                WHERE platform = 'telegram' 
                AND (external_id LIKE '-%' OR external_id LIKE '@%')
                ORDER BY created_at
            """))
            found_groups = groups_by_external_id.fetchall()
            if found_groups:
                print(f"📊 Знайдено {len(found_groups)} conversation з external_id що починається з '-' або '@' (можливі групи):")
                for group in found_groups:
                    print(f"  • {group[0]}: external_id={group[1]}, subject={group[2]}, повідомлень={group[3]}")
                    
                    # Якщо це username, спробувати знайти chat_id з повідомлень
                    if group[1] and group[1].startswith('@'):
                        username = group[1][1:].lower()
                        msg_with_chat_id = conn.execute(text("""
                            SELECT meta_data->>'telegram_chat_id' as chat_id
                            FROM communications_messages
                            WHERE conversation_id = :conv_id
                            AND meta_data IS NOT NULL
                            AND meta_data->>'telegram_chat_id' IS NOT NULL
                            LIMIT 1
                        """), {"conv_id": group[0]}).fetchone()
                        if msg_with_chat_id and msg_with_chat_id[0]:
                            try:
                                chat_id_int = int(msg_with_chat_id[0])
                                if chat_id_int < 0:
                                    print(f"    → Знайдено chat_id: {msg_with_chat_id[0]} (можна оновити external_id)")
                            except (ValueError, TypeError):
                                pass
        
        # 3. Для кожної групи знайти conversation з правильним external_id (chat_id)
        # і об'єднати інші в нього
        merged_count = 0
        
        for chat_id_str, conv_ids in chat_id_to_conversations.items():
            if len(conv_ids) <= 1:
                continue  # Вже один conversation
            
            # Знайти conversation з правильним external_id (chat_id)
            target_conv_id = None
            other_conv_ids = []
            
            for conv_id in conv_ids:
                conv_result = conn.execute(text("""
                    SELECT id, external_id FROM communications_conversations
                    WHERE id = :conv_id
                """), {"conv_id": conv_id})
                conv_row = conv_result.fetchone()
                
                if conv_row and conv_row[1] == chat_id_str:
                    # Це правильний conversation
                    target_conv_id = conv_id
                else:
                    other_conv_ids.append(conv_id)
            
            # Якщо немає правильного conversation, використовуємо найстаріший
            if not target_conv_id:
                # Знайти найстаріший conversation
                oldest_result = conn.execute(text("""
                    SELECT id FROM communications_conversations
                    WHERE id = ANY(:conv_ids)
                    ORDER BY created_at ASC
                    LIMIT 1
                """), {"conv_ids": conv_ids})
                oldest_row = oldest_result.fetchone()
                if oldest_row:
                    target_conv_id = oldest_row[0]
                    other_conv_ids = [c for c in conv_ids if c != target_conv_id]
                    
                    # Оновити external_id на chat_id (якщо він був username або інший формат)
                    conn.execute(text("""
                        UPDATE communications_conversations
                        SET external_id = :chat_id
                        WHERE id = :conv_id
                    """), {"chat_id": chat_id_str, "conv_id": target_conv_id})
                    print(f"📝 Оновлено external_id conversation {target_conv_id} на {chat_id_str}")
            
            # Об'єднати інші conversation
            for other_conv_id in other_conv_ids:
                # Перенести всі повідомлення
                conn.execute(text("""
                    UPDATE communications_messages
                    SET conversation_id = :target_id
                    WHERE conversation_id = :source_id
                """), {"target_id": target_conv_id, "source_id": other_conv_id})
                
                # Видалити старий conversation
                conn.execute(text("""
                    DELETE FROM communications_conversations
                    WHERE id = :conv_id
                """), {"conv_id": other_conv_id})
                
                merged_count += 1
                print(f"✅ Об'єднано conversation {other_conv_id} → {target_conv_id} (група {chat_id_str})")
        
        print(f"✅ Міграція завершена! Об'єднано {merged_count} conversation")
        
        # 4. Оновити external_id для conversation з username на chat_id (якщо знайдено)
        print("📝 Оновлення external_id для груп з username...")
        updated_external_ids = 0
        conversations_with_username = conn.execute(text("""
            SELECT id, external_id
            FROM communications_conversations
            WHERE platform = 'telegram'
            AND external_id LIKE '@%'
        """))
        
        for conv_row in conversations_with_username:
            conv_id = conv_row[0]
            username = conv_row[1]
            
            # Спробувати знайти chat_id з повідомлень цього conversation
            msg_with_chat_id = conn.execute(text("""
                SELECT meta_data->>'telegram_chat_id' as chat_id
                FROM communications_messages
                WHERE conversation_id = :conv_id
                AND meta_data IS NOT NULL
                AND meta_data->>'telegram_chat_id' IS NOT NULL
                AND (meta_data->>'is_group_message' = 'true' OR CAST(meta_data->>'telegram_chat_id' AS bigint) < 0)
                LIMIT 1
            """), {"conv_id": conv_id}).fetchone()
            
            if msg_with_chat_id and msg_with_chat_id[0]:
                try:
                    chat_id_int = int(msg_with_chat_id[0])
                    if chat_id_int < 0:
                        chat_id_str = str(chat_id_int)
                        # Оновити external_id на chat_id
                        conn.execute(text("""
                            UPDATE communications_conversations
                            SET external_id = :chat_id
                            WHERE id = :conv_id
                        """), {"chat_id": chat_id_str, "conv_id": conv_id})
                        updated_external_ids += 1
                        print(f"  ✅ Оновлено {username} → {chat_id_str}")
                except (ValueError, TypeError):
                    pass
        
        if updated_external_ids > 0:
            print(f"✅ Оновлено {updated_external_ids} external_id з username на chat_id")
        
        # 5. Оновити subject для груп (якщо є назва в meta_data)
        print("📝 Оновлення назв груп...")
        groups_result = conn.execute(text("""
            SELECT DISTINCT conversation_id, meta_data
            FROM communications_messages
            WHERE meta_data IS NOT NULL
            AND meta_data::text LIKE '%is_group_message%'
            AND meta_data->>'is_group_message' = 'true'
        """))
        
        updated_subjects = 0
        for row in groups_result:
            conv_id = row[0]
            meta_data = row[1] if row[1] else {}
            
            # Перевірити чи є назва групи в meta_data (може бути в різних повідомленнях)
            # Для простоти, оновлюємо тільки якщо subject починається з "Група"
            conv_check = conn.execute(text("""
                SELECT subject FROM communications_conversations
                WHERE id = :conv_id
            """), {"conv_id": conv_id})
            conv_row = conv_check.fetchone()
            
            if conv_row and conv_row[0] and (conv_row[0].startswith("Група ") or conv_row[0].startswith("Group ")):
                # Можна спробувати отримати назву з subject conversation (якщо вона вже є)
                # Або залишити як є - нові повідомлення будуть мати правильну назву
                pass
        
        print(f"✅ Міграція повністю завершена!")

if __name__ == "__main__":
    try:
        merge_telegram_groups()
    except Exception as e:
        print(f"❌ Помилка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

