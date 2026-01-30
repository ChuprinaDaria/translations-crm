import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { Plus, Download, FileText, Star, User } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { MessageBubble } from './MessageBubble';
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
  isSidebarOpen?: boolean;
  clientId?: string;
  orderId?: string;
  clientEmail?: string;
  clientPhone?: string;
  onAddEmail?: (email: string) => void;
  onAddPhone?: (phone: string) => void;
  onAddFile?: (fileUrl: string, fileName: string) => void;
  onAddFileAutoCreateOrder?: (fileUrl: string, fileName: string) => void;
  onAddAddress?: (address: string, isPaczkomat: boolean, paczkomatCode?: string) => void;
  onPaymentClick?: () => void;
  onTrackingClick?: () => void;
  onClientClick?: () => void;
  onOrderClick?: () => void;
  onDocumentsClick?: () => void;
  onDeleteMessage?: (messageId: string) => void;
}

export function ChatArea({
  conversation,
  messages,
  onSendMessage,
  isLoading = false,
  onQuickAction,
  isSidebarOpen,
  clientId,
  orderId,
  clientEmail,
  clientPhone,
  onAddEmail,
  onAddPhone,
  onAddFile,
  onAddFileAutoCreateOrder,
  onAddAddress,
  onPaymentClick,
  onTrackingClick,
  onClientClick,
  onOrderClick,
  onDocumentsClick,
  onDeleteMessage,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages]);

  useLayoutEffect(() => {
    scrollToBottom('auto');
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <EmptyStates.NoMessages />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      {/* Main Chat Column - use grid for stable layout */}
      <div 
        className="flex-1 min-w-0 overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateRows: '48px 1fr auto',
          height: '100%',
        }}
      >
        {/* Header - row 1: fixed 48px */}
        <header className="border-b border-gray-200 bg-white flex items-center justify-between px-4">
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="border-gray-300 hover:bg-gray-50 h-8 flex-shrink-0">
                <Plus className="w-4 h-4 mr-1" />
                Дії
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => onQuickAction?.('create_client')} className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                Створити клієнта
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickAction?.('download_files')} className="cursor-pointer">
                <Download className="w-4 h-4 mr-2" />
                Завантажити всі файли
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickAction?.('create_order')} className="cursor-pointer">
                <FileText className="w-4 h-4 mr-2" />
                Utwórz zlecenie
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onQuickAction?.('mark_important')} className="cursor-pointer">
                <Star className="w-4 h-4 mr-2" />
                Позначити важливим
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Messages - row 2: takes remaining space, scrollable */}
        <div 
          ref={messagesContainerRef}
          className="overflow-y-auto overflow-x-hidden bg-gray-50"
        >
          <div className="p-4 space-y-3">
            {isLoading && messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Завантаження...</div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <EmptyStates.NoMessages />
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble 
                  key={message.id} 
                  message={message} 
                  platform={conversation.platform}
                  clientId={clientId}
                  orderId={orderId}
                  clientEmail={clientEmail}
                  clientPhone={clientPhone}
                  onAddEmail={onAddEmail}
                  onAddPhone={onAddPhone}
                  onAddFile={onAddFile}
                  onAddFileAutoCreateOrder={onAddFileAutoCreateOrder}
                  onAddAddress={onAddAddress}
                  onDeleteMessage={onDeleteMessage}
                />
              ))
            )}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        </div>

        {/* Input - row 3: auto height, always at bottom */}
        <div className="bg-white border-t border-gray-200">
          <MessageInput
            onSend={onSendMessage}
            disabled={isLoading}
            isLoading={isLoading}
          />
        </div>
      </div>

    </div>
  );
}
