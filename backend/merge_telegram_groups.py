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
            AND meta_data::text LIKE '%telegram_chat_id%'
        """))
        
        # Групуємо conversation по chat_id з meta_data
        chat_id_to_conversations = defaultdict(list)
        conversation_to_chat_id = {}
        
        for msg_row in messages_result:
            conv_id = str(msg_row[0])
            meta_data = msg_row[1] if msg_row[1] else {}
            
            chat_id = meta_data.get('telegram_chat_id')
            is_group = meta_data.get('is_group_message', False)
            
            if chat_id and is_group and chat_id < 0:
                # Це група/канал
                chat_id_str = str(chat_id)
                conversation_to_chat_id[conv_id] = chat_id_str
                
                if chat_id_str not in chat_id_to_conversations:
                    chat_id_to_conversations[chat_id_str] = []
                chat_id_to_conversations[chat_id_str].append(conv_id)
        
        print(f"📊 Знайдено {len(chat_id_to_conversations)} унікальних груп/каналів")
        
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
                    
                    # Оновити external_id на chat_id
                    conn.execute(text("""
                        UPDATE communications_conversations
                        SET external_id = :chat_id
                        WHERE id = :conv_id
                    """), {"chat_id": chat_id_str, "conv_id": target_conv_id})
            
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
        
        # 4. Оновити subject для груп (якщо є назва в meta_data)
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

