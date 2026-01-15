/**
 * Inbox API - unified inbox endpoints
 */
import { apiFetch } from '../../../lib/api';

// Mock data для розробки
const USE_MOCK_DATA = true; // Змінити на false коли API буде готове

export interface ConversationListItem {
  id: string;
  platform: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
  external_id: string;
  subject?: string;
  client_id?: string;
  client_name?: string;
  unread_count: number;
  last_message?: string;
  last_message_at?: string;
  updated_at: string;
}

export interface InboxResponse {
  conversations: ConversationListItem[];
  total: number;
  unread_total: number;
}

export interface ConversationWithMessages {
  id: string;
  platform: string;
  external_id: string;
  subject?: string;
  client_id?: string;
  messages: Message[];
  unread_count: number;
  last_message?: Message;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'html' | 'file';
  content: string;
  status: 'queued' | 'sent' | 'read' | 'failed';
  attachments?: FileAttachment[];
  meta_data?: Record<string, any>;
  sent_at?: string;
  created_at: string;
}

export interface FileAttachment {
  id?: string;
  type: string;
  url?: string;
  filename?: string;
  mime_type?: string;
  size?: number;
  thumbnail_url?: string;
}

export interface InboxQueryParams {
  filter?: 'all' | 'new' | 'in_progress' | 'needs_reply' | 'archived';
  platform?: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
  search?: string;
  limit?: number;
  offset?: number;
}

