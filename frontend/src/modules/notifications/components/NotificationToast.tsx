/**
 * NotificationToast - компонент для відображення toast нотифікацій
 */
import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, MessageSquare, DollarSign, CheckCircle, XCircle, FileText, AlertTriangle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/components/ui/utils';
import type { Notification } from '../types';

interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
  onAction?: () => void;
  autoCloseDelay?: number; // в мілісекундах
}

const NOTIFICATION_CONFIG = {
  new_message: {
    icon: MessageSquare,
    color: 'bg-blue-500',
    title: '💬 Нове повідомлення',
  },
  payment_received: {
    icon: DollarSign,
    color: 'bg-green-500',
    title: '💰 Оплату отримано!',
  },
  translator_accepted: {
    icon: CheckCircle,
    color: 'bg-green-500',
    title: '✅ Перекладач прийняв замовлення',
  },
  translator_rejected: {
    icon: XCircle,
    color: 'bg-red-500',
    title: '❌ Перекладач відхилив замовлення',
  },
  translation_ready: {
    icon: CheckCircle,
    color: 'bg-green-500',
    title: '✅ Переклад завершено',
  },
  internal_note: {
    icon: FileText,
    color: 'bg-gray-500',
    title: '📝 Нова нотатка',
  },
  deadline_warning: {
    icon: AlertTriangle,
    color: 'bg-yellow-500',
    title: '⚠️ Дедлайн наближається!',
  },
  deadline_passed: {
    icon: Clock,
    color: 'bg-red-500',
    title: '⏰ Дедлайн прострочений',
  },
};

export function NotificationToast({
  notification,
  onClose,
  onAction,
  autoCloseDelay = 10000, // 10 секунд за замовчуванням
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(autoCloseDelay);

  const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.new_message;
  const Icon = config.icon;

  // Автозакриття
  useEffect(() => {
    if (autoCloseDelay > 0) {
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 100) {
            setIsVisible(false);
            setTimeout(onClose, 300); // Затримка для анімації
            return 0;
          }
          return prev - 100;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [autoCloseDelay, onClose]);

  // Звук та вібрація при появі
  useEffect(() => {
    // Вібрація (якщо підтримується)
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }

    // Desktop notification (якщо дозволено)
    if (Notification.permission === 'granted') {
      new window.Notification(notification.title, {
        body: notification.message,
        icon: '/icon.png',
        tag: notification.id,
      });
    }
  }, []);

  const handleAction = () => {
    onAction?.();
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const progressPercentage = (timeRemaining / autoCloseDelay) * 100;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-4 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)]"
        >
          <Card className="shadow-lg border-2 bg-white overflow-hidden">
            {/* Progress bar для автозакриття */}
            {autoCloseDelay > 0 && (
              <div className="h-1 bg-gray-100">
                <motion.div
                  className={cn('h-full', config.color)}
                  initial={{ width: '100%' }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.1, ease: 'linear' }}
                />
              </div>
            )}

            <div className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn('p-2 rounded-lg', config.color)}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">
                      {config.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(notification.created_at).toLocaleTimeString('uk-UA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-100"
                  onClick={onClose}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Message */}
              <div className="mb-4">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-sm text-gray-700">{notification.message}</p>
                </div>
              </div>

              {/* Actions */}
              {notification.action_url && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleAction}
                    className={cn('flex-1 text-white text-sm h-8', config.color, 'hover:opacity-90')}
                  >
                    {notification.type === 'new_message' && 'Відповісти'}
                    {notification.type === 'payment_received' && 'Переглянути замовлення'}
                    {notification.type === 'translator_accepted' && 'Переглянути в канбані'}
                    {notification.type === 'translator_rejected' && 'Призначити іншого'}
                    {notification.type === 'translation_ready' && 'Повідомити клієнта'}
                    {notification.type === 'internal_note' && 'Переглянути'}
                    {notification.type === 'deadline_warning' && 'Нагадати перекладачу'}
                    {notification.type === 'deadline_passed' && 'Переглянути'}
                    {!notification.action_url && 'Переглянути'}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

