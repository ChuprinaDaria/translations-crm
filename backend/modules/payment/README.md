# Payment Module

Модуль оплати з інтеграцією Stripe та Przelewy24.

## 📋 Огляд

Модуль Payment забезпечує повну інтеграцію з платіжними провайдерами:
- **Stripe** - міжнародні платежі картами
- **Przelewy24** - популярний польський платіжний шлюз

## 🎯 Функціональність

### Backend

#### Models
- **PaymentSettings** - налаштування платіжних провайдерів
- **PaymentTransaction** - транзакції оплати
- **PaymentLink** - лінки на оплату для клієнтів

#### Services
- **StripeService** - інтеграція зі Stripe API
  - Payment Intents
  - Checkout Sessions
  - Webhooks
  - Refunds
  
- **Przelewy24Service** - інтеграція з Przelewy24 API
  - Реєстрація транзакцій
  - Верифікація платежів
  - Webhooks
  - Методи оплати (BLIK, карти, перекази, Apple Pay, Google Pay)
  - Повернення коштів

#### Endpoints

##### Settings
- `GET /api/v1/payment/settings` - отримати налаштування
- `PUT /api/v1/payment/settings` - оновити налаштування
- `POST /api/v1/payment/settings/test-connection` - тестування з'єднання

##### Transactions
- `POST /api/v1/payment/transactions` - створити транзакцію
- `GET /api/v1/payment/transactions` - список транзакцій
- `GET /api/v1/payment/transactions/{id}` - деталі транзакції

##### Payment Links
- `POST /api/v1/payment/links` - створити лінк на оплату
- `GET /api/v1/payment/links` - список лінків

##### Webhooks
- `POST /api/v1/payment/webhooks/stripe` - Stripe webhook
- `POST /api/v1/payment/webhooks/przelewy24` - P24 webhook

##### Other
- `GET /api/v1/payment/methods` - доступні методи оплати
- `GET /api/v1/payment/stats` - статистика платежів

### Frontend

#### Components
- **PaymentSettings** - налаштування платіжних провайдерів
- **PaymentModal** - модалка створення платежу з вибором провайдера
- **SendPaymentLinkButton** - кнопка відправки лінка на оплату

#### API Client
- Повний TypeScript клієнт для всіх endpoints
- Type-safe інтерфейси
- React Query integration

## 🔧 Налаштування

### 1. Stripe

