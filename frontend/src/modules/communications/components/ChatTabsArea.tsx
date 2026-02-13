import React from 'react';
import { ChatTab, type Conversation } from './ChatTab';
import { ChatArea, type Message } from './ChatArea';
import { QuickActionsSidebar } from './QuickActionsSidebar';
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
  onDeleteMessage?: (messageId: string) => void;
  onSendDraft?: (messageId: string, content: string) => void;
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
  onDeleteMessage,
  onSendDraft,
}: ChatTabsAreaProps) {
  if (openChats.length === 0) {
    return (
      <div className="h-full w-full flex overflow-hidden">
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <EmptyStates.NoMessages />
        </div>
        <div className="flex-shrink-0 h-full">
          <QuickActionsSidebar
            isSidebarOpen={isSidebarOpen}
            onPaymentClick={() => {}}
            onTrackingClick={() => {}}
            onClientClick={() => {}}
            onOrderClick={() => {}}
            onDocumentsClick={() => {}}
            onToggleSidebar={onToggleSidebar}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex overflow-hidden">
      {/* Main content: tabs + chat */}
      <div 
        className="flex-1 min-w-0 overflow-hidden"
        style={{ display: 'grid', gridTemplateRows: '40px 1fr', height: '100%' }}
      >
        {/* Tabs Header - row 1: fixed 40px */}
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
                clientId={getClientId?.(chat.conversationId)}
                orderId={getOrderId?.(chat.conversationId)}
                clientEmail={getClientEmail?.(chat.conversationId)}
                clientPhone={getClientPhone?.(chat.conversationId)}
                onAddEmail={onAddEmail ? (email: string) => onAddEmail(chat.conversationId, email) : undefined}
                onAddPhone={onAddPhone ? (phone: string) => onAddPhone(chat.conversationId, phone) : undefined}
                onAddFile={onAddFile ? (fileUrl: string, fileName: string) => onAddFile(chat.conversationId, fileUrl, fileName) : undefined}
                onAddFileAutoCreateOrder={onAddFileAutoCreateOrder ? (fileUrl: string, fileName: string) => onAddFileAutoCreateOrder(chat.conversationId, fileUrl, fileName) : undefined}
                onAddAddress={onAddAddress ? (address: string, isPaczkomat: boolean, paczkomatCode?: string) => onAddAddress(chat.conversationId, address, isPaczkomat, paczkomatCode) : undefined}
                onDeleteMessage={onDeleteMessage}
                onSendDraft={onSendDraft}
              />
            </div>
          ))}
        </div>
      </div>

      {/* QuickActionsSidebar - full height, right side */}
      <div className="flex-shrink-0 h-full">
        <QuickActionsSidebar
          isSidebarOpen={isSidebarOpen}
          clientId={activeTabId ? getClientId?.(activeTabId) : undefined}
          orderId={activeTabId ? getOrderId?.(activeTabId) : undefined}
          onPaymentClick={() => activeTabId && onPaymentClick?.(activeTabId)}
          onTrackingClick={() => activeTabId && onTrackingClick?.(activeTabId)}
          onClientClick={() => activeTabId && onClientClick?.(activeTabId)}
          onOrderClick={() => activeTabId && onOrderClick?.(activeTabId)}
          onDocumentsClick={() => activeTabId && onDocumentsClick?.(activeTabId)}
          onToggleSidebar={onToggleSidebar}
        />
      </div>
    </div>
  );
}
