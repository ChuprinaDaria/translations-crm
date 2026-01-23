# Які таблиці створюються автоматично

## ❌ Enum класи (НЕ створюють таблиці)

Ці класи - це просто переліки значень, вони **НЕ створюють таблиці** в базі:

- `OrderStatus` - статуси замовлення
- `PaymentMethod` - способи оплати
- `TranslationType` - типи перекладу
- `ClientSource` - джерела клієнтів
- `EntityType` - типи сутностей
- `TimelineStepType` - типи етапів Timeline
- `TranslatorStatus` - статуси перекладача
- `TranslationRequestStatus` - статуси запитів на переклад

**Вони використовуються як значення в колонках таблиць, але самі таблиці не створюють.**

## ✅ Моделі SQLAlchemy (створюють таблиці)

Ці класи наслідують `Base` і **створюють таблиці** в базі:

### Модуль CRM (`modules/crm/models.py`):

1. **`Client`** → таблиця `crm_clients`
2. **`Office`** → таблиця `offices`
3. **`Order`** → таблиця `crm_orders`
4. **`InternalNote`** → таблиця `internal_notes`
5. **`TimelineStep`** → таблиця `timeline_steps`
6. **`Translator`** → таблиця `translators`
7. **`TranslatorLanguage`** → таблиця `translator_languages`
8. **`TranslationRequest`** → таблиця `translation_requests`
9. **`Language`** → таблиця `languages`
10. **`Specialization`** → таблиця `specializations`
11. **`TranslatorLanguageRate`** → таблиця `translator_language_rates`

### Модуль Auth (`modules/auth/models.py`):

11. **`User`** → таблиця `users`

### Модуль Finance (`modules/finance/models.py`):

12. **`Transaction`** → таблиця `transactions`

### Модуль Communications (`modules/communications/models.py`):

13. **`Conversation`** → таблиця `communications_conversations`
14. **`Message`** → таблиця `communications_messages`

### Модуль Notifications (`modules/notifications/models.py`):

15. **`Notification`** → таблиця `notifications`
16. **`NotificationSettings`** → таблиця `notification_settings`

## Підсумок

**Всього буде створено 16 таблиць** з async моделей:

1. `users`
2. `crm_clients`
3. `offices`
4. `crm_orders`
5. `internal_notes`
6. `timeline_steps`
7. `translators`
8. `translator_languages`
9. `translation_requests`
10. `languages`
11. `specializations`
12. `translator_language_rates`
13. `transactions`
14. `communications_conversations`
15. `communications_messages`
16. `notifications`
17. `notification_settings`

## Як перевірити

Після деплою перевірте в базі:

```sql
-- Всі таблиці з async моделей
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN (
    'users', 'crm_clients', 'offices', 'crm_orders', 
    'internal_notes', 'timeline_steps', 'translators',
    'translator_languages', 'translation_requests',
    'languages', 'specializations', 'translator_language_rates',
    'transactions', 'communications_conversations', 
    'communications_messages', 'notifications', 'notification_settings'
)
ORDER BY table_name;
```

## Важливо

- ✅ Enum класи **НЕ створюють таблиці** - вони використовуються як типи даних
- ✅ Тільки класи з `class ModelName(Base)` створюють таблиці
- ✅ Система міграцій створює тільки **відсутні** таблиці
- ✅ Існуючі таблиці **не змінюються** і **не видаляються**

