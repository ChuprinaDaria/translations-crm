import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CommunicationsLayout } from '../components/CommunicationsLayout';
import { Menu, CreditCard, Package, UserPlus, User, StickyNote, FolderOpen, ClipboardList } from 'lucide-react';
import { SideTabs, SidePanel, type SideTab } from '../../../components/ui';
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
import { InternalNotes } from '../../crm/components/InternalNotes';
import { AttachmentPreview } from '../components/AttachmentPreview';

// Конфігурація табів для Inbox
const INBOX_SIDE_TABS: SideTab[] = [
  { id: 'sidebar', icon: Menu, label: 'Відкрити список діалогів', color: 'gray' },
  { id: 'notes', icon: StickyNote, label: 'Нотатки', color: 'gray' },
  { id: 'files', icon: FolderOpen, label: 'Файли', color: 'gray' },
  { id: 'create-client', icon: UserPlus, label: 'Створити клієнта', color: 'gray' },
  { id: 'view-client', icon: User, label: 'Переглянути клієнта', color: 'gray' },
  { id: 'order', icon: ClipboardList, label: 'Utwórz zlecenie', color: 'gray' },
  { id: 'tracking', icon: Package, label: 'Трекінг', color: 'gray' },
  { id: 'payment', icon: CreditCard, label: 'Відправити посилання на оплату', color: 'gray' },
];

/**
 * Enhanced Inbox Page з новим UI
 * Використовує CommunicationsLayout з 3-колонковою структурою
 */
