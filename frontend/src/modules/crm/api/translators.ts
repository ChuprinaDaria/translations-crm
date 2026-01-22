/**
 * Translators API
 */
import { apiFetch } from '../../../lib/api/client';

// Fallback if client doesn't exist
if (typeof apiFetch === 'undefined') {
  // Use default fetch if apiFetch is not available
  const apiFetch = async <T>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`/api/v1${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    return response.json();
  };
}

export interface TranslatorLanguage {
  id: number;
  translator_id: number;
  language: string;
  rate_per_page: number;
  specializations?: string[];
}

export interface Translator {
  id: number;
  name: string;
  email: string;
  phone: string;
  telegram_id?: string;
  whatsapp?: string;
  status: 'active' | 'inactive' | 'busy';
  rating: number;
  completed_orders: number;
  created_at: string;
  updated_at: string;
  languages: TranslatorLanguage[];
}

export interface TranslatorCreate {
  name: string;
  email: string;
  phone: string;
  telegram_id?: string;
  whatsapp?: string;
  status?: 'active' | 'inactive' | 'busy';
  languages: Array<{
    language: string;
    rate_per_page: number;
    specializations?: string[];
  }>;
}

export interface TranslationRequest {
  id: number;
  order_id: string;
  translator_id: number;
  sent_via: 'email' | 'telegram' | 'whatsapp';
  sent_at: string;
  status: 'pending' | 'accepted' | 'declined';
  response_at?: string;
  offered_rate: number;
  notes?: string;
  created_at: string;
  translator?: Translator;
}

export interface TranslationRequestCreate {
  order_id: string;
  translator_id: number;
  sent_via: 'email' | 'telegram' | 'whatsapp';
  offered_rate: number;
  notes?: string;
}

export const translatorsApi = {
  /**
   * Get list of translators
   */
  async getTranslators(params?: {
    status?: string;
    language?: string;
  }): Promise<Translator[]> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.language) queryParams.append('language', params.language);
    
    const query = queryParams.toString();
    return apiFetch<Translator[]>(`/crm/translators${query ? `?${query}` : ''}`);
  },

  /**
   * Get translator by ID
   */
  async getTranslator(id: number): Promise<Translator> {
    return apiFetch<Translator>(`/crm/translators/${id}`);
  },

  /**
   * Create translator
   */
  async createTranslator(data: TranslatorCreate): Promise<Translator> {
    return apiFetch<Translator>('/crm/translators', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update translator
   */
  async updateTranslator(id: number, data: Partial<TranslatorCreate>): Promise<Translator> {
    return apiFetch<Translator>(`/crm/translators/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete translator
   */
  async deleteTranslator(id: number): Promise<void> {
    return apiFetch(`/crm/translators/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Create translation request
   */
  async createTranslationRequest(data: TranslationRequestCreate): Promise<TranslationRequest> {
    return apiFetch<TranslationRequest>('/crm/translation-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Accept translation request
   */
  async acceptTranslationRequest(requestId: number): Promise<TranslationRequest> {
    return apiFetch<TranslationRequest>(`/crm/translation-requests/${requestId}/accept`, {
      method: 'POST',
    });
  },

  /**
   * Decline translation request
   */
  async declineTranslationRequest(requestId: number, notes?: string): Promise<TranslationRequest> {
    return apiFetch<TranslationRequest>(`/crm/translation-requests/${requestId}/decline`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  /**
   * Get translation requests for an order
   */
  async getOrderTranslationRequests(orderId: string): Promise<TranslationRequest[]> {
    return apiFetch<TranslationRequest[]>(`/crm/orders/${orderId}/translation-requests`);
  },

  /**
   * Update translation request
   */
  async updateTranslationRequest(
    requestId: number,
    data: { offered_rate?: number; notes?: string; status?: 'pending' | 'accepted' | 'declined' }
  ): Promise<TranslationRequest> {
    return apiFetch<TranslationRequest>(`/crm/translation-requests/${requestId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

