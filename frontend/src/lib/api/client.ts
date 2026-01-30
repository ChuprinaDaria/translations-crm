// API Client with JWT handling and interceptors

import { API_BASE_URL } from './config';
import { tokenManager } from './token';

// Custom error class
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: any
  ) {
    super(data?.detail || statusText || 'API Error');
    this.name = 'ApiError';
  }
}

// Fetch wrapper with authentication and error handling
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = tokenManager.getToken();
  
  console.log(`[API] ${options.method || 'GET'} ${endpoint}`);
  
  // Якщо body є FormData, не встановлюємо Content-Type (браузер сам додасть multipart/form-data з boundary)
  const isFormData = options.body instanceof FormData;
  
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('[API] Authorization header added');
  } else {
    console.log('[API] No token available');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    mode: 'cors',
  });

  console.log(`[API] Response status: ${response.status}`);

  // Handle 401 Unauthorized - token expired or invalid
  if (response.status === 401) {
    console.log('[API] Unauthorized (401) - clearing token and dispatching event');
    tokenManager.removeToken();
    
    // Dispatch custom event for auth state change
    window.dispatchEvent(new CustomEvent('auth:token-changed'));
    
    // Don't throw here - let the caller handle it
    // This allows components to handle logout gracefully
  }

  if (!response.ok) {
    let errorData;
    // Використовуємо clone() щоб не читати body двічі
    const responseClone = response.clone();
    try {
      errorData = await response.json();
    } catch {
      // Якщо не вдалося прочитати JSON, спробуємо прочитати текст
      try {
        const text = await responseClone.text();
        errorData = { detail: text || response.statusText };
      } catch {
        errorData = { detail: response.statusText };
      }
    }
    console.error('[API] Error response:', errorData);
    
    // Handle "User not found" error - clear all storage and force logout
    const errorDetail = errorData?.detail || '';
    const isUserNotFound = 
      typeof errorDetail === 'string' && 
      (errorDetail.toLowerCase().includes('user not found') || 
       errorDetail.toLowerCase().includes('user not found'));
    
    if (isUserNotFound || response.status === 404) {
      console.error('[API] User not found - clearing all storage and forcing logout');
      // Clear all localStorage to remove old UUID tokens
      localStorage.clear();
      tokenManager.removeToken();
      // Dispatch logout event
      window.dispatchEvent(new CustomEvent('auth:logout'));
      window.dispatchEvent(new CustomEvent('auth:token-changed'));
    }
    
    // Log detailed validation errors for 422
    if (response.status === 422 && errorData.detail && Array.isArray(errorData.detail)) {
      console.error('[API] Validation errors:', JSON.stringify(errorData.detail, null, 2));
    }
    
    // Handle 502 Bad Gateway - backend server is down
    if (response.status === 502) {
      console.error('[API] Backend server is not responding (502 Bad Gateway)');
      errorData = { 
        detail: 'Сервер тимчасово недоступний. Спробуйте пізніше або зверніться до адміністратора.' 
      };
    }
    
    throw new ApiError(response.status, response.statusText, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  // Get content type
  const contentType = response.headers.get('content-type') || '';
  
  // Перевірка чи відповідь є HTML (помилка сервера або редирект)
  if (contentType.includes('text/html')) {
    const htmlText = await response.text();
    console.error('[API] HTML response received instead of JSON:', htmlText.substring(0, 200));
    throw new ApiError(
      response.status,
      'Server returned HTML instead of JSON',
      { detail: 'Сервер повернув HTML замість JSON. Можливо, ендпоінт не існує або є помилка на сервері.' }
    );
  }
  
  // Handle text/plain response
  if (contentType.includes('text/plain')) {
    const text = await response.text();
    console.log('[API] Plain text response received');
    return text as T;
  }

  // Handle JSON response (default)
  try {
    const jsonData = await response.json();
    console.log('[API] JSON response received');
    return jsonData;
  } catch (jsonError) {
    // Якщо не вдалося розпарсити JSON, спробуємо прочитати текст для діагностики
    // Використовуємо clone() щоб не читати body двічі (хоча це не повинно статися тут)
    try {
      const responseClone = response.clone();
      const text = await responseClone.text();
      console.error('[API] Failed to parse JSON response. Response text:', text.substring(0, 500));
      throw new ApiError(
        response.status,
        'Invalid JSON response',
        { detail: `Сервер повернув невалідний JSON. Відповідь: ${text.substring(0, 200)}` }
      );
    } catch (textError) {
      // Якщо навіть текст не вдалося прочитати
      console.error('[API] Failed to read response body:', textError);
      throw new ApiError(
        response.status,
        'Invalid response',
        { detail: 'Не вдалося прочитати відповідь сервера' }
      );
    }
  }
}

// Fetch wrapper for multipart/form-data
export async function apiFetchMultipart<T>(
  endpoint: string,
  formData: FormData,
  method: string = 'POST'
): Promise<T> {
  const token = tokenManager.getToken();
  
  console.log(`[API] ${method} ${endpoint} (multipart/form-data)`);
  
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('[API] Authorization header added');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: formData,
    mode: 'cors',
  });

  console.log(`[API] Response status: ${response.status}`);

  // Handle 401 Unauthorized
  if (response.status === 401) {
    console.log('[API] Unauthorized (401) - clearing token and dispatching event');
    tokenManager.removeToken();
    window.dispatchEvent(new CustomEvent('auth:token-changed'));
  }

  if (!response.ok) {
    let errorData;
    // Використовуємо clone() щоб не читати body двічі
    const responseClone = response.clone();
    try {
      errorData = await response.json();
    } catch {
      // Якщо не вдалося прочитати JSON, спробуємо прочитати текст
      try {
        const text = await responseClone.text();
        errorData = { detail: text || response.statusText };
      } catch {
        errorData = { detail: response.statusText };
      }
    }
    console.error('[API] Error response:', errorData);
    
    // Handle 502 Bad Gateway - backend server is down
    if (response.status === 502) {
      console.error('[API] Backend server is not responding (502 Bad Gateway)');
      errorData = { 
        detail: 'Сервер тимчасово недоступний. Спробуйте пізніше або зверніться до адміністратора.' 
      };
    }
    
    throw new ApiError(response.status, response.statusText, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  // Get content type
  const contentType = response.headers.get('content-type') || '';
  
  // Перевірка чи відповідь є HTML (помилка сервера або редирект)
  if (contentType.includes('text/html')) {
    const htmlText = await response.text();
    console.error('[API] HTML response received instead of JSON:', htmlText.substring(0, 200));
    throw new ApiError(
      response.status,
      'Server returned HTML instead of JSON',
      { detail: 'Сервер повернув HTML замість JSON. Можливо, ендпоінт не існує або є помилка на сервері.' }
    );
  }

  try {
    const jsonData = await response.json();
    console.log('[API] JSON response received');
    return jsonData;
  } catch (jsonError) {
    // Якщо не вдалося розпарсити JSON, спробуємо прочитати текст для діагностики
    const text = await response.text();
    console.error('[API] Failed to parse JSON response. Response text:', text.substring(0, 500));
    throw new ApiError(
      response.status,
      'Invalid JSON response',
      { detail: `Сервер повернув невалідний JSON. Відповідь: ${text.substring(0, 200)}` }
    );
  }
}

// API Client object with convenience methods
export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    return apiFetch<T>(endpoint, { ...options, method: 'GET' });
  },
  
  post: <T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> => {
    return apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  
  put: <T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> => {
    return apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  
  patch: <T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> => {
    return apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  },
  
  delete: <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    return apiFetch<T>(endpoint, { ...options, method: 'DELETE' });
  },
};

