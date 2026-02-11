/**
 * Payment module type definitions
 */

export enum PaymentProvider {
  STRIPE = 'stripe',
  PRZELEWY24 = 'przelewy24',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum PaymentMethodType {
  // Stripe
  CARD = 'card',
  SEPA = 'sepa',
  // Przelewy24
  P24_TRANSFER = 'p24_transfer',
  P24_CARD = 'p24_card',
  P24_BLIK = 'p24_blik',
  P24_APPLE_PAY = 'p24_apple_pay',
  P24_GOOGLE_PAY = 'p24_google_pay',
  P24_PAYPO = 'p24_paypo',
  P24_INSTALLMENTS = 'p24_installments',
}

// Settings
export interface PaymentSettings {
  id: string;
  // Stripe
  stripe_enabled: boolean;
  stripe_public_key?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  // Przelewy24
  przelewy24_enabled: boolean;
  przelewy24_merchant_id?: number;
  przelewy24_pos_id?: number;
  przelewy24_crc?: string;
  przelewy24_api_key?: string;
  przelewy24_sandbox: boolean;
  // General
  default_currency: string;
  active_payment_provider?: PaymentProvider;  // Активна система оплати (stripe або przelewy24)
  created_at: string;
  updated_at: string;
}

export interface PaymentSettingsUpdate {
  // Stripe
  stripe_enabled?: boolean;
  stripe_public_key?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  // Przelewy24
  przelewy24_enabled?: boolean;
  przelewy24_merchant_id?: number;
  przelewy24_pos_id?: number;
  przelewy24_crc?: string;
  przelewy24_api_key?: string;
  przelewy24_sandbox?: boolean;
  // General
  default_currency?: string;
  active_payment_provider?: PaymentProvider;  // Активна система оплати (stripe або przelewy24)
}

// Transaction
export interface PaymentTransaction {
  id: string;
  order_id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  payment_method?: PaymentMethodType;
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

export interface CreatePaymentTransactionRequest {
  order_id: string;
  provider: PaymentProvider;
  amount: number;
  currency?: string;
  customer_email: string;
  customer_name?: string;
  description?: string;
  payment_method?: PaymentMethodType;
  return_url?: string;
}

// Payment Link
export interface PaymentLink {
  id: string;
  transaction_id: string;
  order_id: string;
  link_url: string;
  expires_at?: string;
  is_used: boolean;
  sent_by_user_id: string;
  sent_to_email: string;
  created_at: string;
  used_at?: string;
}

export interface CreatePaymentLinkRequest {
  order_id: string;
  provider: PaymentProvider;
  amount: number;
  currency?: string;
  customer_email: string;
  customer_name?: string;
  description?: string;
  expires_at?: string;
}

// Available methods
export interface PaymentMethodsResponse {
  stripe_enabled: boolean;
  przelewy24_enabled: boolean;
  available_methods: PaymentMethodType[];
  default_currency: string;
}

// Statistics
export interface PaymentStats {
  total_transactions: number;
  total_amount: number;
  successful_transactions: number;
  failed_transactions: number;
  pending_transactions: number;
  by_provider: Record<string, number>;
  by_status: Record<string, number>;
  period_start: string;
  period_end: string;
}

