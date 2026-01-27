# Оновлення фронтенду для нових полів Order

## ✅ Що вже зроблено:

### 1. Оновлено інтерфейси TypeScript:
- ✅ `clients.ts` - Order interface (додано нові поля)
- ✅ `orders.ts` - OrderCreate та OrderUpdate (додано нові поля)

### 2. Нові поля в Order:
- ✅ `language` - Мова перекладу
- ✅ `translation_type` - Тип перекладу
- ✅ `payment_method` - Спосіб оплати
- ✅ `price_netto` - Ціна нетто
- ✅ `price_brutto` - Ціна брутто
- ✅ `reference_code` - Код референційний (Kod_ref)
- ✅ `repertorium_number` - Номер реперторію (Nr_repertorium)
- ✅ `follow_up_date` - Дата повторного контакту (Ponowny_kontakt)
- ✅ `order_source` - Джерело замовлення (Zrodlo)

## 🔄 Що потрібно зробити:

### 1. CreateOrderDialog.tsx
**Потрібно:**
- [ ] Замінити статичний список LANGUAGES на завантаження з API (languagesApi.getLanguages())
- [ ] Додати поля для price_netto та price_brutto
- [ ] Додати поле order_source (WhatsApp, Email, Formularz kontaktowy)
- [ ] Передавати нові поля в ordersApi.createOrder()

**Файл:** `frontend/src/modules/communications/components/SmartActions/CreateOrderDialog.tsx`

### 2. OrderNotesSheet.tsx
**Потрібно:**
- [ ] Додати відображення нових полів (price_netto, price_brutto, reference_code, repertorium_number, follow_up_date, order_source)
- [ ] Додати можливість редагування нових полів

**Файл:** `frontend/src/modules/crm/components/OrderNotesSheet.tsx`

### 3. OrdersListPage.tsx
**Потрібно:**
- [ ] Додати колонки для нових полів (якщо потрібно)
- [ ] Додати фільтри за order_source, language

**Файл:** `frontend/src/modules/crm/pages/OrdersListPage.tsx`

### 4. OrderDetailSheet.tsx
**Потрібно:**
- [ ] Додати відображення нових полів
- [ ] Додати можливість редагування

**Файл:** `frontend/src/modules/crm/components/OrderDetailSheet.tsx`

### 5. OrderTabContent.tsx
**Потрібно:**
- [ ] Додати відображення нових полів в деталях замовлення

**Файл:** `frontend/src/modules/crm/components/OrderTabContent.tsx`

### 6. FinancePage.tsx / OrderProfitTable.tsx
**Потрібно:**
- [ ] Використовувати price_netto та price_brutto замість старих полів
- [ ] Відображати reference_code та repertorium_number

**Файли:**
- `frontend/src/modules/finance/pages/FinancePage.tsx`
- `frontend/src/modules/finance/components/OrderProfitTable.tsx`

### 7. Мобільна версія
**Потрібно:**
- [ ] Перевірити всі мобільні компоненти
- [ ] Додати нові поля в мобільні форми

## 📋 Приклад оновлення CreateOrderDialog:

```typescript
// Замість статичного списку:
const LANGUAGES = [...];

// Використовувати:
const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);

useEffect(() => {
  if (open) {
    loadLanguages();
  }
}, [open]);

const loadLanguages = async () => {
  try {
    const languages = await languagesApi.getLanguages();
    setAvailableLanguages(languages);
  } catch (error) {
    console.error('Error loading languages:', error);
  }
};

// В формі:
<Select value={language} onValueChange={setLanguage}>
  <SelectTrigger>
    <SelectValue placeholder="Оберіть мову" />
  </SelectTrigger>
  <SelectContent>
    {availableLanguages.map((lang) => (
      <SelectItem key={lang.id} value={lang.name_pl}>
        {lang.name_pl} ({lang.base_client_price} PLN)
      </SelectItem>
    ))}
  </SelectContent>
</Select>

// Додати поля:
const [priceNetto, setPriceNetto] = useState('');
const [priceBrutto, setPriceBrutto] = useState('');
const [orderSource, setOrderSource] = useState('');

// При створенні:
await ordersApi.createOrder({
  // ... існуючі поля
  language: language || undefined,
  translation_type: documentType || customDocumentType || undefined,
  payment_method: paymentMethod !== 'none' ? paymentMethod : undefined,
  price_netto: priceNetto ? parseFloat(priceNetto) : undefined,
  price_brutto: priceBrutto ? parseFloat(priceBrutto) : undefined,
  order_source: orderSource || undefined,
});
```

## 🎯 Пріоритети:

1. **Високий:** CreateOrderDialog - основна форма створення замовлення
2. **Високий:** OrderNotesSheet - редагування замовлення
3. **Середній:** OrdersListPage - відображення списку
4. **Середній:** FinancePage - фінанси
5. **Низький:** Мобільна версія

