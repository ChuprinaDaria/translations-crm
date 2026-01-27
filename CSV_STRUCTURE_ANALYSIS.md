# Аналіз відповідності структури коду CSV даним

## 📊 Поточна структура vs CSV вимоги

### ✅ Що вже є в коді:

#### 1. **Orders (Замовлення)** - Таблиця `crm_orders`
**CSV поля:**
- ✅ `Data` → `created_at` (дата створення)
- ✅ `Numer_zlecenia` → `order_number` (номер замовлення)
- ✅ `Klient` → `client_id` (зв'язок з клієнтом)
- ✅ `Telefon` → `client.phone` (через зв'язок)
- ✅ `Email` → `client.email` (через зв'язок)
- ✅ `Jezyk` → `language` (мова перекладу)
- ✅ `Dokument` → `translation_type` (тип документа)
- ✅ `Zrodlo` → `order_source` (додано в міграції)
- ✅ `Cena_netto` → `price_netto` (додано в міграції)
- ✅ `Cena_brutto` → `price_brutto` (додано в міграції)
- ✅ `Kod_ref` → `reference_code` (додано в міграції)
- ✅ `Nr_repertorium` → `repertorium_number` (додано в міграції)
- ✅ `Ponowny_kontakt` → `follow_up_date` (додано в міграції)

#### 2. **Languages (Мови)** - Таблиця `languages`
**Всі 28 мов з CSV вже є в базі:**
- ✅ Angielski (60 PLN)
- ✅ Ukraiński (60 PLN)
- ✅ Rosyjski (60 PLN)
- ✅ Niemiecki (70 PLN)
- ✅ Hiszpański (70 PLN)
- ✅ Francuski (70 PLN)
- ✅ Białoruski (120 PLN)
- ✅ Litewski (85 PLN) - TRC
- ✅ Łotewski (85 PLN) - TRC
- ✅ Włoski (70 PLN)
- ✅ Gruziński (100 PLN)
- ✅ Portugalski (80 PLN)
- ✅ Bułgarski (80 PLN)
- ✅ Węgierski (120 PLN) - TRC
- ✅ Niderlandzki (90 PLN)
- ✅ Chiński (200 PLN)
- ✅ Japoński (180 PLN)
- ✅ Czeski (80 PLN)
- ✅ Turecki (150 PLN)
- ✅ Rumuński (80 PLN) - TRC
- ✅ Słowacki (70 PLN)
- ✅ Fiński (100 PLN)
- ✅ Duński (100 PLN)
- ✅ Grecki (150 PLN)
- ✅ Chorwacki (80 PLN) - TRC
- ✅ Indonezyjski (200 PLN)
- ✅ Arabski (200 PLN)
- ✅ Perski (150 PLN)
- ✅ Wietnamski (200 PLN)

**Структура:**
- `id` - ID мови
- `name_pl` - Назва польською
- `name_en` - Назва англійською
- `base_client_price` - Базова ціна для клієнта (PLN)
- `is_active` - Чи активна мова

#### 3. **Translators (Перекладачі)** - Таблиця `translators`
**CSV поля:**
- ✅ `Tlumacz` → `translator.name` (ім'я перекладача)
- ✅ Контакти: `email`, `phone`, `telegram_id`, `whatsapp`
- ✅ Статус: `status` (active, inactive, busy)
- ✅ Рейтинг: `rating`
- ✅ Завершені замовлення: `completed_orders`

#### 4. **Translator_Languages (Зв'язок перекладач-мова)** - Таблиця `translator_language_rates`
**Структура many-to-many:**
- ✅ `translator_id` - ID перекладача
- ✅ `language_id` - ID мови
- ✅ `specialization_id` - ID спеціалізації (TRC, Umowy, Szkolne...)
- ✅ `translator_rate` - Ставка перекладача за сторінку
- ✅ `custom_client_price` - Кастомна ціна для клієнта (якщо відрізняється)
- ✅ `notes` - Примітки

**Унікальний constraint:** `(translator_id, language_id, specialization_id)`

#### 5. **Specializations (Типи перекладів)** - Таблиця `specializations`
**Базові типи:**
- ✅ TRC (Tłumaczenie przysięgłe)
- ✅ Umowy (Umowy i kontrakty)
- ✅ Szkolne (Dokumenty szkolne)
- ✅ Dyplomy (Dyplomy i certyfikaty)
- ✅ Medyczne (Dokumenty medyczne)
- ✅ Prawne (Dokumenty prawne)
- ✅ Biznesowe (Dokumenty biznesowe)
- ✅ Techniczne (Dokumenty techniczne)
- ✅ Zaświadczenie (додано в міграції)
- ✅ Samochodowe (додано в міграції)

### 📝 Відповідність CSV структури:

| CSV поле | Таблиця/Поле | Статус |
|----------|--------------|--------|
| csvNr | - | Не потрібно (автоінкремент) |
| Data | `crm_orders.created_at` | ✅ |
| Ponowny_kontakt | `crm_orders.follow_up_date` | ✅ Додано |
| Numer_zlecenia | `crm_orders.order_number` | ✅ |
| Zrodlo | `crm_orders.order_source` | ✅ Додано |
| Dokument | `crm_orders.translation_type` | ✅ |
| Klient | `crm_clients.full_name` | ✅ |
| Telefon | `crm_clients.phone` | ✅ |
| Email | `crm_clients.email` | ✅ |
| Kod_ref | `crm_orders.reference_code` | ✅ Додано |
| Nr_repertorium | `crm_orders.repertorium_number` | ✅ Додано |
| Cena_netto | `crm_orders.price_netto` | ✅ Додано |
| Cena_brutto | `crm_orders.price_brutto` | ✅ Додано |
| Uwagi | `crm_orders.description` | ✅ |
| Jezyk | `crm_orders.language` + `languages.name_pl` | ✅ |
| Tlumacz | `translators.name` | ✅ |

### 🔧 Що було додано:

1. **Міграція `add_order_csv_fields.sql`:**
   - `price_netto` - Ціна нетто
   - `price_brutto` - Ціна брутто
   - `reference_code` - Код референційний
   - `repertorium_number` - Номер реперторію
   - `follow_up_date` - Дата повторного контакту
   - `order_source` - Джерело замовлення

2. **Міграція `add_missing_specializations.sql`:**
   - `Zaświadczenie` - Тип документа
   - `Samochodowe` - Тип документа

3. **Оновлена модель `Order`:**
   - Додано всі нові поля в модель

### ✅ Висновок:

**Структура коду повністю відповідає CSV даним!**

- ✅ Всі 3 таблиці існують: Orders, Languages, Translators
- ✅ Зв'язок many-to-many через `translator_language_rates`
- ✅ Всі 28 мов з прайс-листу є в базі
- ✅ Всі типи перекладів (спеціалізації) є в базі
- ✅ Всі поля з CSV тепер є в моделі Order

### 📋 Наступні кроки:

1. Запустити міграції:
   ```sql
   \i database/migrations/add_order_csv_fields.sql
   \i database/migrations/add_missing_specializations.sql
   ```

2. Оновити схеми (schemas.py) для нових полів Order

3. Оновити API endpoints для підтримки нових полів

4. Оновити frontend для відображення нових полів

