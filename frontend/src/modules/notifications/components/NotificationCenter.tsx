/**
 * NotificationCenter - центр нотифікацій (bell icon + dropdown)
 */
import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/components/ui/utils';
import { notificationApi } from '../api';
import type { Notification } from '../types';
import { NotificationItem } from './NotificationItem';
import { handleNotificationNavigation } from '../utils/navigation';

interface NotificationCenterProps {
  userId: string;
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationCenter({ userId, onNotificationClick }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Завантажити нотифікації
  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const [notificationsData, countData] = await Promise.all([
        notificationApi.getNotifications({ limit: 20, unread_only: false }),
        notificationApi.getUnreadCount(),
      ]);
      setNotifications(notificationsData);
      setUnreadCount(countData.count);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Завантажити при відкритті
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  // Оновити лічильник при закритті
  useEffect(() => {
    if (!isOpen) {
      notificationApi.getUnreadCount().then((data) => setUnreadCount(data.count));
    }
  }, [isOpen]);

  // Позначити всі як прочитані
  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);
    try {
      await notificationApi.markAllAsRead();
      await loadNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Позначити одну як прочитану
  const handleMarkAsRead = async (notificationId: string) => {
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
  };

  // Обробка кліку на нотифікацію
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }
    onNotificationClick?.(notification);
    
    // Перейти за action_url якщо є
    handleNotificationNavigation(notification.action_url);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 p-0"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-semibold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">🔔 Нотифікації</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="text-xs"
            >
              {isMarkingAll ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Позначити всі прочитаними
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-gray-500 text-sm">
              Немає нотифікацій
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onMarkAsRead={() => handleMarkAsRead(notification.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                // TODO: Перехід на сторінку всіх нотифікацій
                setIsOpen(false);
              }}
            >
              Показати всі →
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

