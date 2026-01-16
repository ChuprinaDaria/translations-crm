import { useState, useEffect, useCallback, useRef } from 'react';
import { NotificationData } from '../components/NotificationToast';

interface UseNotificationsOptions {
  enabled?: boolean;
  onNotification?: (notification: NotificationData) => void;
}

/**
 * Hook для управління нотифікаціями про нові повідомлення
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, onNotification } = options;
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const processedMessageIds = useRef<Set<string>>(new Set());
  const isOnline = useRef(true);

  // Відстеження онлайн статусу
  useEffect(() => {
    const handleOnline = () => {
      isOnline.current = true;
    };
    const handleOffline = () => {
      isOnline.current = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Додати нову нотифікацію
   */
  const addNotification = useCallback(
    (notification: NotificationData) => {
      // Перевіряємо, чи менеджер онлайн
      if (!isOnline.current || !enabled) {
        return;
      }

      // Перевіряємо, чи це повідомлення вже оброблено
      if (processedMessageIds.current.has(notification.id)) {
        return;
      }

      processedMessageIds.current.add(notification.id);
      setNotifications((prev) => [...prev, notification]);
      onNotification?.(notification);
    },
    [enabled, onNotification]
  );

  /**
   * Видалити нотифікацію
   */
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  /**
   * Очистити всі нотифікації
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  /**
   * Перевірити нові повідомлення з API
   */
  const checkNewMessages = useCallback(
    async (conversations: any[], lastCheckedTimestamp?: Date) => {
      if (!enabled || !isOnline.current) {
        return;
      }

      // TODO: Викликати API для перевірки нових повідомлень
      // const newMessages = await inboxApi.getNewMessages(lastCheckedTimestamp);
      
      // Для прикладу - в реальності це буде API виклик
      // newMessages.forEach((message) => {
      //   if (!processedMessageIds.current.has(message.id)) {
      //     addNotification({
      //       id: message.id,
      //       conversationId: message.conversation_id,
      //       clientName: message.client_name,
      //       channel: message.channel,
      //       message: message.text,
      //       timestamp: new Date(message.created_at),
      //     });
      //   }
      // });
    },
    [enabled, addNotification]
  );

  return {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    checkNewMessages,
  };
}