export function InboxPageEnhanced() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const lastMessageCheckRef = useRef<Map<string, Date>>(new Map());
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<string | null>(null);
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
    
    // Призначити менеджера при відкритті діалогу
    try {
      await inboxApi.assignManager(conversationId);
    } catch (error) {
      console.error('Failed to assign manager:', error);
      // Не блокуємо відкриття діалогу, якщо призначення не вдалося
    }
    
    // Позначити як прочитане та оновити локальний стан
    try {
      await inboxApi.markConversationRead(conversationId);
      // Оновити unread_count в списку розмов
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
      ));
      // Оновити unread_count у відкритому табі
      markChatAsRead(conversationId);
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
    
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
          unread_count: 0, // Вже прочитано
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
  }, [openChats, openChat, switchToChat, markChatAsRead, conversations, setClient, setOrders, setConversations]);

  // Handle new message from WebSocket
  const handleWebSocketNewMessage = useCallback((message: InboxMessage, conversationId: string) => {
    console.log('[WebSocket] New message received:', message, 'for conversation:', conversationId);
    
    // Add message to open chat if it's open
    const chat = openChats.find(c => c.conversationId === conversationId);
    if (chat) {
      updateChatMessages(conversationId, [...chat.messages, message]);
    }
    
    // Update conversations list
    setConversations(prev => {
      const updated = [...prev];
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
      return updated;
    });

    // Show notification for inbound messages
    if (message.direction === 'inbound') {
      const conv = conversations.find(c => c.id === conversationId);
      // Визначити platform з conversation або з WebSocket даних
      const platform = conv?.platform || (message as any).conversation?.platform || 'telegram';
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
        message: message.content.substring(0, 100),
        timestamp: new Date(),
        onOpen: () => {
          // Open the conversation when clicking "Відповісти"
          handleOpenChat(conversationId);
        },
      });
    }
  }, [openChats, updateChatMessages, conversations, addNotification, handleOpenChat]);

  // Handle conversation updates from WebSocket (e.g., manager assignment)
  const handleWebSocketConversationUpdate = useCallback((conversation: Partial<ConversationListItem>) => {
    console.log('[WebSocket] Conversation update received:', conversation);
    
    // Update conversations list
    if (conversation.id) {
      setConversations(prev => prev.map(conv => 
        conv.id === conversation.id 
          ? { ...conv, ...conversation }
          : conv
      ));
      
      // Update open chat if it's open
      const chat = openChats.find(c => c.conversationId === conversation.id);
      if (chat && conversation.assigned_manager_id !== undefined) {
        updateChatMessages(conversation.id, chat.messages, {
          ...chat.conversation,
          assigned_manager_id: conversation.assigned_manager_id,
        });
      }
    }
  }, [openChats, updateChatMessages]);

  // WebSocket for real-time updates
  const userId = getUserIdFromToken();
  const { isConnected: wsConnected } = useMessagesWebSocket({
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

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, [filters]);

  // Відновити раніше відкриті чати з localStorage
  useEffect(() => {
    if (conversations && conversations.length > 0 && openChats.length === 0 && !isLoading) {
      const storedIds = getStoredConversationIds();
      const storedActiveTabId = getStoredActiveTabId();
      
      if (storedIds.length > 0) {
        // Restore previously open chats
        const restoreChats = async () => {
          for (const convId of storedIds) {
            // Check if conversation still exists
            if (conversations.some(c => c.id === convId)) {
              try {
                await handleOpenChat(convId);
              } catch (e) {
                console.warn('Failed to restore chat:', convId, e);
              }
            }
          }
          
          // Restore active tab after all chats are restored
          if (storedActiveTabId && storedIds.includes(storedActiveTabId)) {
            // Wait a bit for chats to be fully loaded
            setTimeout(() => {
              switchToChat(storedActiveTabId);
            }, 100);
          }
        };
        restoreChats();
      } else {
        // No stored chats - open first conversation
        const firstConversation = conversations[0];
        if (firstConversation) {
          handleOpenChat(firstConversation.id);
        }
      }
    }
  }, [conversations, openChats.length, isLoading, getStoredConversationIds, getStoredActiveTabId, switchToChat, handleOpenChat]);

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
          await loadConversations();
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
      
      // 5. Оновлюємо список conversations
      setConversations(prev => prev.map(conv => 
        conv.id === activeTabId 
          ? { ...conv, client_id: clientId, client_name: newClient.full_name }
          : conv
      ));
      
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
      
      // Оновлюємо conversation в списку, якщо він прив'язаний
      if (result.conversation_linked) {
        setConversations(prev => prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, client_id: client.id, client_name: client.full_name }
            : conv
        ));
        
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
      
      // Оновлюємо conversation в списку, якщо він прив'язаний
      if (result.conversation_linked) {
        setConversations(prev => prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, client_id: client.id, client_name: client.full_name }
            : conv
        ));
        
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
    if (!orders || orders.length === 0) {
      toast.error('Немає замовлень для відправки оплати');
      return;
    }
    
    // Use first order
    const orderId = orders[0]?.id;
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
      
      // Auto-send payment link in chat
      await handleSendMessage(conversationId, `💳 Посилання для оплати${amount ? ` ${amount} zł` : ''}:\n${payment_link}`);
      
      toast.success('Посилання на оплату відправлено');
    } catch (error) {
      console.error('Error creating payment link:', error);
      toast.error('Помилка створення посилання на оплату');
    }
  };

  const handleTrackingClick = async (conversationId: string) => {
    if (!orders || orders.length === 0) {
      toast.error('Немає замовлень для відправки трекінгу');
      return;
    }
    
    // Use first order
    const orderId = orders[0]?.id;
    if (!orderId) {
      toast.error('Немає замовлень для відправки трекінгу');
      return;
    }

    try {
      const tracking = await inboxApi.getTracking(orderId);
      
      if (tracking.number && tracking.trackingUrl) {
        // Auto-send tracking info in chat
        await handleSendMessage(conversationId, `📦 Twoje zlecenie zostało wysłane!\n\nNumer śledzenia: ${tracking.number}\nŚledź: ${tracking.trackingUrl}`);
        toast.success('Трекінг номер відправлено');
      } else {
        toast.error('Трекінг номер ще не створений');
      }
    } catch (error) {
      console.error('Error getting tracking:', error);
      toast.error('Помилка отримання трекінг номера');
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

  const handleOrderClick = (conversationId: string) => {
    if (orders && orders.length > 0) {
      // Navigate to order page
      const orderId = orders[0].id;
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

  const handleDocumentsClick = (conversationId: string) => {
    handleDownloadAllFiles();
  };

  // Формуємо динамічні таби з disabled станом
  const inboxTabs = useMemo<SideTab[]>(() => {
    const conversationId = activeTabId || '';
    const hasClient = !!client;
    const hasOrders = orders.length > 0;

    return INBOX_SIDE_TABS.map(tab => {
      let disabled = false;

      switch (tab.id) {
        case 'create-client':
          disabled = !activeTabId;
          break;
        case 'view-client':
          disabled = !client?.id;
          break;
        case 'order':
          disabled = !activeTabId || !hasClient;
          break;
        case 'tracking':
        case 'payment':
          disabled = !activeTabId || !hasOrders;
          break;
        case 'notes':
        case 'files':
          disabled = !activeTabId;
          break;
      }

      // Приховуємо create-client або view-client залежно від наявності клієнта
      if (tab.id === 'create-client' && hasClient) {
        return null;
      }
      if (tab.id === 'view-client' && !hasClient) {
        return null;
      }

      return { ...tab, disabled };
    }).filter((tab): tab is SideTab => tab !== null);
  }, [activeTabId, client, orders]);

  // Обробник кліку на таб
  const handleTabChange = (tabId: string | null) => {
    if (!tabId) {
      setSidePanelTab(null);
      return;
    }

    const conversationId = activeTabId || '';

    // Обробка кліку на таб "sidebar"
    if (tabId === 'sidebar') {
      handleToggleSidebar();
      setSidePanelTab(null);
      return;
    }

    // Quick actions - виконують дію і закриваються
    if (tabId === 'create-client') {
      // Якщо клієнт вже існує - показуємо повідомлення
      if (client) {
        toast.info('Клієнт вже існує');
        setSidePanelTab(null);
        return;
      }
      if (conversationId) {
        handleClientClick(conversationId);
      } else {
        handleCreateClient();
      }
      setSidePanelTab(null);
      return;
    }

    if (tabId === 'view-client') {
      if (client?.id) {
        handleViewClientProfile(client.id);
      }
      setSidePanelTab(null);
      return;
    }

    if (tabId === 'order') {
      if (conversationId) {
        handleOrderClick(conversationId);
      } else {
        handleCreateOrder();
      }
      setSidePanelTab(null);
      return;
    }

    if (tabId === 'tracking') {
      if (conversationId) {
        handleTrackingClick(conversationId);
      }
      setSidePanelTab(null);
      return;
    }

    if (tabId === 'payment') {
      if (conversationId) {
        handlePaymentClick(conversationId);
      }
      setSidePanelTab(null);
      return;
    }

    // Для звичайних табів (notes, files) - переключаємо
    if (tabId === sidePanelTab) {
      setSidePanelTab(null);
    } else {
      setSidePanelTab(tabId);
    }
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
    <CommunicationsErrorBoundary>
      <CommunicationsLayout
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
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
        contextPanel={undefined}
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
        />
      </CommunicationsLayout>

      {/* Права частина: Бокова панель з табами */}
      {!isMobile && (
        <aside className="fixed right-0 top-0 w-[64px] border-l bg-white flex flex-col items-center py-4 h-screen z-[70]">
          <SideTabs
            tabs={inboxTabs}
            activeTab={sidePanelTab}
            onTabChange={handleTabChange}
            position="right"
          />
        </aside>
      )}

      {/* SidePanel - Бокова панель з контентом */}
      {!isMobile && activeTabId && sidePanelTab && (sidePanelTab === 'notes' || sidePanelTab === 'files') && (
        <SidePanel
          open={sidePanelTab !== null}
          onClose={() => setSidePanelTab(null)}
          title={INBOX_SIDE_TABS.find(t => t.id === sidePanelTab)?.label}
          width="md"
        >
          {sidePanelTab === 'notes' && activeTabId && (
            <InternalNotes
              entityType="chat"
              entityId={activeTabId}
            />
          )}
          {sidePanelTab === 'files' && activeChat?.messages && (
            <div className="grid grid-cols-2 gap-3">
              {activeChat.messages
                .flatMap((msg) => msg.attachments || [])
                .filter((att) => att && att.url)
                .map((attachment, idx) => (
                  <AttachmentPreview
                    key={attachment.id || idx}
                    attachment={attachment}
                    onDownload={() => {
                      if (attachment.url) {
                        window.open(attachment.url, '_blank');
                      }
                    }}
                  />
                ))}
              {activeChat.messages.flatMap((msg) => msg.attachments || []).filter((att) => att && att.url).length === 0 && (
                <div className="col-span-2 text-center text-gray-500 py-8">
                  <FolderOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Немає файлів</p>
                </div>
              )}
            </div>
          )}
        </SidePanel>
      )}

      {/* Smart Actions Dialogs */}
      {chatConversation && (
        <>
          <CreateClientDialog
            open={createClientDialogOpen}
            onOpenChange={setCreateClientDialogOpen}
            conversation={chatConversation}
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

      {/* Нотифікації */}
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
    </CommunicationsErrorBoundary>
  );
  }

