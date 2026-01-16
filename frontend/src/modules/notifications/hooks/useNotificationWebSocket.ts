/**
 * Hook для роботи з WebSocket нотифікаціями
 */
import { useEffect, useRef } from 'react';
import { notificationWebSocket } from '../services/websocket';
import type { WebSocketNotificationMessage } from '../types';
import { getToken } from '@/lib/api/token';
import { useUser } from '@/modules/auth/hooks/useUser'; // Припускаю що є такий hook

export function useNotificationWebSocket(
  onNotification?: (notification: WebSocketNotificationMessage['data']) => void
) {
  const onNotificationRef = useRef(onNotification);

  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    // Отримати user_id з токену або з контексту
    // Тимчасово використовуємо localStorage або інший спосіб
    const token = getToken();
    if (!token) return;

    // TODO: Отримати user_id з токену (JWT decode) або з API
    // Для прикладу використовуємо тимчасове рішення
    // В реальності треба декодувати JWT токен або використати API для отримання поточного користувача
    
    // Підключитися до WebSocket
    const userId = localStorage.getItem('userId'); // Тимчасово
    if (!userId) {
      console.warn('[useNotificationWebSocket] No userId found');
      return;
    }

    notificationWebSocket.connect(userId);

    // Підписатися на нотифікації
    const unsubscribe = notificationWebSocket.onNotification((notification) => {
      onNotificationRef.current?.(notification);
    });

    // Ping кожні 30 секунд для підтримки з'єднання
    const pingInterval = setInterval(() => {
      notificationWebSocket.ping();
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(pingInterval);
      notificationWebSocket.disconnect();
    };
  }, []);

  return {
    isConnected: notificationWebSocket.isConnected(),
  };
}

