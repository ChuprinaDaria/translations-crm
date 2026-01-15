import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { PlatformIcon } from './PlatformIcon';
import { cn } from '../../../components/ui/utils';
import { getPlatformColor } from '../../../design-tokens';
import { formatDistanceToNow } from 'date-fns';
import { uk, pl, enUS } from 'date-fns/locale';

export interface Conversation {
  id: string;
  platform: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
  external_id: string;
  subject?: string;
  client_id?: string;
  client_name?: string;
  client_avatar?: string;
  unread_count: number;
  last_message?: string;
  last_message_at?: string;
  updated_at: string;
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Елемент списку розмов
 * Дизайн:
 * ┌────────────────────────────────────────┐
 * │ [Avatar] Name               [TG icon]  │
 * │          Last message...    • 10:30    │
 * │          [2]                           │ <- unread badge
 * └────────────────────────────────────────┘
 */
export function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: ConversationItemProps) {
  const platformColor = getPlatformColor(conversation.platform);
  
  // Format time
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'щойно';
      if (diffMins < 60) return `${diffMins} хв`;
      if (diffHours < 24) return `${diffHours} год`;
      if (diffDays < 7) return `${diffDays} дн`;
      return formatDistanceToNow(date, { addSuffix: true, locale: uk });
    } catch {
      return '';
    }
  };

  const displayName = conversation.client_name || conversation.external_id || 'Unknown';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left',
        'hover:bg-gray-50 active:bg-gray-100',
        isSelected && 'bg-gray-100'
      )}
      style={
        isSelected
          ? {
              borderLeftWidth: '3px',
              borderLeftColor: platformColor,
            }
          : undefined
      }
    >
      {/* Avatar */}
      <Avatar className="w-12 h-12 shrink-0">
        <AvatarImage src={conversation.client_avatar} />
        <AvatarFallback className="bg-gray-200 text-gray-600 text-sm font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header: Name + Platform Icon */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span
            className={cn(
              'text-sm font-medium truncate',
              isSelected ? 'text-gray-900 font-semibold' : 'text-gray-900'
            )}
          >
            {displayName}
          </span>
          <PlatformIcon platform={conversation.platform} className="w-4 h-4 shrink-0" />
        </div>

        {/* Last Message */}
        <p className="text-xs text-gray-600 truncate mb-1">
          {conversation.last_message || conversation.subject || 'Немає повідомлень'}
        </p>

        {/* Footer: Time + Unread Indicator */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {formatTime(conversation.last_message_at || conversation.updated_at)}
          </span>
          {conversation.unread_count > 0 && (
            <div className="relative flex items-center justify-center shrink-0 w-3 h-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

