/**
 * Inbox API - unified inbox endpoints
 */
import { apiFetch } from '../../../lib/api';
import { getToken } from '../../../lib/api/token';

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
  assigned_manager_id?: string;
  needs_attention?: boolean; // True якщо менеджер не відповідав 10+ хвилин
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

export const inboxApi = {
  /**
   * Get unified inbox conversations
   */
  async getInbox(params?: InboxQueryParams): Promise<InboxResponse> {
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
    return apiFetch<ConversationWithMessages>(
      `/communications/conversations/${conversationId}`
    );
  },

  /**
   * Send message
   */
  async sendMessage(conversationId: string, content: string, attachments?: FileAttachment[]): Promise<Message> {
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
   * Mark conversation as read
   */
  async markConversationRead(conversationId: string): Promise<void> {
    return apiFetch(
      `/communications/conversations/${conversationId}/mark-read`,
      { method: 'POST' }
    );
  },

  /**
   * Assign current user as manager to conversation
   */
  async assignManager(conversationId: string): Promise<{ status: string; assigned_manager_id: string; assigned: boolean }> {
    return apiFetch(
      `/communications/conversations/${conversationId}/assign-manager`,
      { method: 'POST' }
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
    return apiFetch<{ client_id: string }>(
      `/communications/conversations/${conversationId}/create-client`,
      {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }
    );
  },

  /**
   * Link existing client to conversation
   */
  async linkClientToConversation(conversationId: string, clientId: string): Promise<{ client_id: string; status: string }> {
    return apiFetch(`/communications/conversations/${conversationId}/link-client/${clientId}`, {
      method: 'POST',
    });
  },

  /**
   * Quick action
   */
  async quickAction(conversationId: string, action: string, data?: Record<string, any>): Promise<any> {
    return apiFetch(
      `/communications/conversations/${conversationId}/quick-action`,
      {
        method: 'POST',
        body: JSON.stringify({ action, data }),
      }
    );
  },

  /**
   * Upload file attachment
   */
  async uploadFile(file: File): Promise<FileAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = getToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch('/api/v1/communications/upload', {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Upload failed');
    }
    
    return response.json();
  },

  /**
   * Create payment link for order
   */
  async createPaymentLink(orderId: string, amount?: number, currency: string = 'pln'): Promise<{ payment_link: string; order_id: string; amount: number; currency: string }> {
    return apiFetch(`/communications/orders/${orderId}/payment-link`, {
      method: 'POST',
      body: JSON.stringify({ amount, currency }),
    });
  },

  /**
   * Get tracking number for order
   */
  async getTracking(orderId: string): Promise<{ number: string | null; trackingUrl: string | null; order_id: string }> {
    return apiFetch(`/communications/orders/${orderId}/tracking`);
  },

  /**
   * Update client contact info
   */
  async updateClientContact(clientId: string, data: { email?: string; phone?: string; conversation_id?: string }): Promise<{ client_id: string; email?: string; phone?: string; conversation_linked?: boolean }> {
    return apiFetch(`/communications/clients/${clientId}/update-contact`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Add file to order
   */
  async addFileToOrder(orderId: string, fileUrl: string, fileName: string): Promise<{ order_id: string; file_url: string; message: string }> {
    return apiFetch(`/communications/orders/${orderId}/add-file`, {
      method: 'POST',
      body: JSON.stringify({ file_url: fileUrl, file_name: fileName }),
    });
  },

  /**
   * Add address or paczkomat to order
   */
  async addAddressToOrder(orderId: string, address: string, isPaczkomat: boolean, paczkomatCode?: string): Promise<{ order_id: string; message: string }> {
    return apiFetch(`/communications/orders/${orderId}/add-address`, {
      method: 'POST',
      body: JSON.stringify({ 
        address, 
        is_paczkomat: isPaczkomat, 
        paczkomat_code: paczkomatCode 
      }),
    });
  },
};
