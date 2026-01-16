/**
 * Hook для управління нотифікаціями
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationWebSocket } from '../services/websocket';
import { notificationApi } from '../api';
import type { Notification, WebSocketNotificationMessage } from '../types';
import { getUserIdFromToken } from '../utils/userId';
import { toast } from 'sonner';

interface UseNotificationsOptions {
  enabled?: boolean;
  showToasts?: boolean;
  userId?: string;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, showToasts = true, userId: providedUserId } = options;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const processedIds = useRef<Set<string>>(new Set());
  
  // Отримати userId з токену якщо не надано
  const userId = providedUserId || getUserIdFromToken();

  // Завантажити нотифікації
  const loadNotifications = useCallback(async () => {
    if (!enabled) return;
    try {
      const [notificationsData, countData] = await Promise.all([
        notificationApi.getNotifications({ limit: 50 }),
        notificationApi.getUnreadCount(),
      ]);
      setNotifications(notificationsData);
      setUnreadCount(countData.count);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [enabled]);

  // Підключитися до WebSocket
  useEffect(() => {
    if (!enabled || !userId) return;

    notificationWebSocket.connect(userId);

    // Підписатися на нотифікації
    const unsubscribe = notificationWebSocket.onNotification((notification) => {
      // Перевірити чи вже оброблено
      if (processedIds.current.has(notification.id)) {
        return;
      }
      processedIds.current.add(notification.id);

      // Додати до списку
      setNotifications((prev) => [notification as Notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Показати toast якщо увімкнено
      if (showToasts) {
        toast.info(notification.title, {
          description: notification.message,
          duration: 5000,
        });
      }
    });

    // Підписатися на зміни з'єднання
    const unsubscribeConnection = notificationWebSocket.onConnectionChange((connected) => {
      setIsConnected(connected);
    });

    // Завантажити початкові нотифікації
    loadNotifications();

    return () => {
      unsubscribe();
      unsubscribeConnection();
      notificationWebSocket.disconnect();
    };
  }, [enabled, userId, showToasts, loadNotifications]);

  // Позначити як прочитану
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationApi.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, []);

  // Позначити всі як прочитані
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, []);

  // Видалити нотифікацію
  const removeNotification = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    processedIds.current.delete(notificationId);
  }, []);

  return {
    notifications,
    unreadCount,
    isConnected,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    removeNotification,
  };
}

