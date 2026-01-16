/**
 * NotificationItem - окремий елемент нотифікації в списку
 */
import React from 'react';
import { MessageSquare, DollarSign, CheckCircle, XCircle, FileText, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import type { Notification } from '../types';

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onMarkAsRead: () => void;
}

const NOTIFICATION_ICONS = {
  new_message: MessageSquare,
  payment_received: DollarSign,
  translator_accepted: CheckCircle,
  translator_rejected: XCircle,
  translation_ready: CheckCircle,
  internal_note: FileText,
  deadline_warning: AlertTriangle,
  deadline_passed: Clock,
};

const NOTIFICATION_COLORS = {
  new_message: 'text-blue-500',
  payment_received: 'text-green-500',
  translator_accepted: 'text-green-500',
  translator_rejected: 'text-red-500',
  translation_ready: 'text-green-500',
  internal_note: 'text-gray-500',
  deadline_warning: 'text-yellow-500',
  deadline_passed: 'text-red-500',
};

export function NotificationItem({ notification, onClick, onMarkAsRead }: NotificationItemProps) {
  const Icon = NOTIFICATION_ICONS[notification.type] || MessageSquare;
  const colorClass = NOTIFICATION_COLORS[notification.type] || 'text-gray-500';

  const timeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'щойно';
    if (diffMins < 60) return `${diffMins} хв тому`;
    if (diffHours < 24) return `${diffHours} год тому`;
    if (diffDays < 7) return `${diffDays} дн тому`;
    return then.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div
      className={cn(
        'p-3 cursor-pointer hover:bg-gray-50 transition-colors',
        !notification.is_read && 'bg-blue-50'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5', colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn('text-sm font-medium', !notification.is_read && 'font-semibold')}>
              {notification.title}
            </h4>
            {!notification.is_read && (
              <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
            )}
          </div>
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{notification.message}</p>
          <div className="text-xs text-gray-400 mt-1">{timeAgo(notification.created_at)}</div>
        </div>
      </div>
    </div>
  );
}