// Mock data
const mockConversations: ConversationListItem[] = [
  {
    id: '1',
    platform: 'telegram',
    external_id: '+380931234567',
    subject: undefined,
    client_id: 'client-1',
    client_name: 'Олександр Петренко',
    unread_count: 2,
    last_message: 'Дякую за швидку відповідь!',
    last_message_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    platform: 'whatsapp',
    external_id: '+380501234567',
    subject: undefined,
    client_id: 'client-2',
    client_name: 'Марія Коваленко',
    unread_count: 0,
    last_message: 'Можна детальніше про меню?',
    last_message_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    platform: 'email',
    external_id: 'client@example.com',
    subject: 'Комерційна пропозиція',
    client_id: undefined,
    client_name: 'Володимир Сидоренко',
    unread_count: 1,
    last_message: 'Надішліть, будь ласка, комерційну пропозицію',
    last_message_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    platform: 'facebook',
    external_id: 'fb-123456',
    subject: undefined,
    client_id: 'client-4',
    client_name: 'Анна Мельник',
    unread_count: 0,
    last_message: 'Дякую!',
    last_message_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    platform: 'telegram',
    external_id: '+380671234567',
    subject: undefined,
    client_id: undefined,
    client_name: 'Іван Іваненко',
    unread_count: 5,
    last_message: 'Привіт! Цікавить банкетне меню',
    last_message_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
];

const mockMessages: Record<string, Message[]> = {
  '1': [
    {
      id: 'msg-1-1',
      conversation_id: '1',
      direction: 'inbound',
      type: 'text',
      content: 'Добрий день! Чи можна замовити кейтеринг на 50 осіб?',
      status: 'read',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      sent_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-1-2',
      conversation_id: '1',
      direction: 'outbound',
      type: 'text',
      content: 'Добрий день! Так, звичайно. Коли вам потрібно?',
      status: 'read',
      created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      sent_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-1-3',
      conversation_id: '1',
      direction: 'inbound',
      type: 'text',
      content: 'Наступного тижня, в п\'ятницю',
      status: 'read',
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      sent_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-1-4',
      conversation_id: '1',
      direction: 'outbound',
      type: 'text',
      content: 'Відмінно! Надішлю вам комерційну пропозицію за 5 хвилин.',
      status: 'read',
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      sent_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-1-5',
      conversation_id: '1',
      direction: 'inbound',
      type: 'text',
      content: 'Дякую за швидку відповідь!',
      status: 'sent',
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      sent_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  ],
  '2': [
    {
      id: 'msg-2-1',
      conversation_id: '2',
      direction: 'inbound',
      type: 'text',
      content: 'Привіт! Цікавить банкетне меню',
      status: 'read',
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      sent_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-2-2',
      conversation_id: '2',
      direction: 'outbound',
      type: 'text',
      content: 'Привіт! Надішлю вам меню зараз',
      status: 'read',
      created_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
      sent_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'msg-2-3',
      conversation_id: '2',
      direction: 'inbound',
      type: 'text',
      content: 'Можна детальніше про меню?',
      status: 'read',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ],
  '3': [
    {
      id: 'msg-3-1',
      conversation_id: '3',
      direction: 'inbound',
      type: 'html',
      content: 'Добрий день! Надішліть, будь ласка, комерційну пропозицію для корпоративного заходу на 100 осіб.',
      status: 'read',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      sent_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

export const inboxApi = {
  /**
   * Get unified inbox conversations
   */
  async getInbox(params?: InboxQueryParams): Promise<InboxResponse> {
    if (USE_MOCK_DATA) {
      console.log('[Inbox API] Using mock data, params:', params);
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      let filtered = [...mockConversations];
      
      // Apply filters
      if (params?.search) {
        const searchLower = params.search.toLowerCase();
        filtered = filtered.filter(conv => 
          conv.client_name?.toLowerCase().includes(searchLower) ||
          conv.last_message?.toLowerCase().includes(searchLower) ||
          conv.external_id.toLowerCase().includes(searchLower)
        );
      }
      
      if (params?.platform) {
        filtered = filtered.filter(conv => conv.platform === params.platform);
      }
      
      if (params?.filter === 'new') {
        filtered = filtered.filter(conv => conv.unread_count > 0);
      }
      
      const unreadTotal = filtered.reduce((sum, conv) => sum + conv.unread_count, 0);
      
      const result = {
        conversations: filtered,
        total: filtered.length,
        unread_total: unreadTotal,
      };
      
      console.log('[Inbox API] Returning mock conversations:', result);
      return result;
    }
    
    const queryParams = new URLSearchParams();
    if (params?.filter) queryParams.append('filter', params.filter);
    if (params?.platform) queryParams.append('platform', params.platform);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    return apiFetch<InboxResponse>(
      `/communications/inbox?${queryParams.toString()}`
    );
  },

  /**
   * Get conversation with messages
   */
  async getConversation(conversationId: string): Promise<ConversationWithMessages> {
    if (USE_MOCK_DATA) {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const conversation = mockConversations.find(c => c.id === conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      const messages = mockMessages[conversationId] || [];
      
      return {
        id: conversation.id,
        platform: conversation.platform,
        external_id: conversation.external_id,
        subject: conversation.subject,
        client_id: conversation.client_id,
        messages: messages,
        unread_count: conversation.unread_count,
        last_message: messages.length > 0 ? messages[messages.length - 1] : undefined,
      };
    }
    
    return apiFetch<ConversationWithMessages>(
      `/communications/conversations/${conversationId}`
    );
  },

  /**
   * Send message
   */
  async sendMessage(conversationId: string, content: string, attachments?: FileAttachment[]): Promise<Message> {
    if (USE_MOCK_DATA) {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newMessage: Message = {
        id: `msg-${conversationId}-${Date.now()}`,
        conversation_id: conversationId,
        direction: 'outbound',
        type: 'text',
        content,
        status: 'sent',
        attachments,
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
      };
      
      // Add to mock messages
      if (!mockMessages[conversationId]) {
        mockMessages[conversationId] = [];
      }
      mockMessages[conversationId].push(newMessage);
      
      // Update conversation last message
      const conversation = mockConversations.find(c => c.id === conversationId);
      if (conversation) {
        conversation.last_message = content;
        conversation.last_message_at = new Date().toISOString();
        conversation.updated_at = new Date().toISOString();
      }
      
      return newMessage;
    }
    
    return apiFetch<Message>(
      `/communications/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          content,
          attachments,
        }),
      }
    );
  },

  /**
   * Create client from conversation
   */
  async createClientFromConversation(conversationId: string, data?: {
    name?: string;
    phone?: string;
    email?: string;
    company_name?: string;
  }): Promise<{ client_id: string }> {
    if (USE_MOCK_DATA) {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const conversation = mockConversations.find(c => c.id === conversationId);
      if (conversation) {
        conversation.client_id = `client-${conversationId}`;
        conversation.client_name = data?.name || conversation.client_name || 'Новий клієнт';
      }
      
      return { client_id: `client-${conversationId}` };
    }
    
    return apiFetch<{ client_id: string }>(
      `/communications/conversations/${conversationId}/create-client`,
      {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }
    );
  },

  /**
   * Quick action
   */
  async quickAction(conversationId: string, action: string, data?: Record<string, any>): Promise<any> {
    if (USE_MOCK_DATA) {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Mock actions
      switch (action) {
        case 'download_files':
          return { status: 'success', files_downloaded: 0 };
        case 'create_order':
          return { status: 'success', order_id: `order-${Date.now()}` };
        case 'mark_important':
          return { status: 'success', important: true };
        default:
          return { status: 'success' };
      }
    }
    
    return apiFetch(
      `/communications/conversations/${conversationId}/quick-action`,
      {
        method: 'POST',
        body: JSON.stringify({ action, data }),
      }
    );
  },
};

