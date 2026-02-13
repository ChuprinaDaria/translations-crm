# Швидкі команди для InPost

## 🔍 Перевірка поточних налаштувань

```bash
# Подивитися поточні налаштування в БД
docker exec -it crm_translations_db psql -U postgres -d crm_db -c "
SELECT 
  id,
  CASE 
    WHEN api_key IS NULL THEN '❌ NULL'
    WHEN LENGTH(api_key) < 50 THEN '❌ TOO SHORT (' || LENGTH(api_key) || ' chars) - not a JWT!'
    ELSE '✅ OK (' || LENGTH(api_key) || ' chars)'
  END as api_key_status,
  organization_id,
  sandbox_mode,
  is_enabled
FROM inpost_settings;
"
```

## 📝 Оновлення налаштувань

```bash
# Спосіб 1: Інтерактивно
docker exec -it crm_translations_db psql -U postgres -d crm_db

# Потім в psql:
UPDATE inpost_settings 
SET 
  api_key = 'YOUR_JWT_TOKEN_HERE',
  organization_id = '124089',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

# Вийти з psql
\q
```

```bash
# Спосіб 2: Одна команда (замініть YOUR_JWT_TOKEN)
docker exec -it crm_translations_db psql -U postgres -d crm_db -c "
UPDATE inpost_settings 
SET 
  api_key = 'YOUR_JWT_TOKEN_HERE',
  organization_id = '124089',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1;
"
```

## 🔄 Перезапуск сервісів

```bash
# Перезапустити тільки backend
docker-compose restart backend

# Або перезапустити все
docker-compose restart
```

## 📊 Моніторинг логів

```bash
# Дивитися логи InPost в реальному часі
docker-compose logs -f backend | grep -i inpost

# Дивитися останні 100 рядків логів InPost
docker-compose logs --tail=100 backend | grep -i inpost

# Знайти помилки InPost
docker-compose logs backend | grep -i "inpost.*error"

# Знайти всі API відповіді InPost
docker-compose logs backend | grep -i "\[inpost\] response"
```

## ✅ Перевірка після налаштування

```bash
# 1. Перевірити налаштування в БД
docker exec -it crm_translations_db psql -U postgres -d crm_db -c "
SELECT 
  LENGTH(api_key) as token_length,
  organization_id,
  sandbox_mode,
  is_enabled
FROM inpost_settings;
"

# Очікуваний результат:
# token_length | organization_id | sandbox_mode | is_enabled
# -------------|-----------------|--------------|------------
#     300      |     124089      |      f       |     t

# 2. Перезапустити backend
docker-compose restart backend

# 3. Дивитися логи
docker-compose logs -f backend | grep -i inpost

# Шукайте:
# ✅ [InPost] get_api_key: Using api_key (JWT token), length: 300
# ✅ [InPost] Response status: 200
```

## 🧪 Тестування

```bash
# Створіть тестову посилку через UI або API
# Потім перевірте логи:
docker-compose logs --tail=50 backend | grep -i inpost

# Успішне створення покаже:
# [InPost] Request URL: https://api-shipx-pl.easypack24.net/v1/organizations/124089/shipments
# [InPost] Response status: 201
# [InPost] Shipment created: XXXXX...
```

## 🆘 Діагностика проблем

```bash
# Якщо бачите помилку 401:
docker-compose logs backend | grep -A 5 "401"

# Перевірте довжину токена:
docker exec -it crm_translations_db psql -U postgres -d crm_db -c "
SELECT LENGTH(api_key) FROM inpost_settings;
"
# Має бути > 200

# Перевірте чи токен не NULL:
docker exec -it crm_translations_db psql -U postgres -d crm_db -c "
SELECT api_key IS NULL as is_null FROM inpost_settings;
"
# Має бути: f (false)
```

## 📋 Корисні запити до БД

```bash
# Подивитися всі посилки
docker exec -it crm_translations_db psql -U postgres -d crm_db -c "
SELECT id, tracking_number, status, created_at 
FROM inpost_shipments 
ORDER BY created_at DESC 
LIMIT 10;
"

# Подивитися всі налаштування
docker exec -it crm_translations_db psql -U postgres -d crm_db -c "
SELECT * FROM inpost_settings;
"

# Видалити всі тестові посилки (ОБЕРЕЖНО!)
docker exec -it crm_translations_db psql -U postgres -d crm_db -c "
DELETE FROM inpost_shipments WHERE status = 'draft';
"
```

## 🔐 Безпека

```bash
# Переконайтеся, що JWT токен не потрапить в логи або публічні файли!
# Перевірте .gitignore:
cat .gitignore | grep -E "(\.env|secret|key)"

# Ніколи не commitте файли з токенами:
git status
```

## 📚 Додаткова документація

- `РЕЗЮМЕ_ВИПРАВЛЕНЬ_INPOST.md` - детальне резюме виправлень
- `ІНСТРУКЦІЯ_ВИПРАВЛЕННЯ_INPOST.md` - покрокова інструкція
- `INPOST_ШВИДКИЙ_СТАРТ.md` - початкове налаштування
- `НАЛАШТУВАННЯ_ІНТЕГРАЦІЙ.md` - загальна інформація про інтеграції

---

**Примітка:** Замініть `YOUR_JWT_TOKEN_HERE` на ваш справжній JWT токен з панелі InPost!

