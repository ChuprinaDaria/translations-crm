# Міграція для існуючих Telegram груп

## Проблема

До виправлення логіки, для кожної Telegram групи/каналу створювалися окремі conversation для кожного користувача, який писав в групу. Це призводило до того, що повідомлення з однієї групи були розкидані по різних conversation.

## Рішення

Після виправлення:
- Всі повідомлення з однієї групи/каналу (chat_id < 0) тепер групуються в один conversation
- `external_id` для груп = `chat_id` (наприклад, "-1001234567890")
- `external_id` для приватних чатів = `user_id` або phone/username

## Застосування змін для існуючих чатів

### 1. Автоматичні зміни (не потребують міграції)

Ці зміни застосуються автоматично при перезавантаженні frontend:

- ✅ **Email HTML парсинг** - всі існуючі email повідомлення будуть відображатися з HTML форматуванням
- ✅ **Markdown парсинг** - всі Telegram повідомлення з Markdown будуть правильно відформатовані
- ✅ **Кольори повідомлень** - нові стилі застосуються до всіх повідомлень
- ✅ **Медіа превью** - всі існуючі медіа файли будуть мати нові превью та lightbox
- ✅ **Валідація телефонів** - нові правила валідації застосуються до всіх нових повідомлень

### 2. Міграція Telegram груп (потрібно запустити скрипт)

Для об'єднання існуючих Telegram груп в один conversation:

```bash
cd backend
python merge_telegram_groups.py
```

Скрипт:
1. Знаходить всі Telegram conversation
2. Групує їх по `chat_id` з `meta_data` повідомлень
3. Об'єднує conversation в один (залишає найстаріший)
4. Переносить всі повідомлення в об'єднаний conversation
5. Оновлює `external_id` на правильний `chat_id`

**Важливо:** Перед запуском міграції зробіть backup бази даних!

```bash
# Backup бази даних
pg_dump -h localhost -p 5434 -U translator crm_db > backup_before_telegram_migration.sql
```

## Перевірка після міграції

1. Перевірте що групи об'єднані:
   ```sql
   SELECT external_id, COUNT(*) as message_count
   FROM communications_conversations c
   JOIN communications_messages m ON m.conversation_id = c.id
   WHERE c.platform = 'telegram' AND c.external_id::text LIKE '-100%'
   GROUP BY external_id;
   ```

2. Перевірте що немає дублікатів:
   ```sql
   SELECT external_id, COUNT(*) as conv_count
   FROM communications_conversations
   WHERE platform = 'telegram' AND external_id::text LIKE '-100%'
   GROUP BY external_id
   HAVING COUNT(*) > 1;
   ```

## Відкат міграції

Якщо щось пішло не так, можна відкатити зміни:

```bash
# Відновити backup
psql -h localhost -p 5434 -U translator crm_db < backup_before_telegram_migration.sql
```

## Примітки

- Міграція безпечна - вона не видаляє дані, тільки об'єднує conversation
- Нові повідомлення автоматично будуть мати правильну структуру
- Якщо міграція не запущена, нові повідомлення все одно будуть правильно групуватися

