import React, { useEffect, useState } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { X, MessageSquare, Phone, Mail, Instagram } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../components/ui/utils';

export interface NotificationData {
  id: string;
  conversationId: string;
  clientName: string;
  channel: 'telegram' | 'whatsapp' | 'instagram' | 'email';
  message: string;
  timestamp: Date;
  onOpen?: () => void;
  onIgnore?: () => void;
}

interface NotificationToastProps {
  notification: NotificationData;
  onClose: () => void;
  autoCloseDelay?: number; // в мілісекундах
}

const CHANNEL_ICONS = {
  telegram: MessageSquare,
  whatsapp: Phone,
  instagram: Instagram,
  email: Mail,
};

const CHANNEL_LABELS = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  email: 'Email',
};

const CHANNEL_COLORS = {
  telegram: 'bg-blue-500',
  whatsapp: 'bg-green-500',
  instagram: 'bg-pink-500',
  email: 'bg-gray-500',
};

export function NotificationToast({
  notification,
  onClose,
  autoCloseDelay = 10000, // 10 секунд за замовчуванням
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(autoCloseDelay);

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

    // Звук (опціонально - можна додати звуковий файл)
    // const audio = new Audio('/sounds/notification.mp3');
    // audio.play().catch(() => {
    //   // Ігноруємо помилки автоплею
    // });
  }, []);

  const handleOpen = () => {
    notification.onOpen?.();
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleIgnore = () => {
    notification.onIgnore?.();
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const ChannelIcon = CHANNEL_ICONS[notification.channel];
  const channelLabel = CHANNEL_LABELS[notification.channel];
  const channelColor = CHANNEL_COLORS[notification.channel];

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
          <Card className="shadow-lg border-2 border-orange-200 bg-white overflow-hidden">
            {/* Progress bar для автозакриття */}
            {autoCloseDelay > 0 && (
              <div className="h-1 bg-gray-100">
                <motion.div
                  className={cn('h-full bg-orange-500')}
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
                  <div className={cn('p-2 rounded-lg', channelColor)}>
                    <ChannelIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">
                      💬 Нове повідомлення
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {channelLabel}
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

              {/* Client Info */}
              <div className="mb-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <span>👤</span>
                  <span>{notification.clientName}</span>
                </div>
              </div>

              {/* Message Preview */}
              <div className="mb-4">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-sm text-gray-700 line-clamp-3">
                    "{notification.message}"
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleOpen}
                  className="flex-1 bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white text-sm h-8"
                >
                  Відповісти
                </Button>
                <Button
                  onClick={handleIgnore}
                  variant="outline"
                  className="flex-1 text-sm h-8"
                >
                  Ігнорувати
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

