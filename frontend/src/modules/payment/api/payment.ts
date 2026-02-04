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

const BASE_URL = '/api/v1/payment';

// Settings
export const paymentApi = {
  // Settings
  getSettings: async (): Promise<PaymentSettings> => {
    const response = await apiClient.get(`${BASE_URL}/settings`);
    return response.data;
  },

  updateSettings: async (data: PaymentSettingsUpdate): Promise<PaymentSettings> => {
    const response = await apiClient.put(`${BASE_URL}/settings`, data);
    return response.data;
  },

  testConnection: async (provider: PaymentProvider): Promise<{ success: boolean; provider: string; error?: string }> => {
    const response = await apiClient.post(`${BASE_URL}/settings/test-connection`, null, {
      params: { provider },
    });
    return response.data;
  },

  // Payment methods
  getAvailableMethods: async (): Promise<PaymentMethodsResponse> => {
    const response = await apiClient.get(`${BASE_URL}/methods`);
    return response.data;
  },

  // Transactions
  createTransaction: async (data: CreatePaymentTransactionRequest): Promise<PaymentTransaction> => {
    const response = await apiClient.post(`${BASE_URL}/transactions`, data);
    return response.data;
  },

  getTransactions: async (params?: {
    order_id?: string;
    status?: PaymentStatus;
    provider?: PaymentProvider;
    skip?: number;
    limit?: number;
  }): Promise<PaymentTransaction[]> => {
    const response = await apiClient.get(`${BASE_URL}/transactions`, { params });
    return response.data;
  },

  getTransaction: async (transactionId: string): Promise<PaymentTransaction> => {
    const response = await apiClient.get(`${BASE_URL}/transactions/${transactionId}`);
    return response.data;
  },

  // Payment links
  createPaymentLink: async (data: CreatePaymentLinkRequest): Promise<PaymentLink> => {
    const response = await apiClient.post(`${BASE_URL}/links`, data);
    return response.data;
  },

  getPaymentLinks: async (params?: {
    order_id?: string;
    is_used?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<PaymentLink[]> => {
    const response = await apiClient.get(`${BASE_URL}/links`, { params });
    return response.data;
  },

  // Statistics
  getStats: async (params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<PaymentStats> => {
    const response = await apiClient.get(`${BASE_URL}/stats`, { params });
    return response.data;
  },
};

export default paymentApi;

