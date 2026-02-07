# Інструкції для оновлення на сервері

## 1. Оновити код

```bash
cd /opt/translations/translations-crm
git pull origin main
```

## 2. Перебудувати та перезапустити сервіси

**Використовуйте `docker compose` (без дефісу) замість `docker-compose`:**

```bash
# Перебудувати та перезапустити backend (для нових змін в router)
docker compose -f docker-compose.production.yml up -d --build backend

# Перебудувати та перезапустити telegram_listener (для виправлення затримки + автобот)
docker compose -f docker-compose.production.yml up -d --build telegram_listener

# Перебудувати та перезапустити frontend (для виправлення кешу + auto-refresh)
docker compose -f docker-compose.production.yml up -d --build frontend
```

**Або перебудувати все одразу:**
```bash
docker compose -f docker-compose.production.yml up -d --build
```

## 3. Створити адмін-акаунти

```bash
# Запустити скрипт створення адмінів
docker exec -it crm_translations_backend python create_admin.py
```

Скрипт створить/оновить 2 акаунти:
- `maksym.tarczewski@tlumaczeniamt.pl` (пароль: `Admin2026!MT`, роль: OWNER)
- `info@lazysoft.pl` (пароль: `Admin2026!LS`, роль: OWNER)

Якщо акаунти вже існують, скрипт оновить їх до ролі OWNER та встановить новий пароль.

## 4. Перевірити логи (опціонально)

```bash
# Перевірити що telegram_listener працює
docker logs crm_translations_telegram_listener --tail 50

# Перевірити що backend працює
docker logs crm_translations_backend --tail 50

# Перевірити що frontend працює
docker logs crm_translations_frontend --tail 50
```

## Альтернатива: Якщо `docker compose` теж не працює

Якщо і `docker compose` не знайдено, можна використати `docker-compose` після встановлення:

```bash
# Встановити docker-compose (якщо потрібно)
apt update
apt install docker-compose-plugin

# Або використати docker безпосередньо для rebuild
cd /opt/translations/translations-crm
docker build -t crm_backend ./backend
docker build -t crm_frontend ./frontend
docker build -t crm_telegram_listener ./backend
docker restart crm_translations_backend
docker restart crm_translations_telegram_listener
docker restart crm_translations_frontend
```

---

## Що було виправлено:

1. ✅ **Затримка повідомлень**: WebSocket сповіщення надсилається одразу, ДО завантаження медіа
2. ✅ **Автобот**: Інтегровано в telegram_listener, працює поза робочим часом
3. ✅ **Автооновлення**: Сторінка оновлюється кожні 15 секунд (fallback якщо WebSocket не працює)
4. ✅ **Кеш**: Виправлено невідповідність ключів React Query

Після цих кроків все має працювати! 🚀

