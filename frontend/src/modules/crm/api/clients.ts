import { apiFetch } from "../../../lib/api/client";

export interface Client {
  id: string;
  full_name: string;
  email?: string;
  phone: string;
  company_name?: string;
  source: "email" | "telegram" | "whatsapp" | "instagram" | "facebook" | "manual" | "office_visit";
  created_at: string;
  orders?: Order[];
}

export interface ClientCreate {
  full_name?: string;
  name?: string; // For backward compatibility
  email?: string;
  phone: string;
  source?: "email" | "telegram" | "whatsapp" | "instagram" | "facebook" | "manual" | "office_visit";
  conversation_id?: string;
  external_id?: string;
  platform?: string;
}

export interface TranslationRequest {
  id: number;
  order_id: string;
  translator_id: number;
  sent_via: string;
  sent_at: string;
  status: "pending" | "accepted" | "declined";
  response_at?: string;
  offered_rate: number;
  notes?: string;
  translator?: {
    id: number;
    name: string;
  };
}

export interface Transaction {
  id: number;
  order_id: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  description?: string;
  created_at: string;
}

export interface Order {
  id: string;
  client_id: string;
  manager_id: string;
  order_number: string;
  description?: string;
  status: "do_wykonania" | "do_poswiadczenia" | "do_wydania" | "ustne" | "closed";
  deadline?: string;
  file_url?: string;
  office_id?: number;
  // Мова та тип перекладу
  language?: string;
  translation_type?: string;
  payment_method?: string;
  // CSV поля
  price_netto?: number;
  price_brutto?: number;
  reference_code?: string;
  repertorium_number?: string;
  follow_up_date?: string;
  order_source?: string;
  created_at: string;
  updated_at: string;
  client?: Client;
  office?: Office;
  timeline_steps?: TimelineStep[];
  translation_requests?: TranslationRequest[];
  transactions?: Transaction[];
  payment_transactions?: PaymentTransaction[];
}

export interface PaymentTransaction {
  id: string;
  order_id: string;
  provider: 'stripe' | 'przelewy24';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  payment_method?: string;
  amount: number;
  currency: string;
  session_id: string;
  provider_transaction_id?: string;
  payment_url?: string;
  customer_email: string;
  customer_name?: string;
  description?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Office {
  id: number;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  working_hours: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

export interface TimelineStep {
  id: number;
  order_id: string;
  step_type: "client_created" | "order_created" | "payment_link_sent" | "payment_received" | "translator_assigned" | "translation_ready" | "issued_sent";
  completed: boolean;
  completed_at: string;
  completed_by_id?: string;
  metadata?: string;
  created_at: string;
}

export const clientsApi = {
  /**
   * Get list of clients
   */
  async getClients(params?: {
    skip?: number;
    limit?: number;
    source?: string;
  }): Promise<Client[]> {
    const queryParams = new URLSearchParams();
    if (params?.skip) queryParams.append("skip", params.skip.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.source) queryParams.append("source", params.source);
    
    return apiFetch<Client[]>(`/crm/clients?${queryParams.toString()}`);
  },

  /**
   * Get client by ID
   */
  async getClient(clientId: string): Promise<Client> {
    return apiFetch<Client>(`/crm/clients/${clientId}`);
  },

  /**
   * Create new client
   */
  async createClient(client: ClientCreate | any): Promise<Client> {
    // Support both 'name' and 'full_name' fields for backward compatibility
    const fullName = (client as any).full_name || (client as any).name;
    const trimmedFullName = fullName?.trim() || '';
    const trimmedPhone = client.phone?.trim() || '';
    
    // Validate required fields
    if (!trimmedFullName || !trimmedPhone) {
      throw new Error('full_name and phone are required');
    }
    
    // Filter out empty strings for optional fields
    const cleanedClient: any = {
      full_name: trimmedFullName,
      phone: trimmedPhone,
    };
    
    // Add email only if it's not empty
    if (client.email && client.email.trim()) {
      cleanedClient.email = client.email.trim();
    }
    
    // Validate and set source (must be one of: 'email', 'telegram', 'whatsapp', 'instagram', 'facebook', 'manual', 'office_visit')
    const validSources = ['email', 'telegram', 'whatsapp', 'instagram', 'facebook', 'manual', 'office_visit'];
    const sourceValue = client.source && validSources.includes(client.source) 
      ? client.source 
      : 'manual';
    cleanedClient.source = sourceValue;
    
    // Add conversation info for duplicate checking by external_id
    if (client.conversation_id) {
      cleanedClient.conversation_id = client.conversation_id;
    }
    if (client.external_id) {
      cleanedClient.external_id = client.external_id;
    }
    if (client.platform) {
      cleanedClient.platform = client.platform;
    }
    
    console.log('[API] Creating client with data:', cleanedClient);
    console.log('[API] Original client data:', client);
    
    return apiFetch<Client>("/crm/clients", {
      method: "POST",
      body: JSON.stringify(cleanedClient),
    });
  },

  /**
   * Update client
   */
  async updateClient(clientId: string, client: ClientCreate): Promise<Client> {
    return apiFetch<Client>(`/crm/clients/${clientId}`, {
      method: "PUT",
      body: JSON.stringify(client),
    });
  },

  /**
   * Delete client
   */
  async deleteClient(clientId: string): Promise<{ status: string; id: string }> {
    return apiFetch(`/crm/clients/${clientId}`, {
      method: "DELETE",
    });
  },

  /**
   * Search client by phone number
   */
  async searchByPhone(phone: string): Promise<{ found: boolean; client: Client | null }> {
    return apiFetch<{ found: boolean; client: Client | null }>(
      `/crm/clients/search-by-phone/${encodeURIComponent(phone)}`
    );
  },
};

