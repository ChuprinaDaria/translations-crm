import React from 'react';
import { X } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { SourceBadge } from './SourceBadge';
import { cn } from '../../../components/ui/utils';
import { getPlatformColor } from '../../../design-tokens';

export interface Conversation {
  id: string;
  platform: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
  external_id: string;
  subject?: string;
  client_id?: string;
  client_name?: string;
  client_avatar?: string;
  unread_count?: number;
}

interface ChatTabProps {
  conversation: Conversation;
  isActive: boolean;
  hasNewMessages?: boolean;
  onClick: () => void;
  onClose: () => void;
}

/**
 * Chat Tab component - вкладка активного чату
 * Дизайн:
 * ┌──────────────────────────┐
 * │ 🔵 Олександр Петренко ●│x││
 * └──────────────────────────┘
 * 🔵 - border колір джерела
 * ● - мігаючий індикатор нових повідомлень
 * x - кнопка закриття (на hover)
 */
export function ChatTab({
  conversation,
  isActive,
  hasNewMessages = false,
  onClick,
  onClose,
}: ChatTabProps) {
  const displayName = conversation.client_name || conversation.subject || conversation.external_id || 'Unknown';
  const unreadCount = conversation.unread_count || 0;
  const platformColor = getPlatformColor(conversation.platform);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2 px-4 py-3 border-r border-gray-200',
        'cursor-pointer transition-all duration-200 min-w-[180px] max-w-[240px]',
        isActive
          ? 'bg-white'
          : 'bg-gray-50 hover:bg-gray-100',
        hasNewMessages && !isActive && 'tab-has-new-message'
      )}
    >
      {/* Border колір джерела (ліворуч) */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 transition-all duration-200',
          isActive && 'w-1'
        )}
        style={{ backgroundColor: platformColor }}
      />

      {/* Іконка джерела */}
      <SourceBadge source={conversation.platform} size="sm" className="shrink-0" />

      {/* Назва + truncate */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm truncate transition-all duration-200',
            isActive ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'
          )}
        >
          {displayName}
        </p>
      </div>

      {/* Мігаючий індикатор для нових повідомлень */}
      {unreadCount > 0 && !isActive && (
        <div className="relative flex items-center justify-center shrink-0 w-3 h-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
        </div>
      )}

      {/* Close button (показується при hover або коли активний) */}
      <button
        onClick={handleClose}
        className={cn(
          'shrink-0 p-1 rounded hover:bg-gray-200 transition-all duration-100',
          'opacity-0 group-hover:opacity-100',
          isActive && 'opacity-100',
          'active:scale-95'
        )}
        aria-label="Close tab"
      >
        <X className="w-3.5 h-3.5 text-gray-500" />
      </button>

      {/* Active indicator (bottom border) */}
      {isActive && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-200"
          style={{ backgroundColor: platformColor }}
        />
      )}
    </div>
  );
}

