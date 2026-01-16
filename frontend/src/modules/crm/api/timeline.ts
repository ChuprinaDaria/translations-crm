/**
 * Timeline API
 */
import { apiFetch } from '../../../lib/api/client';

export interface TimelineStep {
  id: number;
  order_id: string;
  step_type: 'client_created' | 'order_created' | 'payment_link_sent' | 'payment_received' | 'translator_assigned' | 'translation_ready' | 'issued_sent';
  completed: boolean;
  completed_at: string;
  completed_by_id?: string;
  metadata?: string;
  created_at: string;
}

export const timelineApi = {
  /**
   * Get timeline steps for an order
   */
  async getTimeline(orderId: string): Promise<TimelineStep[]> {
    return apiFetch<TimelineStep[]>(`/crm/orders/${orderId}/timeline`);
  },

  /**
   * Mark translation as ready (step 6)
   */
  async markTranslationReady(orderId: string): Promise<TimelineStep> {
    return apiFetch<TimelineStep>(`/crm/orders/${orderId}/timeline/mark-ready`, {
      method: 'POST',
    });
  },

  /**
   * Mark order as issued/sent (step 7)
   */
  async markOrderIssued(orderId: string, trackingNumber?: string): Promise<TimelineStep> {
    const params = trackingNumber ? `?tracking_number=${encodeURIComponent(trackingNumber)}` : '';
    return apiFetch<TimelineStep>(`/crm/orders/${orderId}/timeline/mark-issued${params}`, {
      method: 'POST',
    });
  },

  /**
   * Mark payment link as sent (step 3)
   */
  async markPaymentLinkSent(orderId: string, paymentLink: string): Promise<TimelineStep> {
    return apiFetch<TimelineStep>(`/crm/orders/${orderId}/timeline/mark-payment-link-sent`, {
      method: 'POST',
      body: JSON.stringify({ payment_link: paymentLink }),
    });
  },

  /**
   * Mark translator as assigned (step 5)
   */
  async markTranslatorAssigned(orderId: string, translatorId: string): Promise<TimelineStep> {
    return apiFetch<TimelineStep>(`/crm/orders/${orderId}/timeline/mark-translator-assigned`, {
      method: 'POST',
      body: JSON.stringify({ translator_id: translatorId }),
    });
  },

  /**
   * Mark payment as received (step 4)
   */
  async markPaymentReceived(orderId: string, transactionId?: string): Promise<TimelineStep> {
    return apiFetch<TimelineStep>(`/crm/orders/${orderId}/timeline/mark-payment-received`, {
      method: 'POST',
      body: JSON.stringify({ transaction_id: transactionId }),
    });
  },
};

