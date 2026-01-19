import React from 'react';
import { ChatTab, type Conversation } from './ChatTab';
import { ChatArea, type Message } from './ChatArea';
import { EmptyStates } from './EmptyState';
import { cn } from '../../../components/ui/utils';

interface OpenChat {
  conversationId: string;
  conversation: Conversation;
  messages: Message[];
}

interface ChatTabsAreaProps {
  openChats: OpenChat[];
  activeTabId: string | null;
  onTabChange: (id: string) => void;
  onTabClose: (id: string) => void;
  onSendMessage: (conversationId: string, content: string, attachments?: File[]) => void;
  onQuickAction?: (conversationId: string, action: string, data?: Record<string, any>) => void;
  isLoading?: boolean;
  isSidebarOpen?: boolean;
  getClientId?: (conversationId: string) => string | undefined;
  getOrderId?: (conversationId: string) => string | undefined;
  getClientEmail?: (conversationId: string) => string | undefined;
  getClientPhone?: (conversationId: string) => string | undefined;
  onAddEmail?: (conversationId: string, email: string) => void;
  onAddPhone?: (conversationId: string, phone: string) => void;
  onAddFile?: (conversationId: string, fileUrl: string, fileName: string) => void;
  onAddFileAutoCreateOrder?: (conversationId: string, fileUrl: string, fileName: string) => void;
  onAddAddress?: (conversationId: string, address: string, isPaczkomat: boolean, paczkomatCode?: string) => void;
  onPaymentClick?: (conversationId: string) => void;
  onTrackingClick?: (conversationId: string) => void;
  onClientClick?: (conversationId: string) => void;
  onOrderClick?: (conversationId: string) => void;
  onDocumentsClick?: (conversationId: string) => void;
  onToggleSidebar?: () => void;
}

export function ChatTabsArea({
  openChats,
  activeTabId,
  onTabChange,
  onTabClose,
  onSendMessage,
  onQuickAction,
  isLoading = false,
  isSidebarOpen,
  getClientId,
  getOrderId,
  getClientEmail,
  getClientPhone,
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
  onToggleSidebar,
}: ChatTabsAreaProps) {
  if (openChats.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50">
        <EmptyStates.NoMessages />
      </div>
    );
  }

  return (
    <div 
      className="w-full overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateRows: '40px 1fr',
        height: '100%',
      }}
    >
      {/* Tabs Header - row 1: fixed 40px, always visible at top */}
      <div className="flex items-center bg-gray-100 border-b border-gray-200 overflow-x-auto overflow-y-hidden">
        {openChats.map((chat) => (
          <ChatTab
            key={chat.conversationId}
            conversation={chat.conversation}
            isActive={activeTabId === chat.conversationId}
            hasNewMessages={(chat.conversation.unread_count || 0) > 0}
            onClick={() => onTabChange(chat.conversationId)}
            onClose={() => onTabClose(chat.conversationId)}
          />
        ))}
      </div>

      {/* Active Chat - row 2: takes remaining space */}
      <div className="overflow-hidden">
        {openChats.map((chat) => (
          <div
            key={chat.conversationId}
            className={cn(
              'h-full w-full',
              activeTabId === chat.conversationId ? 'block' : 'hidden'
            )}
          >
            <ChatArea
              conversation={chat.conversation}
              messages={chat.messages}
              onSendMessage={(content, attachments) => onSendMessage(chat.conversationId, content, attachments)}
              isLoading={isLoading}
              onQuickAction={(action, data) => onQuickAction?.(chat.conversationId, action, data)}
              isSidebarOpen={isSidebarOpen}
              clientId={getClientId?.(chat.conversationId)}
              orderId={getOrderId?.(chat.conversationId)}
              clientEmail={getClientEmail?.(chat.conversationId)}
              clientPhone={getClientPhone?.(chat.conversationId)}
              onAddEmail={onAddEmail ? (email) => onAddEmail(chat.conversationId, email) : undefined}
              onAddPhone={onAddPhone ? (phone) => onAddPhone(chat.conversationId, phone) : undefined}
              onAddFile={onAddFile ? (fileUrl, fileName) => onAddFile(chat.conversationId, fileUrl, fileName) : undefined}
              onAddFileAutoCreateOrder={onAddFileAutoCreateOrder ? (fileUrl, fileName) => onAddFileAutoCreateOrder(chat.conversationId, fileUrl, fileName) : undefined}
              onAddAddress={onAddAddress ? (address, isPaczkomat, paczkomatCode) => onAddAddress(chat.conversationId, address, isPaczkomat, paczkomatCode) : undefined}
              onPaymentClick={onPaymentClick ? () => onPaymentClick(chat.conversationId) : undefined}
              onTrackingClick={onTrackingClick ? () => onTrackingClick(chat.conversationId) : undefined}
              onClientClick={onClientClick ? () => onClientClick(chat.conversationId) : undefined}
              onOrderClick={onOrderClick ? () => onOrderClick(chat.conversationId) : undefined}
              onDocumentsClick={onDocumentsClick ? () => onDocumentsClick(chat.conversationId) : undefined}
              onToggleSidebar={onToggleSidebar}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
