import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CommunicationsLayout } from '../components/CommunicationsLayout';
import { ConversationsSidebar, type FilterState, type Conversation } from '../components/ConversationsSidebar';
import { ChatTabsArea } from '../components/ChatTabsArea';
import { type Message } from '../components/ChatArea';
import type { Client } from '../components/ContextPanel';
import { CommunicationsErrorBoundary } from '../components/ErrorBoundary';
import { useOpenChats } from '../hooks/useOpenChats';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useMessagesWebSocket } from '../hooks/useMessagesWebSocket';
import { inboxApi, type ConversationListItem, type ConversationWithMessages, type Message as InboxMessage } from '../api/inbox';
import { ordersApi } from '../../crm/api/orders';
import { getUserIdFromToken } from '../../notifications/utils/userId';
import { settingsApi } from '../../../lib/api';
import { CreateClientDialog } from '../components/SmartActions/CreateClientDialog';
import { CreateOrderDialog } from '../components/SmartActions/CreateOrderDialog';
import { SendPaymentLinkDialog } from '../components/SmartActions/SendPaymentLinkDialog';
import { SendTrackingStatusDialog } from '../components/SmartActions/SendTrackingStatusDialog';
import { AddInternalNoteDialog } from '../components/SmartActions/AddInternalNoteDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { DeadlineDialogContent } from '../components/SmartActions/DeadlineDialogContent';
import { NotificationToast, type NotificationData } from '../components/NotificationToast';
import { useNotifications } from '../hooks/useNotifications';
import { toast } from 'sonner';
import '../styles/animations.css';
import { useTabsState } from '../../../hooks/useTabsState';

/**
 * Enhanced Inbox Page з новим UI
 * Використовує CommunicationsLayout з 3-колонковою структурою
 */