1. Створіть акаунт на [stripe.com](https://stripe.com)
2. Отримайте API ключі:
   - Publishable key (pk_...)
   - Secret key (sk_...)
   - Webhook secret (whsec_...)

3. Налаштуйте webhook:
   - URL: `https://your-domain.com/api/v1/payment/webhooks/stripe`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`

### 2. Przelewy24

1. Створіть акаунт на [przelewy24.pl](https://www.przelewy24.pl)
2. Отримайте дані:
   - Merchant ID
   - POS ID
   - CRC Key
   - API Key (klucz do raportów)

3. Налаштуйте webhook:
   - URL: `https://your-domain.com/api/v1/payment/webhooks/przelewy24`

4. Для тестування використовуйте Sandbox:
   - Активуйте Sandbox в панелі P24
   - Увімкніть `przelewy24_sandbox` в налаштуваннях

### 3. Backend Configuration

В Settings компоненті фронтенду або через API:

```python
# Stripe
stripe_enabled = True
stripe_public_key = "pk_test_..."
stripe_secret_key = "sk_test_..."
stripe_webhook_secret = "whsec_..."

# Przelewy24
przelewy24_enabled = True
przelewy24_merchant_id = 123456
przelewy24_pos_id = 123456
przelewy24_crc = "your-crc-key"
przelewy24_api_key = "your-api-key"
przelewy24_sandbox = True  # False для production
```

## 📝 Використання

### Backend

#### Створення транзакції

```python
from modules.payment.schemas import PaymentTransactionCreate
from modules.payment.models import PaymentProvider

transaction_data = PaymentTransactionCreate(
    order_id=order.id,
    provider=PaymentProvider.PRZELEWY24,
    amount=Decimal("100.50"),
    currency="PLN",
    customer_email="client@example.com",
    customer_name="Jan Kowalski",
    description="Payment for order #12345"
)

# Через API endpoint POST /api/v1/payment/transactions
```

#### Обробка Webhook

Webhooks обробляються автоматично:
1. Перевірка signature
2. Верифікація транзакції (для P24)
3. Оновлення статусу
4. Створення Finance Transaction

### Frontend

#### Payment Modal

```tsx
import { PaymentModal } from '@/modules/payment/components';

<PaymentModal
  open={showPayment}
  onClose={() => setShowPayment(false)}
  orderId={order.id}
  customerEmail={order.client.email}
  customerName={order.client.full_name}
  defaultAmount={order.price_brutto}
  onSuccess={(paymentUrl) => {
    // Відкрити лінк або показати повідомлення
    window.open(paymentUrl, '_blank');
  }}
/>
```

#### Send Payment Link Button

```tsx
import { SendPaymentLinkButton } from '@/modules/payment/components';

<SendPaymentLinkButton
  orderId={order.id}
  customerEmail={order.client.email}
  customerName={order.client.full_name}
  defaultAmount={order.price_brutto}
  variant="default"
/>
```

## 🔐 Безпека

1. **Sensitive Data**:
   - API ключі зберігаються зашифрованими
   - Webhooks перевіряють signature
   - Basic Auth для API запитів

2. **RBAC Integration**:
   - Owner - повний доступ
   - Manager - створення платежів та лінків
   - Accountant - перегляд статистики

3. **Webhook Security**:
   - Stripe: перевірка через `stripe.Webhook.construct_event`
   - P24: перевірка SHA384 signature

## 📊 Інтеграція з Finance

Після успішної оплати автоматично створюється запис у модулі Finance:

```python
FinanceTransaction(
    order_id=payment.order_id,
    amount_gross=payment.amount,
    payment_date=payment.completed_at.date(),
    payment_method=mapped_method,
    receipt_number=f"PAY-{payment.session_id}",
    notes=f"Automatic payment via {payment.provider.value}"
)
```

## 🧪 Тестування

### Stripe Test Cards

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0025 0000 3155
```

### Przelewy24 Sandbox

```
BLIK: 777XXX (будь-які цифри замість X для успіху)
Other: використовуйте тестові дані з документації Saferpay
```

## 📈 Статистика

Endpoint `GET /api/v1/payment/stats` надає:
- Загальна кількість транзакцій
- Загальна сума
- Успішні/невдалі/очікуючі
- Розподіл по провайдерам
- Розподіл по статусам

## 🔄 Workflow

1. **Manager** створює Payment Link або Transaction
2. **Client** отримує лінк (email/messenger)
3. **Client** переходить на сторінку оплати
4. **Provider** (Stripe/P24) обробляє платіж
5. **Webhook** підтверджує транзакцію
6. **Backend** верифікує та оновлює статус
7. **Finance Module** отримує автоматичний запис
8. **Timeline** оновлюється для замовлення

## 📚 Документація провайдерів

- [Stripe API Docs](https://stripe.com/docs/api)
- [Przelewy24 API Docs](https://www.przelewy24.pl/dokumentacja)

## 🐛 Troubleshooting

### Stripe не підключається
- Перевірте API ключі
- Переконайтесь що використовуєте правильні ключі (test/live)
- Перевірте webhook secret

### P24 помилка верифікації
- Перевірте CRC key
- Переконайтесь що sign розраховується правильно
- Перевірте чи merchantId та posId співпадають

### Webhook не працює
- Перевірте URL доступний з інтернету
- Перевірте IP whitelist (для P24)
- Перегляньте логи webhook calls в dashboard провайдера

## 🎉 Готово!

Модуль Payment повністю інтегрований та готовий до використання!

