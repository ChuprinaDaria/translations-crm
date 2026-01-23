# Facebook SDK for JavaScript Integration

## Огляд

Facebook SDK for JavaScript інтегровано в додаток для підтримки Facebook Login та інших функцій Facebook API.

## Як це працює

### 1. Асинхронне завантаження SDK

SDK завантажується асинхронно в `index.html` і не блокує завантаження сторінки:

```html
<script>
  window.fbAsyncInit = function() {
    console.log('Facebook SDK script loaded and ready for initialization');
  };

  (function(d, s, id){
     var js, fjs = d.getElementsByTagName(s)[0];
     if (d.getElementById(id)) {return;}
     js = d.createElement(s); js.id = id;
     js.src = "https://connect.facebook.net/en_US/sdk.js";
     js.async = true;
     js.defer = true;
     fjs.parentNode.insertBefore(js, fjs);
   }(document, 'script', 'facebook-jssdk'));
</script>
```

### 2. Ініціалізація з App ID

SDK ініціалізується автоматично в `App.tsx` після автентифікації користувача, використовуючи App ID з налаштувань:

```typescript
// App.tsx
useEffect(() => {
  if (!isAuthenticated) return;

  const initSDK = async () => {
    try {
      const facebookConfig = await settingsApi.getFacebookConfig();
      if (facebookConfig.app_id) {
        await initFacebookSDK(facebookConfig.app_id);
      }
    } catch (error) {
      console.debug('Facebook SDK initialization skipped:', error);
    }
  };

  initSDK();
}, [isAuthenticated]);
```

### 3. Утиліти для роботи з SDK

Утиліти знаходяться в `frontend/src/lib/facebook-sdk.ts`:

- `initFacebookSDK(appId)` - ініціалізує SDK з App ID
- `isFacebookSDKReady()` - перевіряє чи SDK завантажено
- `getFacebookSDK()` - повертає екземпляр SDK

## Використання

### Перевірка готовності SDK

```typescript
import { isFacebookSDKReady, getFacebookSDK } from './lib/facebook-sdk';

if (isFacebookSDKReady()) {
  const FB = getFacebookSDK();
  // Використовуйте FB для роботи з Facebook API
}
```

### Приклад: Facebook Login

```typescript
import { getFacebookSDK } from './lib/facebook-sdk';

const handleFacebookLogin = () => {
  if (!isFacebookSDKReady()) {
    console.error('Facebook SDK not ready');
    return;
  }

  const FB = getFacebookSDK();
  FB.login((response) => {
    if (response.authResponse) {
      console.log('User logged in:', response);
      // Обробка успішного входу
    }
  }, { scope: 'email,public_profile' });
};
```

## Налаштування в Meta Dashboard

Для використання Facebook SDK потрібно:

1. **App ID** - вже налаштовано в Settings → Facebook
2. **Valid OAuth Redirect URIs** - вже налаштовано для OAuth callback
3. **Allowed Domains for JavaScript SDK** - додайте ваш домен:
   - `tlumaczeniamt.com.pl`
   - `www.tlumaczeniamt.com.pl`
   - `localhost` (для розробки)

### Як налаштувати Allowed Domains (Разрешенные домены для SDK JavaScript):

1. Перейдіть в [Meta for Developers](https://developers.facebook.com/)
2. Виберіть ваш додаток
3. Перейдіть в **Settings** → **Basic**
4. Прокрутіть до розділу **"App Domains"** (або **"Allowed Domains for JavaScript SDK"**)
5. Додайте домени (по одному на рядок):
   - `tlumaczeniamt.com.pl`
   - `www.tlumaczeniamt.com.pl`
   - `localhost` (для розробки)
6. Натисніть **"Save Changes"**

⚠️ **Важливо:**
- Додавайте домени БЕЗ `http://` або `https://`
- Додавайте БЕЗ слешів в кінці (`/`)
- `localhost` потрібен для розробки на локальній машині

## Переваги асинхронного завантаження

✅ **Не блокує завантаження сторінки** - SDK завантажується паралельно з іншими ресурсами  
✅ **Швидше завантаження** - не чекає на SDK для відображення контенту  
✅ **Оптимізація продуктивності** - використовує `async` та `defer` атрибути  
✅ **Гнучкість** - SDK ініціалізується тільки коли потрібен (після автентифікації)

## Troubleshooting

### SDK не завантажується

1. Перевірте консоль браузера на помилки
2. Переконайтеся, що домен додано в Meta Dashboard → App Domains
3. Перевірте, що App ID правильний в Settings → Facebook

### SDK не ініціалізується

1. Перевірте, що користувач автентифікований
2. Перевірте, що App ID встановлено в Settings → Facebook
3. Перевірте логи в консолі браузера

### Помилка "SDK not available"

- SDK може ще завантажуватися, почекайте кілька секунд
- Перевірте інтернет-з'єднання
- Перевірте, що блокуючі рекламу не блокує Facebook SDK

