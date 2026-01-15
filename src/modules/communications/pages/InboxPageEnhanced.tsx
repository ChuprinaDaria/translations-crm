import React, { useState, useEffect } from 'react';
import { CommunicationsLayout } from '../components/CommunicationsLayout';
import { ConversationsSidebar, type FilterState, type Conversation } from '../components/ConversationsSidebar';
import { ChatTabsArea } from '../components/ChatTabsArea';
import { type Message } from '../components/ChatArea';
import { ContextPanel, type Client } from '../components/ContextPanel';
import { CommunicationsErrorBoundary } from '../components/ErrorBoundary';
import { useOpenChats } from '../hooks/useOpenChats';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { inboxApi, type ConversationListItem, type ConversationWithMessages } from '../api/inbox';
import { toast } from 'sonner';
import '../styles/animations.css';

/**
 * Enhanced Inbox Page з новим UI
 * Використовує CommunicationsLayout з 3-колонковою структурою
 */
export function InboxPageEnhanced() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const {
    openChats,
    activeTabId,
    openChat,
    closeChat,
    switchToChat,
    updateChatMessages,
    getActiveChat,
  } = useOpenChats();
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [orders, setOrders] = useState<Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    total_amount?: number;
  }>>([]);
  const [filters, setFilters] = useState<FilterState>({ type: 'all' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, [filters]);

  // Автоматично відкрити перший чат коли список завантажився
  useEffect(() => {
    if (conversations && conversations.length > 0 && openChats.length === 0 && !isLoading) {
      const firstConversation = conversations[0];
      handleOpenChat(firstConversation.id);
    }
  }, [conversations, openChats.length, isLoading]);

  // Keyboard shortcuts
  const activeIndex = openChats.findIndex(chat => chat.conversationId === activeTabId);
  useKeyboardShortcuts(openChats.length, activeIndex, {
    onNext: () => {
      const nextIndex = (activeIndex + 1) % openChats.length;
      switchToChat(openChats[nextIndex].conversationId);
    },
    onPrev: () => {
      const prevIndex = activeIndex === 0 ? openChats.length - 1 : activeIndex - 1;
      switchToChat(openChats[prevIndex].conversationId);
    },
    onClose: () => {
      if (activeTabId) closeChat(activeTabId);
    },
    onCloseAll: () => {
      openChats.forEach(chat => closeChat(chat.conversationId));
    },
  });

  const loadConversations = async () => {
    try {
      console.log('[InboxPage] Loading conversations with filters:', filters);
      setIsLoading(true);
      const response = await inboxApi.getInbox({
        filter: filters.type,
        platform: filters.platform,
        search: filters.search,
        limit: 50,
      });
      console.log('[InboxPage] Conversations loaded:', response);
      setConversations(response.conversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast.error('Помилка завантаження розмов');
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversationData = async (conversationId: string): Promise<{ conversation: ConversationWithMessages, client?: Client, orders: any[] }> => {
    try {
      const conversation = await inboxApi.getConversation(conversationId);
      
      // Load client data if client_id exists
      let client: Client | undefined;
      let orders: any[] = [];
      
      if (conversation.client_id) {
        // Mock client data
        client = {
          id: conversation.client_id,
          full_name: conversation.client_id === 'client-1' ? 'Олександр Петренко' : 
                     conversation.client_id === 'client-2' ? 'Марія Коваленко' :
                     conversation.client_id === 'client-4' ? 'Анна Мельник' : 'Клієнт',
          email: conversation.platform === 'email' ? conversation.external_id : undefined,
          phone: conversation.platform !== 'email' ? conversation.external_id : undefined,
          company_name: conversation.client_id === 'client-1' ? 'ТОВ "Приклад"' : undefined,
        };
        
        // Mock orders
        if (conversation.client_id === 'client-1') {
          orders = [
            {
              id: 'order-1',
              title: 'Кейтеринг на 50 осіб',
              status: 'completed',
              created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              total_amount: 25000,
            },
          ];
        }
      }
      
      return { conversation, client, orders };
    } catch (error) {
      console.error('Error loading conversation:', error);
      throw error;
    }
  };

  const handleOpenChat = async (conversationId: string) => {
    // Перевірити чи вже відкритий
    const existingChat = openChats.find(chat => chat.conversationId === conversationId);
    
    if (existingChat) {
      // Просто переключитись на існуючий таб
      switchToChat(conversationId);
      
      // Оновити client/orders для context panel
      if (existingChat.conversation.client_id) {
        const { client: clientData, orders: ordersData } = await loadConversationData(conversationId);
        setClient(clientData);
        setOrders(ordersData);
      }
    } else {
      // Завантажити розмову та додати новий таб
      try {
        const { conversation, client: clientData, orders: ordersData } = await loadConversationData(conversationId);
        
        // Знайти conversation list item для додаткових даних
        const convListItem = conversations.find(c => c.id === conversationId);
        
        const chatConversation: Conversation = {
          id: conversation.id,
          platform: conversation.platform as any,
          external_id: conversation.external_id,
          subject: conversation.subject,
          client_id: conversation.client_id,
          client_name: convListItem?.client_name,
          client_avatar: undefined,
          unread_count: conversation.unread_count,
          last_message: convListItem?.last_message,
          last_message_at: convListItem?.last_message_at,
          updated_at: convListItem?.updated_at || new Date().toISOString(),
        };
        
        openChat(chatConversation, conversation.messages || []);
        setClient(clientData);
        setOrders(ordersData);
      } catch (error) {
        toast.error('Помилка завантаження розмови');
      }
    }
  };

  const handleSendMessage = async (conversationId: string, content: string, attachments?: File[]) => {
    if (!conversationId) return;

    try {
      setIsSending(true);
      
      // Convert File[] to attachment format
      const attachmentData = attachments?.map((file) => ({
        type: file.type.startsWith('image/') ? 'image' : 'document',
        filename: file.name,
        mime_type: file.type,
        size: file.size,
      }));

      const newMessage = await inboxApi.sendMessage(conversationId, content, attachmentData);
      
      // Update messages in open chat using hook
      const chat = openChats.find(c => c.conversationId === conversationId);
      if (chat) {
        updateChatMessages(conversationId, [...chat.messages, newMessage]);
      }
      
      // Refresh conversations list to update last message
      await loadConversations();
      
      toast.success('Повідомлення відправлено');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Помилка відправки повідомлення');
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickAction = async (conversationId: string, action: string, data?: Record<string, any>) => {
    if (!conversationId) return;

    try {
      switch (action) {
        case 'create_client':
          const clientData = await inboxApi.createClientFromConversation(conversationId);
          toast.success('Клієнт створено успішно');
          // Reload conversation data
          const { client: newClient, orders: newOrders } = await loadConversationData(conversationId);
          setClient(newClient);
          setOrders(newOrders);
          await loadConversations();
          break;
        
        case 'download_files':
          toast.info('Завантаження файлів...');
          await inboxApi.quickAction(conversationId, 'download_files');
          toast.success('Файли завантажено');
          break;
        
        case 'create_order':
          toast.info('Створення замовлення...');
          await inboxApi.quickAction(conversationId, 'create_order', data);
          toast.success('Замовлення створено');
          // Reload orders
          const { orders: updatedOrders } = await loadConversationData(conversationId);
          setOrders(updatedOrders);
          break;
        
        case 'mark_important':
          await inboxApi.quickAction(conversationId, 'mark_important');
          toast.success('Позначено як важливе');
          break;
        
        default:
          toast.error('Невідома дія');
      }
    } catch (error) {
      console.error('Error executing quick action:', error);
      toast.error('Помилка виконання дії');
    }
  };

  const handleCreateClient = async () => {
    if (!activeTabId) return;
    await handleQuickAction(activeTabId, 'create_client');
  };

  const handleLinkClient = () => {
    // TODO: Open client selection dialog
    toast.info('Функція прив\'язки клієнта в розробці');
  };

  const handleDownloadAllFiles = async () => {
    if (!activeTabId) return;
    await handleQuickAction(activeTabId, 'download_files');
  };

  const handleViewClientProfile = (clientId: string) => {
    // TODO: Navigate to client profile
    toast.info('Перехід до профілю клієнта');
  };

  const handleSearch = (query: string) => {
    setFilters((prev) => ({ ...prev, search: query }));
  };

  // Convert ConversationListItem to Conversation for sidebar
  const sidebarConversations: Conversation[] = conversations.map((conv) => ({
    id: conv.id,
    platform: conv.platform,
    external_id: conv.external_id,
    subject: conv.subject,
    client_id: conv.client_id,
    client_name: conv.client_name,
    unread_count: conv.unread_count,
    last_message: conv.last_message,
    last_message_at: conv.last_message_at,
    updated_at: conv.updated_at,
  }));

  // Get active chat for context panel
  const activeChat = openChats.find(chat => chat.conversationId === activeTabId);
  const chatConversation = activeChat ? activeChat.conversation : null;

  return (
    <CommunicationsErrorBoundary>
      <CommunicationsLayout
        sidebar={
          <ConversationsSidebar
            conversations={sidebarConversations}
            selectedId={activeTabId || undefined}
            onSelect={handleOpenChat}
            filters={filters}
            onFilterChange={setFilters}
            isLoading={isLoading}
          />
        }
        contextPanel={
          chatConversation ? (
            <ContextPanel
              conversation={chatConversation}
              client={client}
              messages={activeChat?.messages || []}
              orders={orders}
              onCreateClient={handleCreateClient}
              onLinkClient={handleLinkClient}
              onDownloadAllFiles={handleDownloadAllFiles}
              onViewClientProfile={client ? () => handleViewClientProfile(client.id) : undefined}
            />
          ) : null
        }
        onSearch={handleSearch}
      >
        <ChatTabsArea
          openChats={openChats}
          activeTabId={activeTabId}
          onTabChange={switchToChat}
          onTabClose={closeChat}
          onSendMessage={handleSendMessage}
          onQuickAction={handleQuickAction}
          isLoading={isSending}
        />
      </CommunicationsLayout>
    </CommunicationsErrorBoundary>
  );
}

