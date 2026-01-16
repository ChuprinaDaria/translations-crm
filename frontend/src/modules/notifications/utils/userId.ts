/**
 * Utility для отримання user_id з JWT токену
 */
import { getToken } from '@/lib/api/token';

export function getUserIdFromToken(): string | null {
  try {
    const token = getToken();
    if (!token) return null;

    // Декодувати JWT токен
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    // user_id може бути в різних полях залежно від структури токену
    return payload.sub || payload.user_id || payload.id || null;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

