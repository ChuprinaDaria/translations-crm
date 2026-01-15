import React from 'react';
import { LucideIcon, MessageCircle, MessageSquare, FileText, User, Package, Search } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Empty state component для різних сценаріїв
 * Використовується коли немає даних для відображення
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Predefined empty states
 */
export const EmptyStates = {
  NoConversations: () => (
    <EmptyState
      icon={MessageCircle}
      title="Немає розмов"
      description="Повідомлення з різних платформ з'являться тут"
    />
  ),
  NoMessages: () => (
    <EmptyState
      icon={MessageSquare}
      title="Немає повідомлень"
      description="Почніть розмову, надіславши перше повідомлення"
    />
  ),
  NoFiles: () => (
    <EmptyState
      icon={FileText}
      title="Немає файлів"
      description="Файли з цієї розмови з'являться тут"
    />
  ),
  NoClient: () => (
    <EmptyState
      icon={User}
      title="Клієнт не прив'язано"
      description="Створіть або прив'яжіть клієнта до цієї розмови"
    />
  ),
  NoOrders: () => (
    <EmptyState
      icon={Package}
      title="Немає замовлень"
      description="Історія замовлень з'явиться тут після прив'язки клієнта"
    />
  ),
  SearchEmpty: (query: string) => (
    <EmptyState
      icon={Search}
      title="Нічого не знайдено"
      description={`Не знайдено розмов за запитом "${query}"`}
    />
  ),
};