export function InboxPageEnhanced() {
  const queryClient = useQueryClient();
  const lastMessageCheckRef = useRef<Map<string, Date>>(new Map());
  const prefetchedConversationIdsRef = useRef<Set<string>>(new Set());
  const activeTabIdRef = useRef<string | null>(null);
  
  // Нотифікації
  const { notifications, addNotification, removeNotification } = useNotifications({
    enabled: true,
  });
  const {
    openChats,
    activeTabId,
    openChat,
    closeChat,
    switchToChat,
    updateChatMessages,
    markChatAsRead,
    getActiveChat,
    getStoredConversationIds,
    getStoredActiveTabId,
  } = useOpenChats();
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);
  const { openTabs, addTab, removeTab } = useTabsState();
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [orders, setOrders] = useState<Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    total_amount?: number;
  }>>([]);
  const [filters, setFilters] = useState<FilterState>({ type: 'all' });
  const [isSending, setIsSending] = useState(false);
  const [loadingConversationIds, setLoadingConversationIds] = useState<Set<string>>(new Set());
  const paymentLoadingRef = useRef(false);
  const trackingLoadingRef = useRef(false);
  
  // State for pagination
  const [offset, setOffset] = useState(0);

  const getConversationsQueryKey = useCallback(
    (f: FilterState, o: number) => ['conversations', f, o] as const,
    []
  );

  const getConversationQueryKey = useCallback(
    (conversationId: string) => ['conversation', conversationId] as const,
    []
  );

  // React Query для conversations
  const { data: conversationsData, isLoading } = useQuery({
    queryKey: getConversationsQueryKey(filters, offset),
    queryFn: () => inboxApi.getInbox({
      filter: filters.type,
      platform: filters.platform,
      search: filters.search,
      limit: 50,
      offset: offset,
    }),
    staleTime: 5 * 60 * 1000, // 5 хвилин
    gcTime: 30 * 60 * 1000,   // 30 хвилин
  });
  
  const conversations = conversationsData?.conversations || [];
  const hasMore = conversationsData?.has_more || false;
  const total = conversationsData?.total || 0;

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [filters.type, filters.platform]);

  const handleLoadMore = () => {
    setOffset(prev => prev + 50);
  };
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Smart Actions dialogs state
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);
  const [createOrderDialogOpen, setCreateOrderDialogOpen] = useState(false);
  const [sendPaymentLinkDialogOpen, setSendPaymentLinkDialogOpen] = useState(false);
  const [sendTrackingStatusDialogOpen, setSendTrackingStatusDialogOpen] = useState(false);
  const [addInternalNoteDialogOpen, setAddInternalNoteDialogOpen] = useState(false);
  
  // Deadline dialog state for auto-create order
  const [deadlineDialogOpen, setDeadlineDialogOpen] = useState(false);
  const [pendingOrderCreation, setPendingOrderCreation] = useState<{
    fileUrl: string;
    fileName: string;
    conversationId: string;
  } | null>(null);

  // Load conversation data with client and orders
  const loadConversationData = async (conversationId: string): Promise<{ conversation: ConversationWithMessages, client?: Client, orders: any[] }> => {
    try {
      const conversation = await inboxApi.getConversation(conversationId);
      
      // Load client data if client_id exists
      let client: Client | undefined;
      let orders: any[] = [];
      
      if (conversation.client_id) {
        try {
          // Завантажуємо реальні дані клієнта через API
          const { clientsApi } = await import('../../crm/api/clients');
          const clientData = await clientsApi.getClient(conversation.client_id);
          client = {
            id: clientData.id,
            full_name: clientData.full_name,
            email: clientData.email,
            phone: clientData.phone,
            company_name: clientData.company_name,
          };
          
          // Завантажуємо замовлення клієнта
          try {
            const clientOrders = await ordersApi.getOrders({ client_id: conversation.client_id });
            orders = clientOrders.map((order: any) => ({
              id: order.id,
              title: order.order_number,
              status: order.status,
              created_at: order.created_at,
              total_amount: order.transactions?.reduce((sum: number, t: any) => 
                t.type === 'income' ? sum + t.amount : sum, 0) || 0,
              file_url: order.file_url,
              description: order.description,
            }));
          } catch (orderError) {
            console.error('Error loading client orders:', orderError);
          }
        } catch (error) {
          console.error('Error loading client data:', error);
          // Якщо не вдалося завантажити, залишаємо client undefined
        }
      }
      
      return { conversation, client, orders };
    } catch (error) {
      console.error('Error loading conversation:', error);
      throw error;
    }
  };

  // Handle opening a chat conversation
  const handleOpenChat = useCallback(async (conversationId: string) => {
    // Перевірити чи вже відкритий
    const existingChat = openChats.find(chat => chat.conversationId === conversationId);
    
    // Fire-and-forget: призначення менеджера та mark-read не мають блокувати відкриття повідомлень
    inboxApi.assignManager(conversationId).catch((error) => {
      console.error('Failed to assign manager:', error);
    });

    // Optimistic mark-as-read (UI first), API in background
    markChatAsRead(conversationId);
    queryClient.setQueriesData({ queryKey: ['conversations'] }, (old: any) => {
      if (!old?.conversations) return old;
      return {
        ...old,
        conversations: old.conversations.map((conv: ConversationListItem) =>
          conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
        ),
      };
    });
    inboxApi.markConversationRead(conversationId).catch((error) => {
      console.error('Failed to mark conversation as read:', error);
    });
    
    if (existingChat && existingChat.messages.length > 0) {
      // Таб вже відкритий І повідомлення завантажені — просто переключитись
      switchToChat(conversationId);
      
      // Оновити client/orders для context panel (тільки якщо потрібно і не завантажували нещодавно)
      const cachedData = queryClient.getQueryData(getConversationQueryKey(conversationId)) as { conversation?: ConversationWithMessages, client?: Client, orders?: any[] } | undefined;
      
      if (cachedData?.client && cachedData?.orders) {
        setClient(cachedData.client);
        setOrders(cachedData.orders);
      } else if (existingChat.conversation.client_id && (!client || client.id !== existingChat.conversation.client_id)) {
        const { client: clientData, orders: ordersData } = await loadConversationData(conversationId);
        setClient(clientData);
        setOrders(ordersData);
        queryClient.setQueryData(getConversationQueryKey(conversationId), {
          conversation: cachedData?.conversation,
          client: clientData,
          orders: ordersData,
        });
      }
    } else if (existingChat) {
      // Таб відкритий але повідомлення НЕ завантажені (restored shell) — завантажити
      switchToChat(conversationId);
      setLoadingConversationIds((prev) => { const n = new Set(prev); n.add(conversationId); return n; });
      try {
        const cacheKey = getConversationQueryKey(conversationId);
        const cached = queryClient.getQueryData(cacheKey) as { conversation?: ConversationWithMessages } | undefined;
        const conversation = cached?.conversation
          ? cached.conversation
          : await queryClient.fetchQuery({
              queryKey: cacheKey,
              queryFn: async () => ({ conversation: await inboxApi.getConversation(conversationId) }),
              staleTime: 5 * 60 * 1000,
            }).then((r: any) => r.conversation as ConversationWithMessages);

        updateChatMessages(conversationId, conversation.messages || [], {
          ...existingChat.conversation,
          id: conversation.id,
          platform: conversation.platform as any,
          external_id: conversation.external_id,
          subject: conversation.subject,
          client_id: conversation.client_id,
        });

        // Load context in background
        if (conversation.client_id) {
          (async () => {
            try {
              const { clientsApi } = await import('../../crm/api/clients');
              const [clientData, clientOrders] = await Promise.all([
                clientsApi.getClient(conversation.client_id!),
                ordersApi.getOrders({ client_id: conversation.client_id! }).catch(() => []),
              ]);
              const clientMapped: Client = { id: clientData.id, full_name: clientData.full_name, email: clientData.email, phone: clientData.phone, company_name: clientData.company_name };
              const ordersMapped = (clientOrders as any[]).map((order: any) => ({ id: order.id, title: order.order_number, status: order.status, created_at: order.created_at, total_amount: order.transactions?.reduce((sum: number, t: any) => t.type === 'income' ? sum + t.amount : sum, 0) || 0, file_url: order.file_url, description: order.description }));
              queryClient.setQueryData(cacheKey, (old: any) => ({ ...(old || {}), conversation, client: clientMapped, orders: ordersMapped }));
              if (activeTabIdRef.current === conversationId) { setClient(clientMapped); setOrders(ordersMapped); }
            } catch (e) { console.error('Error loading client context:', e); }
          })();
        }
      } catch (error) {
        toast.error('Помилка завантаження розмови');
      } finally {
        setLoadingConversationIds((prev) => { const n = new Set(prev); n.delete(conversationId); return n; });
      }
    } else {
      // Завантажити розмову та додати новий таб
      try {
        // 1) Open tab immediately with skeleton (no waiting for network)
        const convListItem = conversations.find(c => c.id === conversationId);
        const quickConversation: Conversation = {
          id: conversationId,
          platform: (convListItem?.platform || 'telegram') as any,
          external_id: convListItem?.external_id || conversationId,
          subject: convListItem?.subject,
          client_id: convListItem?.client_id,
          client_name: convListItem?.client_name,
          client_avatar: undefined,
          unread_count: 0,
          last_message: convListItem?.last_message,
          last_message_at: convListItem?.last_message_at,
          updated_at: convListItem?.updated_at || new Date().toISOString(),
        };
        openChat(quickConversation, []);
        addTab({
          conversationId: conversationId,
          platform: quickConversation.platform,
          externalId: quickConversation.external_id,
        });

        setLoadingConversationIds((prev) => {
          const next = new Set(prev);
          next.add(conversationId);
          return next;
        });

        // 2) Load messages (prefer cache), then update tab
        const cacheKey = getConversationQueryKey(conversationId);
        const cached = queryClient.getQueryData(cacheKey) as { conversation?: ConversationWithMessages, client?: Client, orders?: any[] } | undefined;

        const conversation = cached?.conversation
          ? cached.conversation
          : await queryClient.fetchQuery({
              queryKey: cacheKey,
              queryFn: async () => {
                const conv = await inboxApi.getConversation(conversationId);
                return { conversation: conv } as { conversation: ConversationWithMessages };
              },
              staleTime: 5 * 60 * 1000,
            }).then((r: any) => r.conversation as ConversationWithMessages);

        // Update messages in open chat
        updateChatMessages(conversationId, conversation.messages || [], {
          ...quickConversation,
          id: conversation.id,
          platform: conversation.platform as any,
          external_id: conversation.external_id,
          subject: conversation.subject,
          client_id: conversation.client_id,
        });

        // 3) Load context data (client/orders) in background (don’t block messages)
        const contextPromise = (async () => {
          if (!conversation.client_id) return;
          try {
            const { clientsApi } = await import('../../crm/api/clients');
            const [clientData, clientOrders] = await Promise.all([
              clientsApi.getClient(conversation.client_id),
              ordersApi.getOrders({ client_id: conversation.client_id }).catch((e) => {
                console.error('Error loading client orders:', e);
                return [];
              }),
            ]);

            const clientMapped: Client = {
              id: clientData.id,
              full_name: clientData.full_name,
              email: clientData.email,
              phone: clientData.phone,
              company_name: clientData.company_name,
            };

            const ordersMapped = (clientOrders as any[]).map((order: any) => ({
              id: order.id,
              title: order.order_number,
              status: order.status,
              created_at: order.created_at,
              total_amount: order.transactions?.reduce((sum: number, t: any) =>
                t.type === 'income' ? sum + t.amount : sum, 0) || 0,
              file_url: order.file_url,
              description: order.description,
            }));

            // cache context + set local state for active tab
            queryClient.setQueryData(cacheKey, (old: any) => ({
              ...(old || {}),
              conversation,
              client: clientMapped,
              orders: ordersMapped,
            }));

            // Update local state only if this conversation is still active
            if (activeTabIdRef.current === conversationId) {
              setClient(clientMapped);
              setOrders(ordersMapped);
            }
          } catch (e) {
            console.error('Error loading client context:', e);
          }
        })();

        void contextPromise;

        setLoadingConversationIds((prev) => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });
      } catch (error) {
        setLoadingConversationIds((prev) => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });
        toast.error('Помилка завантаження розмови');
      }
    }
  }, [
    openChats,
    openChat,
    switchToChat,
    addTab,
    updateChatMessages,
    markChatAsRead,
    conversations,
    client,
    setClient,
    setOrders,
    queryClient,
    filters,
    getConversationQueryKey,
  ]);

  // Handle new message from WebSocket
  const handleWebSocketNewMessage = useCallback((message: InboxMessage, conversationId: string) => {
    console.log('[WebSocket] New message received:', message, 'for conversation:', conversationId);
    
    // Add message to open chat if it's open
    const chat = openChats.find(c => c.conversationId === conversationId);
    if (chat) {
      updateChatMessages(conversationId, [...chat.messages, message]);
    }
    
    // Оновлюємо кеш повідомлень для цього діалогу (real-time оновлення через WebSocket)
    queryClient.setQueryData(getConversationQueryKey(conversationId), (old: any) => {
      if (!old?.conversation) return old;
      // Перевіряємо чи повідомлення вже є (щоб уникнути дублікатів)
      const existingMessage = old.conversation.messages?.find((m: InboxMessage) => m.id === message.id);
      if (existingMessage) {
        return old; // Повідомлення вже є, не додаємо дублікат
      }
      return {
        ...old,
        conversation: {
          ...old.conversation,
          messages: [...(old.conversation.messages || []), message],
        },
      };
    });
    
    // Update conversations list через React Query
    queryClient.setQueriesData({ queryKey: ['conversations'] }, (old: any) => {
      if (!old?.conversations) return old;
      const updated = [...old.conversations];
      const convIndex = updated.findIndex(c => c.id === conversationId);
      if (convIndex >= 0) {
        updated[convIndex] = {
          ...updated[convIndex],
          last_message: message.content,
          last_message_at: message.created_at,
          updated_at: message.created_at,
          unread_count: message.direction === 'inbound' 
            ? (updated[convIndex].unread_count || 0) + 1 
            : updated[convIndex].unread_count,
        };
        // Move to top
        const [conv] = updated.splice(convIndex, 1);
        updated.unshift(conv);
      }
      return { ...old, conversations: updated };
    });

    // Show notification for inbound messages
    if (message.direction === 'inbound') {
      const conv = conversations.find(c => c.id === conversationId);
      // Визначити platform з WebSocket даних (якщо є) або з conversation
      const wsData = (message as any).wsData || {};
      const platform = wsData.platform || conv?.platform || (message as any).conversation?.platform || 'telegram';
      const platformIcon = wsData.platform_icon || '💬';
      const platformName = wsData.platform_name || platform;
      
      const channelMap: Record<string, 'telegram' | 'whatsapp' | 'instagram' | 'email'> = {
        'telegram': 'telegram',
        'whatsapp': 'whatsapp',
        'instagram': 'instagram',
        'email': 'email',
      };
      const channel = channelMap[platform.toLowerCase()] || 'telegram';
      
      addNotification({
        id: message.id,
        conversationId,
        clientName: conv?.client_name || conv?.external_id || 'Невідомий',
        channel: channel,
        message: `${platformIcon} ${platformName}: ${message.content.substring(0, 100)}`,
        timestamp: new Date(),
        onOpen: () => {
          // Open the conversation when clicking "Відповісти"
          handleOpenChat(conversationId);
        },
      });
    }
  }, [
    openChats,
    updateChatMessages,
    conversations,
    addNotification,
    handleOpenChat,
    queryClient,
    filters,
    getConversationQueryKey,
  ]);

  // Handle conversation updates from WebSocket (e.g., manager assignment)
  const handleWebSocketConversationUpdate = useCallback((conversation: Partial<ConversationListItem>) => {
    console.log('[WebSocket] Conversation update received:', conversation);
    
    // Update conversations list через React Query
    if (conversation.id) {
      queryClient.setQueriesData({ queryKey: ['conversations'] }, (old: any) => {
        if (!old?.conversations) return old;
        return {
          ...old,
          conversations: old.conversations.map((conv: ConversationListItem) => 
            conv.id === conversation.id 
              ? { ...conv, ...conversation }
              : conv
          ),
        };
      });
      
      // Update open chat if it's open
      const chat = openChats.find(c => c.conversationId === conversation.id);
      if (chat && conversation.assigned_manager_id !== undefined) {
        updateChatMessages(conversation.id, chat.messages, {
          ...chat.conversation,
          assigned_manager_id: conversation.assigned_manager_id,
        });
      }
    }
  }, [openChats, updateChatMessages, queryClient, filters]);

  // WebSocket for real-time updates
  const userId = getUserIdFromToken();
  useMessagesWebSocket({
    userId: userId || 'current-user', // Fallback if no user ID found
    onNewMessage: handleWebSocketNewMessage,
    onConversationUpdate: handleWebSocketConversationUpdate,
    onConnect: () => {
      console.log('[WebSocket] Connected to real-time messages');
    },
    onDisconnect: () => {
      console.log('[WebSocket] Disconnected from real-time messages');
    },
  });

  // Responsive detection
  useEffect(() => {
    const checkBreakpoint = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  // Діагностика для aside
  useEffect(() => {
    console.log('🔍 Aside visibility check:', {
      isMobile,
      windowWidth: window.innerWidth,
      shouldRender: !isMobile,
    });
  }, [isMobile]);

  // React Query автоматично оновлює conversations при зміні filters

  // Відновити раніше відкриті чати з localStorage (lightweight — без flood API)
  const restoreInitiatedRef = useRef(false);
  useEffect(() => {
    if (restoreInitiatedRef.current) return;
    if (!conversations || conversations.length === 0 || isLoading) return;
    if (openChats.length > 0) return;

    restoreInitiatedRef.current = true;

    const storedIds = getStoredConversationIds();
    const storedActiveTabId = getStoredActiveTabId();

    if (storedIds.length > 0) {
      // 1. Open tab shells immediately from inbox data — NO API calls
      const MAX_RESTORE = 7;
      const idsToRestore = storedIds.slice(0, MAX_RESTORE);

      for (const convId of idsToRestore) {
        const convListItem = conversations.find(c => c.id === convId);
        if (!convListItem) continue;

        const quickConversation: Conversation = {
          id: convId,
          platform: (convListItem.platform || 'telegram') as any,
          external_id: convListItem.external_id || convId,
          subject: convListItem.subject,
          client_id: convListItem.client_id,
          client_name: convListItem.client_name,
          client_avatar: undefined,
          unread_count: convListItem.unread_count || 0,
          last_message: convListItem.last_message,
          last_message_at: convListItem.last_message_at,
          updated_at: convListItem.updated_at || new Date().toISOString(),
        };
        openChat(quickConversation, []);
        addTab({
          conversationId: convId,
          platform: quickConversation.platform,
          externalId: quickConversation.external_id,
        });
      }

      // 2. Load full data ONLY for the active tab (or first restored)
      const activeId = (storedActiveTabId && idsToRestore.includes(storedActiveTabId))
        ? storedActiveTabId
        : idsToRestore[0];

      if (activeId) {
        switchToChat(activeId);
        // Use handleOpenChat only for the active tab — loads messages + context
        handleOpenChat(activeId).catch(e => console.warn('Failed to load active tab:', e));
      }
    } else {
      // No stored chats — open the first conversation
      const firstConversation = conversations[0];
      if (firstConversation) {
        handleOpenChat(firstConversation.id);
      }
    }
  }, [conversations, isLoading]); // minimal deps — ref guards against re-execution

  // Listen for navigation events to open conversation
  useEffect(() => {
    const handleNavigateConversation = (event: CustomEvent) => {
      const { conversationId } = event.detail;
      if (conversationId) {
        handleOpenChat(conversationId);
      }
    };

    window.addEventListener('navigate:conversation', handleNavigateConversation as EventListener);
    return () => {
      window.removeEventListener('navigate:conversation', handleNavigateConversation as EventListener);
    };
  }, [handleOpenChat]);

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

  // Функція для оновлення conversations через React Query
  const refreshConversations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }, [queryClient]);

  const handleSendMessage = async (conversationId: string, content: string, attachments?: File[]) => {
    if (!conversationId) return;

    try {
      setIsSending(true);
      
      // Upload files first if there are any
      let uploadedAttachments: Array<{
        id?: string;
        type: string;
        filename: string;
        mime_type: string;
        size: number;
        url?: string;
      }> = [];
      
      if (attachments && attachments.length > 0) {
        const uploadPromises = attachments.map(async (file) => {
          try {
            const uploaded = await inboxApi.uploadFile(file);
            return {
              id: uploaded.id,
              type: uploaded.type,
              filename: uploaded.filename || file.name,
              mime_type: uploaded.mime_type || file.type,
              size: uploaded.size || file.size,
              url: uploaded.url,
            };
          } catch (error) {
            console.error('Failed to upload file:', file.name, error);
            toast.error(`Помилка завантаження: ${file.name}`);
            return null;
          }
        });
        
        const results = await Promise.all(uploadPromises);
        uploadedAttachments = results.filter((r): r is NonNullable<typeof r> => r !== null);
      }

      const newMessage = await inboxApi.sendMessage(
        conversationId, 
        content, 
        uploadedAttachments.length > 0 ? uploadedAttachments : undefined
      );
      
      // Update messages in open chat using hook
      const chat = openChats.find(c => c.conversationId === conversationId);
      if (chat) {
        updateChatMessages(conversationId, [...chat.messages, newMessage]);
      }
      
      // Оновлюємо кеш повідомлень для цього діалогу
      queryClient.setQueryData(getConversationQueryKey(conversationId), (old: any) => {
        if (!old?.conversation) return old;
        return {
          ...old,
          conversation: {
            ...old.conversation,
            messages: [...(old.conversation.messages || []), newMessage],
          },
        };
      });
      
      // Refresh conversations list to update last message
      refreshConversations();
      
      toast.success('Повідомлення відправлено');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Помилка відправки повідомлення');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendDraft = async (messageId: string, content: string) => {
    // Знайти чернетку в чаті
    const chat = openChats.find(c => 
      c.messages.some(m => m.id === messageId && m.status === 'draft')
    );
    
    if (!chat) {
      toast.error('Чернетка не знайдена');
      return;
    }
    
    // Відправити повідомлення клієнту
    await handleSendMessage(chat.conversationId, content);
    
    // Видалити чернетку з чату
    const updatedMessages = chat.messages.filter(m => m.id !== messageId);
    updateChatMessages(chat.conversationId, updatedMessages);
    
    toast.success('Повідомлення відправлено клієнту');
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await inboxApi.deleteMessage(messageId);
      
      // Remove message from all open chats
      const chat = openChats.find(c => c.messages.some(m => m.id === messageId));
      if (chat) {
        const updatedMessages = chat.messages.filter(m => m.id !== messageId);
        updateChatMessages(chat.conversationId, updatedMessages);
      }
      
      toast.success('Повідомлення видалено');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Помилка видалення повідомлення');
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
          refreshConversations();
          break;
        
        case 'download_files':
          toast.info('Завантаження файлів...');
          await inboxApi.quickAction(conversationId, 'download_files');
          toast.success('Файли завантажено');
          break;
        
        case 'create_order':
          toast.info('Tworzenie zlecenia...');
          await inboxApi.quickAction(conversationId, 'create_order', data);
          toast.success('Zlecenie utworzone');
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
    setCreateClientDialogOpen(true);
  };

  const handleCreateClientSuccess = async (clientId: string) => {
    if (!activeTabId) return;
    
    try {
      // 1. Завантажуємо дані клієнта НАПРЯМУ по clientId
      const { clientsApi } = await import('../../crm/api/clients');
      const clientData = await clientsApi.getClient(clientId);
      const newClient: Client = {
        id: clientData.id,
        full_name: clientData.full_name,
        email: clientData.email,
        phone: clientData.phone,
        company_name: clientData.company_name,
      };
      
      // 2. Відразу оновлюємо стан клієнта
      setClient(newClient);
      
      // 3. Прив'язуємо conversation до клієнта
      await inboxApi.linkClientToConversation(activeTabId, clientId);
      
      // 4. Оновлюємо conversation в openChats з client_id
      const chat = openChats.find(c => c.conversationId === activeTabId);
      if (chat) {
        updateChatMessages(activeTabId, chat.messages, {
          ...chat.conversation,
          client_id: clientId,
          client_name: newClient.full_name,
        });
      }
      
      // 5. Оновлюємо список conversations через React Query
      queryClient.setQueriesData({ queryKey: ['conversations'] }, (old: any) => {
        if (!old?.conversations) return old;
        return {
          ...old,
          conversations: old.conversations.map((conv: ConversationListItem) => 
            conv.id === activeTabId 
              ? { ...conv, client_id: clientId, client_name: newClient.full_name }
              : conv
          ),
        };
      });
      
      toast.success(`Клієнт ${newClient.full_name || 'створений'} прив'язаний до діалогу`);
    } catch (error) {
      console.error('Error in handleCreateClientSuccess:', error);
      toast.error('Помилка прив\'язки клієнта');
    }
  };

  const handleCreateOrder = () => {
    if (!client) {
      toast.error('Спочатку створіть або прив\'яжіть клієнта');
      return;
    }
    setCreateOrderDialogOpen(true);
  };

  const handleCreateOrderSuccess = async (orderId: string) => {
    if (!activeTabId) return;
    
    // Reload orders
    const { orders: updatedOrders } = await loadConversationData(activeTabId);
    setOrders(updatedOrders);
  };

  const handleSendPaymentLink = () => {
    if (!client || orders.length === 0) {
      toast.error('Немає замовлень для відправки оплати');
      return;
    }
    setSendPaymentLinkDialogOpen(true);
  };

  const handleSendTrackingStatus = () => {
    if (!client || orders.length === 0) {
      toast.error('Немає замовлень для відправки статусу');
      return;
    }
    setSendTrackingStatusDialogOpen(true);
  };

  const handleAddInternalNote = () => {
    setAddInternalNoteDialogOpen(true);
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
    // Navigate to clients page and select the client
    window.dispatchEvent(
      new CustomEvent('command:navigate', { detail: { path: `/clients/${clientId}` } })
    );
  };

  const handleSearch = (query: string) => {
    setFilters((prev) => ({ ...prev, search: query }));
  };

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => {
      console.log('Toggle sidebar state:', prev, '->', !prev);
      return !prev;
    });
  }, []);

  // Handlers for Quick Actions Sidebar
  const handleAddEmail = async (conversationId: string, email: string) => {
    if (!client?.id) {
      toast.error('Спочатку створіть або прив\'яжіть клієнта');
      return;
    }
    
    try {
      const result = await inboxApi.updateClientContact(client.id, { 
        email,
        conversation_id: conversationId 
      });
      
      // Оновлюємо стан клієнта з новим email
      setClient(prev => prev ? { ...prev, email: result.email || email } : prev);
      
      // Оновлюємо conversation в списку, якщо він прив'язаний через React Query
      if (result.conversation_linked) {
        queryClient.setQueriesData({ queryKey: ['conversations'] }, (old: any) => {
          if (!old?.conversations) return old;
          return {
            ...old,
            conversations: old.conversations.map((conv: ConversationListItem) => 
              conv.id === conversationId 
                ? { ...conv, client_id: client.id, client_name: client.full_name }
                : conv
            ),
          };
        });
        
        // Оновлюємо conversation в openChats
        const chat = openChats.find(c => c.conversationId === conversationId);
        if (chat) {
          updateChatMessages(conversationId, chat.messages, {
            ...chat.conversation,
            client_id: client.id,
            client_name: client.full_name,
          });
        }
      }
      
      toast.success(`Email ${email} додано до картки клієнта ${client.full_name || 'клієнта'}`);
    } catch (error) {
      console.error('Error adding email:', error);
      toast.error('Помилка додавання email');
    }
  };

  const handleAddPhone = async (conversationId: string, phone: string) => {
    if (!client?.id) {
      toast.error('Спочатку створіть або прив\'яжіть клієнта');
      return;
    }
    
    try {
      const result = await inboxApi.updateClientContact(client.id, { 
        phone,
        conversation_id: conversationId 
      });
      
      // Оновлюємо стан клієнта з новим телефоном
      setClient(prev => prev ? { ...prev, phone: result.phone || phone } : prev);
      
      // Оновлюємо conversation в списку, якщо він прив'язаний через React Query
      if (result.conversation_linked) {
        queryClient.setQueriesData({ queryKey: ['conversations'] }, (old: any) => {
          if (!old?.conversations) return old;
          return {
            ...old,
            conversations: old.conversations.map((conv: ConversationListItem) => 
              conv.id === conversationId 
                ? { ...conv, client_id: client.id, client_name: client.full_name }
                : conv
            ),
          };
        });
        
        // Оновлюємо conversation в openChats
        const chat = openChats.find(c => c.conversationId === conversationId);
        if (chat) {
          updateChatMessages(conversationId, chat.messages, {
            ...chat.conversation,
            client_id: client.id,
            client_name: client.full_name,
          });
        }
      }
      
      toast.success(`Телефон ${phone} додано до картки клієнта ${client.full_name || 'клієнта'}`);
    } catch (error) {
      console.error('Error adding phone:', error);
      toast.error('Помилка додавання телефону');
    }
  };

  const handleAddFile = async (conversationId: string, fileUrl: string, fileName: string) => {
    if (!orders || orders.length === 0) {
      toast.error('Немає замовлень для додавання файлу');
      return;
    }
    
    // Use first order or let user select
    const orderId = orders[0]?.id;
    if (!orderId) {
      toast.error('Немає замовлень для додавання файлу');
      return;
    }
    
    try {
      await inboxApi.addFileToOrder(orderId, fileUrl, fileName);
      toast.success(`Plik ${fileName} dodano do zlecenia`);
    } catch (error) {
      console.error('Error adding file:', error);
      toast.error('Помилка додавання файлу');
    }
  };

  const handleAddFileAutoCreateOrder = async (conversationId: string, fileUrl: string, fileName: string) => {
    if (!client) {
      toast.error('Спочатку створіть клієнта');
      return;
    }
    
    // Open deadline dialog first
    setPendingOrderCreation({ fileUrl, fileName, conversationId });
    setDeadlineDialogOpen(true);
  };

  const handleCreateOrderWithDeadline = async (deadline?: string) => {
    if (!pendingOrderCreation || !client) {
      return;
    }
    
    const { fileUrl, fileName, conversationId } = pendingOrderCreation;
    
    // Get manager ID from token
    const managerId = getUserIdFromToken();
    if (!managerId) {
      toast.error('Помилка автентифікації. Будь ласка, увійдіть знову.');
      setDeadlineDialogOpen(false);
      setPendingOrderCreation(null);
      return;
    }
    
    try {
      // Generate order number
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      const timestamp = Date.now().toString(36).substring(5).toLowerCase();
      const randomCode = Math.random().toString(36).substring(2, 4).toLowerCase();
      const orderNumber = `N/${day}/${month}/${year}/auto/${timestamp}${randomCode}`;
      
      // Create new order for this client with deadline
      const newOrder = await ordersApi.createOrder({
        client_id: client.id,
        manager_id: managerId,
        order_number: orderNumber,
        description: `Автоматично створено з діалогу. Файл: ${fileName}`,
        status: 'do_wykonania',
        deadline: deadline ? `${deadline}T23:59:59.000Z` : undefined,
      });
      
      // Add file to the new order
      await inboxApi.addFileToOrder(newOrder.id, fileUrl, fileName);
      
      // Reload orders
      if (activeTabId) {
        const { orders: updatedOrders } = await loadConversationData(activeTabId);
        setOrders(updatedOrders);
      }
      
      toast.success(`Utworzono zlecenie i dodano plik ${fileName}`);
      setDeadlineDialogOpen(false);
      setPendingOrderCreation(null);
    } catch (error) {
      console.error('Error creating order and adding file:', error);
      toast.error('Błąd tworzenia zlecenia');
      setDeadlineDialogOpen(false);
      setPendingOrderCreation(null);
    }
  };

  const handleAddAddress = async (conversationId: string, address: string, isPaczkomat: boolean, paczkomatCode?: string) => {
    if (!orders || orders.length === 0) {
      toast.error('Немає замовлень для додавання адреси');
      return;
    }
    
    // Use first order
    const orderId = orders[0]?.id;
    if (!orderId) {
      toast.error('Немає замовлень для додавання адреси');
      return;
    }
    
    try {
      // Add address/paczkomat to order via API
      const result = await inboxApi.addAddressToOrder(orderId, address, isPaczkomat, paczkomatCode);
      
      // Show success message with delivery cost if paczkomat
      if (isPaczkomat) {
        toast.success(`Paczkomat ${paczkomatCode} dodano do zlecenia. Koszt dostawy: 13.99 zł`);
      } else {
        toast.success(`Adres dodano do zlecenia`);
      }
      
      // Reload orders
      if (activeTabId) {
        const { orders: updatedOrders } = await loadConversationData(activeTabId);
        setOrders(updatedOrders);
      }
    } catch (error) {
      console.error('Error adding address:', error);
      toast.error('Помилка додавання адреси');
    }
  };

  const handlePaymentClick = async (conversationId: string) => {
    if (paymentLoadingRef.current) return;
    paymentLoadingRef.current = true;
    try {
      return await _handlePaymentClickInner(conversationId);
    } finally {
      paymentLoadingRef.current = false;
    }
  };

  const _handlePaymentClickInner = async (conversationId: string) => {
    let currentOrders = orders;
    
    // Якщо замовлення не завантажені, спробувати завантажити
    if (!currentOrders || currentOrders.length === 0) {
      const activeChat = openChats.find(c => c.conversationId === conversationId);
      const conversationClientId = activeChat?.conversation.client_id;
      
      if (conversationClientId) {
        try {
          toast.info('Завантаження замовлень...');
          const clientOrders = await ordersApi.getOrders({ client_id: conversationClientId });
          const loadedOrders = clientOrders.map((order: any) => ({
            id: order.id,
            title: order.order_number,
            status: order.status,
            created_at: order.created_at,
            total_amount: order.transactions?.reduce((sum: number, t: any) => 
              t.type === 'income' ? sum + t.amount : sum, 0) || 0,
            file_url: order.file_url,
            description: order.description,
          }));
          
          if (loadedOrders.length === 0) {
            toast.error('Немає замовлень для відправки оплати');
            return;
          }
          
          setOrders(loadedOrders);
          currentOrders = loadedOrders; // Використовуємо завантажені замовлення
        } catch (error) {
          console.error('Error loading orders:', error);
          toast.error('Помилка завантаження замовлень');
          return;
        }
      } else {
        toast.error('Немає замовлень для відправки оплати');
        return;
      }
    }
    
    // Use first order
    const orderId = currentOrders[0]?.id;
    if (!orderId) {
      toast.error('Немає замовлень для відправки оплати');
      return;
    }

    try {
      // Try to detect amount from last message
      const activeChat = getActiveChat();
      const lastMessage = activeChat?.messages[activeChat.messages.length - 1];
      let amount: number | undefined;
      
      if (lastMessage && lastMessage.direction === 'inbound') {
        const amountRegex = /(\d+)\s*(zł|zl|złotych|pln)/gi;
        const match = lastMessage.content.match(amountRegex);
        if (match) {
          amount = parseInt(match[0].replace(/[^\d]/g, ''));
        }
      }

      const { payment_link } = await inboxApi.createPaymentLink(orderId, amount);
      
      // Створити чернетку в чаті замість відправки
      const draftMessage: Message = {
        id: `draft-${Date.now()}`,
        conversation_id: conversationId,
        direction: 'outbound',
        type: 'text',
        content: `💳 Посилання для оплати${amount ? ` ${amount} zł` : ''}:\n${payment_link}`,
        status: 'draft',
        created_at: new Date().toISOString(),
        meta_data: {
          payment_link,
          order_id: orderId,
          amount,
        },
      };
      
      // Додати чернетку до чату
      const chat = openChats.find(c => c.conversationId === conversationId);
      if (chat) {
        updateChatMessages(conversationId, [...chat.messages, draftMessage]);
      }
      
      toast.success('Посилання на оплату створено. Натисніть "Відправити клієнту" для надсилання.');
    } catch (error) {
      console.error('Error creating payment link:', error);
      toast.error('Помилка створення посилання на оплату');
    }
  };

  const handleTrackingClick = async (conversationId: string) => {
    if (trackingLoadingRef.current) return;
    trackingLoadingRef.current = true;
    try {
      return await _handleTrackingClickInner(conversationId);
    } finally {
      trackingLoadingRef.current = false;
    }
  };

  const _handleTrackingClickInner = async (conversationId: string) => {
    let currentOrders = orders;
    
    // Якщо замовлення не завантажені, спробувати завантажити
    if (!currentOrders || currentOrders.length === 0) {
      const activeChat = openChats.find(c => c.conversationId === conversationId);
      const conversationClientId = activeChat?.conversation.client_id;
      
      if (conversationClientId) {
        try {
          toast.info('Завантаження замовлень...');
          const clientOrders = await ordersApi.getOrders({ client_id: conversationClientId });
          const loadedOrders = clientOrders.map((order: any) => ({
            id: order.id,
            title: order.order_number,
            status: order.status,
            created_at: order.created_at,
            total_amount: order.transactions?.reduce((sum: number, t: any) => 
              t.type === 'income' ? sum + t.amount : sum, 0) || 0,
            file_url: order.file_url,
            description: order.description,
          }));
          
          if (loadedOrders.length === 0) {
            toast.error('Немає замовлень для відправки трекінгу');
            return;
          }
          
          setOrders(loadedOrders);
          currentOrders = loadedOrders; // Використовуємо завантажені замовлення
        } catch (error) {
          console.error('Error loading orders:', error);
          toast.error('Помилка завантаження замовлень');
          return;
        }
      } else {
        toast.error('Немає замовлень для відправки трекінгу');
        return;
      }
    }
    
    const order = currentOrders[0];
    const orderId = order?.id;
    if (!orderId) {
      toast.error('Немає замовлень для відправки трекінгу');
      return;
    }

    try {
      let tracking = await inboxApi.getTracking(orderId);
      
      if (!tracking.number || !tracking.trackingUrl) {
        if (tracking.message?.includes('not created') || tracking.message?.includes('Shipment not created')) {
          try {
            // Завантажуємо дані замовлення з клієнтом, якщо ще не завантажені
            let orderWithClient = order;
            if (!order.client) {
              try {
                const fullOrder = await ordersApi.getOrder(orderId);
                orderWithClient = fullOrder;
              } catch (err) {
                console.error('Error loading order with client:', err);
              }
            }
            
            const activeChat = openChats.find(c => c.conversationId === conversationId);
            const currentConversation = activeChat?.conversation;
            
            const externalId = currentConversation?.external_id || '';
            // Only use external_id as fallback if it looks like a valid email/phone
            const isEmailLike = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
            const isPhoneLike = (v: string) => /^\+?[0-9]{9,15}$/.test(v);

            // Пріоритет: order.client > client (зі стану) > externalId
            const orderClient = orderWithClient?.client;
            const receiverEmail = orderClient?.email || client?.email || (isEmailLike(externalId) ? externalId : '');
            const receiverPhone = orderClient?.phone || client?.phone || (isPhoneLike(externalId) ? externalId : '');
            const receiverName = orderClient?.full_name || client?.full_name || client?.name || 'Klient';

            if (!receiverEmail && !receiverPhone) {
              toast.error('Немає email або телефону клієнта для створення відправлення. Додайте контактні дані клієнта.');
              return;
            }

            const shipmentData = {
              order_id: orderId,
              delivery_type: 'parcel_locker' as const,
              parcel_locker_code: 'KRA010',
              receiver: {
                email: receiverEmail || 'client@example.com',
                phone: receiverPhone || '+48123456789',
                name: receiverName,
              },
              package_size: 'small' as const,
            };

            toast.info('Створюємо відправлення...');
            const shipment = await settingsApi.createShipment(shipmentData);
            
            if (shipment && shipment.tracking_number) {
              const trackingNumber = shipment.tracking_number;
              const trackingUrl = shipment.tracking_url || `https://inpost.pl/sledzenie-przesylek?number=${trackingNumber}`;
              
              tracking = {
                number: trackingNumber,
                trackingUrl: trackingUrl,
                order_id: orderId,
              };
              
              toast.success(`✅ Відправлення створено! Номер трекінгу: ${trackingNumber}`);
            } else {
              console.error('Shipment response:', shipment);
              toast.error('Не вдалося отримати номер трекінгу після створення відправлення. Спробуйте пізніше.');
              return;
            }
          } catch (createError: any) {
            console.error('Error creating shipment:', createError);
            const errorMessage = createError.response?.data?.detail || createError.message || 'Невідома помилка';
            toast.error(`Помилка створення відправлення: ${errorMessage}`);
            return;
          }
        } else {
          toast.error(tracking.message || 'Трекінг номер ще не створений');
          return;
        }
      }

      if (tracking.number && tracking.trackingUrl) {
        const draftMessage: Message = {
          id: `draft-${Date.now()}`,
          conversation_id: conversationId,
          direction: 'outbound',
          type: 'text',
          content: `📦 Twoje zlecenie zostało wysłane!\n\nNumer śledzenia: ${tracking.number}\nŚledź: ${tracking.trackingUrl}`,
          status: 'draft',
          created_at: new Date().toISOString(),
          meta_data: {
            tracking_number: tracking.number,
            tracking_url: tracking.trackingUrl,
            order_id: orderId,
          },
        };
        
        const chat = openChats.find(c => c.conversationId === conversationId);
        if (chat) {
          updateChatMessages(conversationId, [...chat.messages, draftMessage]);
        }
        
        toast.success('Трекінг номер створено. Натисніть "Відправити клієнту" для надсилання.');
      }
    } catch (error: any) {
      console.error('Error getting tracking:', error);
      toast.error(`Помилка отримання трекінг номера: ${error.message || 'Невідома помилка'}`);
    }
  };

  const handleClientClick = (conversationId: string) => {
    if (client?.id) {
      handleViewClientProfile(client.id);
    } else {
      // Відкрити діалог створення клієнта
      setCreateClientDialogOpen(true);
    }
  };

  const handleOrderClick = async (_conversationId: string) => {
    let currentOrders = orders;
    
    // Якщо замовлення не завантажені, спробувати завантажити
    if (!currentOrders || currentOrders.length === 0) {
      const activeChat = openChats.find(c => c.conversationId === activeTabId);
      const conversationClientId = activeChat?.conversation.client_id || client?.id;
      
      if (conversationClientId) {
        try {
          const clientOrders = await ordersApi.getOrders({ client_id: conversationClientId });
          const loadedOrders = clientOrders.map((order: any) => ({
            id: order.id,
            title: order.order_number,
            status: order.status,
            created_at: order.created_at,
            total_amount: order.transactions?.reduce((sum: number, t: any) => 
              t.type === 'income' ? sum + t.amount : sum, 0) || 0,
            file_url: order.file_url,
            description: order.description,
          }));
          
          setOrders(loadedOrders);
          currentOrders = loadedOrders;
        } catch (error) {
          console.error('Error loading orders:', error);
          // Продовжити - можливо замовлень немає, відкриємо діалог створення
        }
      }
    }
    
    if (currentOrders && currentOrders.length > 0) {
      // Navigate to order page
      const orderId = currentOrders[0].id;
      window.dispatchEvent(
        new CustomEvent('command:navigate', {
          detail: { path: '/crm', kpId: orderId }
        })
      );
    } else if (client?.id) {
      // Відкрити діалог створення замовлення
      setCreateOrderDialogOpen(true);
    } else {
      toast.info('Спочатку створіть клієнта');
    }
  };

  const handleDocumentsClick = async (conversationId: string) => {
    if (!conversationId) return;
    await handleQuickAction(conversationId, 'download_files');
  };


  // Helper functions to get client/order IDs for active conversation
  const getClientIdForConversation = (conversationId: string): string | undefined => {
    if (activeTabId === conversationId) {
      return client?.id;
    }
    return undefined;
  };

  const getOrderIdForConversation = (conversationId: string): string | undefined => {
    if (activeTabId === conversationId && orders && orders.length > 0) {
      return orders[0]?.id;
    }
    return undefined;
  };

  const getClientEmailForConversation = (conversationId: string): string | undefined => {
    if (activeTabId === conversationId) {
      return client?.email;
    }
    return undefined;
  };

  const getClientPhoneForConversation = (conversationId: string): string | undefined => {
    if (activeTabId === conversationId) {
      return client?.phone;
    }
    return undefined;
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
    <>
      <CommunicationsErrorBoundary>
        <CommunicationsLayout
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          sidebar={
            <ConversationsSidebar
              conversations={sidebarConversations}
              selectedId={activeTabId || undefined}
              onSelect={handleOpenChat}
              onPrefetch={(id) => {
                if (prefetchedConversationIdsRef.current.has(id)) return;
                prefetchedConversationIdsRef.current.add(id);
                queryClient.prefetchQuery({
                  queryKey: getConversationQueryKey(id),
                  queryFn: async () => ({ conversation: await inboxApi.getConversation(id) }),
                  staleTime: 5 * 60 * 1000,
                }).catch(() => {
                  // prefetch is best-effort; allow retry later
                  prefetchedConversationIdsRef.current.delete(id);
                });
              }}
              filters={filters}
              onFilterChange={setFilters}
              isLoading={isLoading}
              total={total}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
            />
          }
          contextPanel={undefined}
          onSearch={handleSearch}
        >
          <ChatTabsArea
            openChats={openChats}
            activeTabId={activeTabId}
            onTabChange={handleOpenChat}
            onTabClose={(conversationId) => {
              removeTab(conversationId);
              closeChat(conversationId);
              setLoadingConversationIds((prev) => {
                if (!prev.has(conversationId)) return prev;
                const next = new Set(prev);
                next.delete(conversationId);
                return next;
              });
            }}
            onSendMessage={handleSendMessage}
            onQuickAction={handleQuickAction}
            isLoading={
              !!activeTabId &&
              (loadingConversationIds.has(activeTabId) || isSending)
            }
            isSidebarOpen={isSidebarOpen}
            getClientId={getClientIdForConversation}
            getOrderId={getOrderIdForConversation}
            getClientEmail={getClientEmailForConversation}
            getClientPhone={getClientPhoneForConversation}
            onAddEmail={handleAddEmail}
            onAddPhone={handleAddPhone}
            onAddFile={handleAddFile}
            onAddFileAutoCreateOrder={handleAddFileAutoCreateOrder}
            onAddAddress={handleAddAddress}
            onPaymentClick={handlePaymentClick}
            onTrackingClick={handleTrackingClick}
            onClientClick={handleClientClick}
            onOrderClick={handleOrderClick}
            onDocumentsClick={handleDocumentsClick}
            onToggleSidebar={handleToggleSidebar}
            onDeleteMessage={handleDeleteMessage}
            onSendDraft={handleSendDraft}
          />
        </CommunicationsLayout>
      </CommunicationsErrorBoundary>

      {/* Smart Actions Dialogs */}
      {chatConversation && (
        <>
          <CreateClientDialog
            open={createClientDialogOpen}
            onOpenChange={setCreateClientDialogOpen}
            conversation={chatConversation}
            messages={activeChat?.messages || []}
            onSuccess={handleCreateClientSuccess}
          />
          
          {client && (
            <>
              <CreateOrderDialog
                open={createOrderDialogOpen}
                onOpenChange={setCreateOrderDialogOpen}
                clientId={client.id}
                onSuccess={handleCreateOrderSuccess}
                conversation={chatConversation}
              />
              
              {orders.length > 0 && (
                <>
                  <SendPaymentLinkDialog
                    open={sendPaymentLinkDialogOpen}
                    onOpenChange={setSendPaymentLinkDialogOpen}
                    orders={orders.map(o => ({
                      id: o.id,
                      order_number: o.title,
                      total_amount: o.total_amount,
                    }))}
                    onSuccess={() => {
                      // Refresh messages after sending
                      if (activeTabId) {
                        loadConversationData(activeTabId).then(({ conversation }) => {
                          updateChatMessages(activeTabId, conversation.messages);
                        });
                      }
                    }}
                  />
                  
                  <SendTrackingStatusDialog
                    open={sendTrackingStatusDialogOpen}
                    onOpenChange={setSendTrackingStatusDialogOpen}
                    orders={orders.map(o => ({
                      id: o.id,
                      order_number: o.title,
                    }))}
                    officeAddress="Адреса офісу не вказана" // TODO: Get from settings
                    onSuccess={() => {
                      // Refresh messages after sending
                      if (activeTabId) {
                        loadConversationData(activeTabId).then(({ conversation }) => {
                          updateChatMessages(activeTabId, conversation.messages);
                        });
                      }
                    }}
                  />
                </>
              )}
            </>
          )}
          
          <AddInternalNoteDialog
            open={addInternalNoteDialogOpen}
            onOpenChange={setAddInternalNoteDialogOpen}
            conversationId={chatConversation.id}
            clientId={client?.id}
            orders={orders.map(o => ({
              id: o.id,
              order_number: o.title,
            }))}
            onSuccess={() => {
              toast.success('Нотатку збережено');
            }}
          />
        </>
      )}

      {/* Deadline Dialog for Auto-Create Order */}
      <Dialog open={deadlineDialogOpen} onOpenChange={setDeadlineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ustaw termin dla zlecenia</DialogTitle>
            <DialogDescription className="sr-only">
              Діалогове вікно для встановлення терміну виконання замовлення
            </DialogDescription>
          </DialogHeader>
          <DeadlineDialogContent 
            onConfirm={handleCreateOrderWithDeadline}
            onCancel={() => {
              setDeadlineDialogOpen(false);
              setPendingOrderCreation(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Нотифікації - ПОЗА ErrorBoundary */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onClose={() => removeNotification(notification.id)}
            autoCloseDelay={10000}
          />
        ))}
      </div>
    </>
  );
  }

