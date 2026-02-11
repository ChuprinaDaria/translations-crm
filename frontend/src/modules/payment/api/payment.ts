/**
 * Payment API client
 */
import { apiClient } from '@/lib/api/client';
import {
  PaymentSettings,
  PaymentSettingsUpdate,
  PaymentTransaction,
  CreatePaymentTransactionRequest,
  PaymentLink,
  CreatePaymentLinkRequest,
  PaymentMethodsResponse,
  PaymentStats,
  PaymentProvider,
  PaymentStatus,
} from './types';

const BASE_URL = '/payment';

// Settings
export const paymentApi = {
  // Settings
  getSettings: async (): Promise<PaymentSettings> => {
    return await apiClient.get<PaymentSettings>(`${BASE_URL}/settings`);
  },

  updateSettings: async (data: PaymentSettingsUpdate): Promise<PaymentSettings> => {
    return await apiClient.put<PaymentSettings>(`${BASE_URL}/settings`, data);
  },

  testConnection: async (provider: PaymentProvider): Promise<{ success: boolean; provider: string; error?: string }> => {
    const params = new URLSearchParams({ provider });
    return await apiClient.post<{ success: boolean; provider: string; error?: string }>(
      `${BASE_URL}/settings/test-connection?${params.toString()}`,
      null
    );
  },

  // Payment methods
  getAvailableMethods: async (): Promise<PaymentMethodsResponse> => {
    return await apiClient.get<PaymentMethodsResponse>(`${BASE_URL}/methods`);
  },

  // Transactions
  createTransaction: async (data: CreatePaymentTransactionRequest): Promise<PaymentTransaction> => {
    return await apiClient.post<PaymentTransaction>(`${BASE_URL}/transactions`, data);
  },

  getTransactions: async (params?: {
    order_id?: string;
    status?: PaymentStatus;
    provider?: PaymentProvider;
    skip?: number;
    limit?: number;
  }): Promise<PaymentTransaction[]> => {
    const queryParams = new URLSearchParams();
    if (params) {
      if (params.order_id) queryParams.append('order_id', params.order_id);
      if (params.status) queryParams.append('status', params.status);
      if (params.provider) queryParams.append('provider', params.provider);
      if (params.skip !== undefined) queryParams.append('skip', params.skip.toString());
      if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
    }
    const queryString = queryParams.toString();
    const url = queryString ? `${BASE_URL}/transactions?${queryString}` : `${BASE_URL}/transactions`;
    return await apiClient.get<PaymentTransaction[]>(url);
  },

  getTransaction: async (transactionId: string): Promise<PaymentTransaction> => {
    return await apiClient.get<PaymentTransaction>(`${BASE_URL}/transactions/${transactionId}`);
  },

  // Payment links
  createPaymentLink: async (data: CreatePaymentLinkRequest): Promise<PaymentLink> => {
    return await apiClient.post<PaymentLink>(`${BASE_URL}/links`, data);
  },

  getPaymentLinks: async (params?: {
    order_id?: string;
    is_used?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<PaymentLink[]> => {
    const queryParams = new URLSearchParams();
    if (params) {
      if (params.order_id) queryParams.append('order_id', params.order_id);
      if (params.is_used !== undefined) queryParams.append('is_used', params.is_used.toString());
      if (params.skip !== undefined) queryParams.append('skip', params.skip.toString());
      if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
    }
    const queryString = queryParams.toString();
    const url = queryString ? `${BASE_URL}/links?${queryString}` : `${BASE_URL}/links`;
    return await apiClient.get<PaymentLink[]>(url);
  },

  // Statistics
  getStats: async (params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<PaymentStats> => {
    const queryParams = new URLSearchParams();
    if (params) {
      if (params.start_date) queryParams.append('start_date', params.start_date);
      if (params.end_date) queryParams.append('end_date', params.end_date);
    }
    const queryString = queryParams.toString();
    const url = queryString ? `${BASE_URL}/stats?${queryString}` : `${BASE_URL}/stats`;
    return await apiClient.get<PaymentStats>(url);
  },
};

export default paymentApi;

