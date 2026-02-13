import React, { useMemo } from 'react';
import { 
  Menu,
  CreditCard, 
  Package, 
  UserPlus,
  FileText, 
  FolderOpen,
} from 'lucide-react';
import { ChatTab, type Conversation } from './ChatTab';
import { ChatArea, type Message } from './ChatArea';
import { QuickActionsSidebar, type QuickAction } from './QuickActionsSidebar';
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
  // Формуємо actions для QuickActionsSidebar
  const quickActions = useMemo<QuickAction[]>(() => {
    const clientId = activeTabId ? getClientId?.(activeTabId) : undefined;
    const orderId = activeTabId ? getOrderId?.(activeTabId) : undefined;
    
    // Перевіряємо, чи є client_id в conversation (навіть якщо дані ще не завантажені)
    const activeChat = openChats.find(chat => chat.conversationId === activeTabId);
    const hasClientInConversation = activeChat?.conversation.client_id !== undefined;
    const hasClient = clientId || hasClientInConversation;
    
    // Кнопки оплати та трекінгу активні, якщо є відкрита conversation з client_id
    // (перевірка наявності замовлення буде всередині handler'ів)
    const canHaveOrders = hasClient;

    return [
      {
        id: 'sidebar',
        icon: Menu,
        tooltip: 'Відкрити список діалогів',
        onClick: () => onToggleSidebar?.(),
        disabled: false,
        isActive: isSidebarOpen,
      },
      {
        id: 'payment',
        icon: CreditCard,
        tooltip: 'Оплата',
        onClick: () => activeTabId && onPaymentClick?.(activeTabId),
        disabled: !activeTabId || !canHaveOrders,
        disabledMessage: 'Najpierw utwórz zlecenie',
      },
      {
        id: 'tracking',
        icon: Package,
        tooltip: 'Трекінг',
        onClick: () => activeTabId && onTrackingClick?.(activeTabId),
        disabled: !activeTabId || !canHaveOrders,
        disabledMessage: 'Najpierw utwórz zlecenie',
      },
      {
        id: 'client',
        icon: UserPlus,
        tooltip: clientId ? 'Переглянути клієнта' : 'Створити клієнта',
        onClick: () => activeTabId && onClientClick?.(activeTabId),
        disabled: !activeTabId,
      },
      {
        id: 'order',
        icon: FileText,
        tooltip: 'Utwórz zlecenie',
        onClick: () => activeTabId && onOrderClick?.(activeTabId),
        disabled: !activeTabId || !hasClient,
        disabledMessage: 'Спочатку створіть клієнта',
      },
      {
        id: 'documents',
        icon: FolderOpen,
        tooltip: 'Завантажити документи',
        onClick: () => activeTabId && onDocumentsClick?.(activeTabId),
        disabled: !activeTabId,
      },
    ];
  }, [
    activeTabId,
    isSidebarOpen,
    openChats,
    getClientId,
    getOrderId,
    onToggleSidebar,
    onPaymentClick,
    onTrackingClick,
    onClientClick,
    onOrderClick,
    onDocumentsClick,
  ]);

  if (openChats.length === 0) {
    return (
      <div className="h-full w-full flex overflow-hidden">
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <EmptyStates.NoMessages />
        </div>
        <div className="flex-shrink-0 h-full">
          <QuickActionsSidebar actions={quickActions} />
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
        <QuickActionsSidebar actions={quickActions} />
      </div>
    </div>
  );
}
