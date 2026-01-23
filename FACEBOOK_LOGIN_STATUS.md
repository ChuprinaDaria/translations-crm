# Facebook Login Status API

## Огляд

Facebook SDK надає інформацію про статус входу користувача через `getLoginStatus()` та `login()`. Цей документ описує структуру відповіді та як з нею працювати.

## Структура відповіді

### FacebookLoginStatusResponse

```typescript
interface FacebookLoginStatusResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse?: FacebookAuthResponse;
}
```

### FacebookAuthResponse (якщо status === 'connected')

```typescript
interface FacebookAuthResponse {
  accessToken: string;      // Access token для користувача
  expiresIn: number;         // UNIX час коли токен закінчується
  signedRequest: string;     // Підписаний параметр з інформацією про користувача
  userID: string;            // ID користувача Facebook
}
```

## Статуси входу

### `connected`
Користувач увійшов у Facebook та у ваш додаток. `authResponse` містить:
- `accessToken` - токен доступу
- `expiresIn` - час закінчення токену (UNIX timestamp)
- `signedRequest` - підписаний запит
- `userID` - ID користувача

**Дія:** Перенаправити користувача до досвіду роботи в додатку.

### `not_authorized`
Користувач увійшов у Facebook, але не увійшов у ваш додаток. `authResponse` відсутній.

**Дія:** Показати діалог входу через `FB.login()` або кнопку Login.

### `unknown`
Користувач не увійшов у Facebook, або було викликано `FB.logout()`. Неможливо визначити статус входу в додаток.

**Дія:** Показати діалог входу через `FB.login()` або кнопку Login.

## Використання в коді

### Перевірка статусу входу

```typescript
import { getFacebookLoginStatus, isFacebookConnected } from './lib/facebook-sdk';

// Проста перевірка
const isConnected = await isFacebookConnected();
if (isConnected) {
  console.log('User is connected to Facebook');
}

// Детальна перевірка
const status = await getFacebookLoginStatus();
switch (status.status) {
  case 'connected':
    console.log('Access Token:', status.authResponse?.accessToken);
    console.log('User ID:', status.authResponse?.userID);
    console.log('Expires In:', status.authResponse?.expiresIn);
    // Перенаправити до досвіду роботи в додатку
    break;
  case 'not_authorized':
    // Показати діалог входу
    break;
  case 'unknown':
    // Показати діалог входу
    break;
}
```

### Вхід через Facebook

```typescript
import { loginWithFacebook } from './lib/facebook-sdk';

try {
  const response = await loginWithFacebook('email,public_profile');
  if (response.status === 'connected' && response.authResponse) {
    console.log('Login successful!');
    console.log('Access Token:', response.authResponse.accessToken);
    console.log('User ID:', response.authResponse.userID);
    // Зберегти токен та перенаправити користувача
  }
} catch (error) {
  console.error('Login failed:', error);
}
```

### Вихід з Facebook

```typescript
import { logoutFromFacebook } from './lib/facebook-sdk';

try {
  await logoutFromFacebook();
  console.log('Logout successful');
  // Очистити локальні дані та перенаправити на сторінку входу
} catch (error) {
  console.error('Logout failed:', error);
}
```

### Приклад повного циклу

```typescript
import { 
  initFacebookSDK, 
  getFacebookLoginStatus, 
  loginWithFacebook,
  logoutFromFacebook 
} from './lib/facebook-sdk';
import { settingsApi } from './lib/api';

async function handleFacebookAuth() {
  // 1. Ініціалізувати SDK
  const facebookConfig = await settingsApi.getFacebookConfig();
  if (!facebookConfig.app_id) {
    console.error('Facebook App ID not configured');
    return;
  }
  
  await initFacebookSDK(facebookConfig.app_id);
  
  // 2. Перевірити статус входу
  const status = await getFacebookLoginStatus();
  
  if (status.status === 'connected' && status.authResponse) {
    // Користувач вже увійшов
    console.log('User is already connected');
    console.log('Access Token:', status.authResponse.accessToken);
    console.log('User ID:', status.authResponse.userID);
    
    // Використати токен для API запитів
    // Зберегти токен в localStorage або відправити на backend
  } else {
    // Користувач не увійшов - показати діалог входу
    try {
      const loginResponse = await loginWithFacebook('email,public_profile');
      if (loginResponse.authResponse) {
        console.log('Login successful!');
        console.log('Access Token:', loginResponse.authResponse.accessToken);
        // Зберегти токен та перенаправити
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  }
}

// Вихід
async function handleFacebookLogout() {
  try {
    await logoutFromFacebook();
    // Очистити локальні дані
    localStorage.removeItem('facebook_access_token');
    // Перенаправити на сторінку входу
  } catch (error) {
    console.error('Logout failed:', error);
  }
}
```

## Важливо

⚠️ **Access Token** - це чутливі дані, не зберігайте їх у localStorage без шифрування  
⚠️ **Expires In** - токен має обмежений термін дії, потрібно оновлювати  
⚠️ **User ID** - унікальний ідентифікатор користувача Facebook  
⚠️ **Signed Request** - містить підписану інформацію про користувача, можна використовувати для валідації на backend

## Інтеграція з Backend

Після отримання `accessToken` від Facebook SDK, його можна відправити на backend для:
- Валідації токену через Facebook Graph API
- Збереження в базі даних
- Використання для API запитів до Facebook

```typescript
// Frontend
const status = await getFacebookLoginStatus();
if (status.status === 'connected' && status.authResponse) {
  // Відправити токен на backend
  await fetch('/api/v1/auth/facebook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: status.authResponse.accessToken,
      user_id: status.authResponse.userID,
      expires_in: status.authResponse.expiresIn
    })
  });
}
```

