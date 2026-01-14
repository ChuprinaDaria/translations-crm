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
async function apiFetch<T>(
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
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }
    console.error('[API] Error response:', errorData);
    
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
    const text = await response.text();
    console.error('[API] Failed to parse JSON response. Response text:', text.substring(0, 500));
    throw new ApiError(
      response.status,
      'Invalid JSON response',
      { detail: `Сервер повернув невалідний JSON. Відповідь: ${text.substring(0, 200)}` }
    );
  }
}

// Fetch wrapper for multipart/form-data
async function apiFetchMultipart<T>(
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
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }
    console.error('[API] Error response:', errorData);
    
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

export { apiFetch, apiFetchMultipart };

