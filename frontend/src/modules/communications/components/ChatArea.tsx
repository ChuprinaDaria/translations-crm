import React, { useRef, useEffect } from 'react';
import { Plus, Download, FileText, Star, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { MessageBubble } from './MessageBubble';
import { PlatformIcon } from './PlatformIcon';
import { MessageInput } from './MessageInput';
import { EmptyStates } from './EmptyState';

export interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'html' | 'file';
  content: string;
  status: 'queued' | 'sent' | 'read' | 'failed';
  attachments?: Array<{
    id?: string;
    type: string;
    url?: string;
    filename?: string;
    mime_type?: string;
    size?: number;
    thumbnail_url?: string;
  }>;
  meta_data?: Record<string, any>;
  sent_at?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  platform: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
  external_id: string;
  subject?: string;
  client_id?: string;
  client_name?: string;
  client_avatar?: string;
}

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (content: string, attachments?: File[]) => void;
  isLoading?: boolean;
  onQuickAction?: (action: string, data?: Record<string, any>) => void;
}

/**
 * Область чату з повідомленнями
 * Структура:
 * 1. Header з інфо про контакт + дії
 * 2. Messages list (scroll to bottom on new)
 * 3. Input area з attachments
 */
export function ChatArea({
  conversation,
  messages,
  onSendMessage,
  isLoading = false,
  onQuickAction,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <EmptyStates.NoMessages />
      </div>
    );
  }

  const displayName = conversation.client_name || conversation.external_id || 'Unknown';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={conversation.client_avatar} />
            <AvatarFallback className="bg-gray-200 text-gray-600 text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{displayName}</span>
              <PlatformIcon platform={conversation.platform} className="w-4 h-4" />
            </div>
            <span className="text-xs text-gray-500 capitalize">
              {conversation.platform === 'telegram' && 'Telegram'}
              {conversation.platform === 'whatsapp' && 'WhatsApp'}
              {conversation.platform === 'email' && 'Email'}
              {conversation.platform === 'facebook' && 'Facebook'}
              {conversation.platform === 'instagram' && 'Instagram'}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="border-gray-300 hover:bg-gray-50">
                <Plus className="w-4 h-4 mr-2" />
                Швидкі дії
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => onQuickAction?.('create_client')}
                className="cursor-pointer"
              >
                <User className="w-4 h-4 mr-2" />
                Створити клієнта
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onQuickAction?.('download_files')}
                className="cursor-pointer"
              >
                <Download className="w-4 h-4 mr-2" />
                Завантажити всі файли
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onQuickAction?.('create_order')}
                className="cursor-pointer"
              >
                <FileText className="w-4 h-4 mr-2" />
                Створити замовлення
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onQuickAction?.('mark_important')}
                className="cursor-pointer"
              >
                <Star className="w-4 h-4 mr-2" />
                Позначити важливим
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div className="space-y-4 max-w-4xl mx-auto">
          {isLoading && messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">Завантаження повідомлень...</div>
          ) : messages.length === 0 ? (
            <EmptyStates.NoMessages />
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} platform={conversation.platform} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white">
        <MessageInput
          onSend={onSendMessage}
          disabled={isLoading}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}

