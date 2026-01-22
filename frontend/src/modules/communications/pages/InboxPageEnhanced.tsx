import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CommunicationsLayout } from '../components/CommunicationsLayout';
import { ConversationsSidebar, type FilterState, type Conversation } from '../components/ConversationsSidebar';
import { ChatTabsArea } from '../components/ChatTabsArea';
import { type Message } from '../components/ChatArea';
import { ContextPanel, type Client } from '../components/ContextPanel';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { DeadlineDialogContent } from '../components/SmartActions/DeadlineDialogContent';
import { NotificationToast, type NotificationData } from '../components/NotificationToast';
import { useNotifications } from '../hooks/useNotifications';
import { toast } from 'sonner';
import '../styles/animations.css';

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
      addNotification({
        id: message.id,
        conversationId,
        clientName: conv?.client_name || conv?.external_id || 'Невідомий',
        channel: (conv?.platform as 'telegram' | 'whatsapp' | 'instagram' | 'email') || 'telegram',
        message: message.content.substring(0, 100),
        timestamp: new Date(),
        onOpen: () => {
          // Open the conversation when clicking "Відповісти"
          handleOpenChat(conversationId);
        },
      });
    }
  }, [openChats, updateChatMessages, conversations, addNotification]);

  // WebSocket for real-time updates
  const { isConnected: wsConnected } = useMessagesWebSocket({
    userId: 'current-user', // TODO: Get actual user ID from auth context
    onNewMessage: handleWebSocketNewMessage,
    onConnect: () => {
      console.log('[WebSocket] Connected to real-time messages');
    },
    onDisconnect: () => {
      console.log('[WebSocket] Disconnected from real-time messages');
    },
  });

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, [filters]);

  // Відновити раніше відкриті чати з localStorage
  useEffect(() => {
    if (conversations && conversations.length > 0 && openChats.length === 0 && !isLoading) {
      const storedIds = getStoredConversationIds();
      
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
        };
        restoreChats();
      } else {
        // No stored chats - open first conversation
        const firstConversation = conversations[0];
        handleOpenChat(firstConversation.id);
      }
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

  const handleOpenChat = async (conversationId: string) => {
    // Перевірити чи вже відкритий
    const existingChat = openChats.find(chat => chat.conversationId === conversationId);
    
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
    // TODO: Navigate to client profile
    toast.info('Перехід до профілю клієнта');
  };

  const handleSearch = (query: string) => {
    setFilters((prev) => ({ ...prev, search: query }));
  };

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
      // TODO: Navigate to order
      toast.info('Przejście do zlecenia');
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

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      console.log('Toggle sidebar state:', prev, '->', !prev);
      return !prev;
    });
  };

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
              onCreateOrder={handleCreateOrder}
              onSendPaymentLink={handleSendPaymentLink}
              onSendTrackingStatus={handleSendTrackingStatus}
              onAddInternalNote={handleAddInternalNote}
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
        />
      </CommunicationsLayout>

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

