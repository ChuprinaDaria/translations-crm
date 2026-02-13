import { apiFetch, API_BASE_URL, tokenManager } from '../../../lib/api';

export interface Payment {
  id: string;
  lp: number;
  order_number: string;
  service_date: string | null;
  buyer_name: string;
  amount_gross: number;
  payment_date: string | null;
  posting_date: string | null;
  payment_method: 'transfer' | 'card' | 'blik' | 'cash';
  receipt_number: string;
  notes: string | null;
  color?: string | null; // RGB колір для виділення рядка (наприклад, "rgb(255, 200, 100)")
  hidden_notes?: string | null; // Приховані примітки, які показуються при наведенні (legacy - рядок)
  hidden_notes_list?: Array<{ id: string; text: string; created_by: string; created_at: string }> | null; // Масив нотаток
  // Stripe fields
  stripe_payment_intent_id?: string | null;
  stripe_session_id?: string | null;
  stripe_customer_email?: string | null;
  currency?: string; // Default: PLN
  stripe_fee?: number | null; // Комісія Stripe
  net_amount?: number | null; // Нетто-сума після комісії
  card_brand?: string | null; // Visa, Mastercard, etc.
  card_last4?: string | null; // Останні 4 цифри картки
  stripe_receipt_url?: string | null; // URL receipt від Stripe
  payment_status?: 'pending' | 'succeeded' | 'failed' | 'refunded' | null; // Статус оплати
  stripe_payment_link_id?: string | null; // ID Stripe Payment Link
}

export interface PaymentsResponse {
  payments: Payment[];
}

export const financeApi = {
  /**
   * Отримати список платежів
   */
  async getPayments(): Promise<Payment[]> {
    const response = await apiFetch<PaymentsResponse>('/finance/payments');
    return response.payments;
  },

  /**
   * Експортувати платежі в Excel
   */
  async exportPaymentsToExcel(): Promise<Blob> {
    const token = tokenManager.getToken();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/finance/payments/export`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Failed to export payments');
      throw new Error(errorText || 'Failed to export payments');
    }

    return await response.blob();
  },

  /**
   * Форматування способу оплати для відображення
   */
  formatPaymentMethod(method: string): string {
    const methods: Record<string, string> = {
      'transfer': 'Przelew',
      'card': 'Karta',
      'blik': 'BLIK',
      'cash': 'Gotówka',
    };
    return methods[method] || method;
  },
};

