import { apiFetch } from "../../../lib/api/client";
import type { Order, TimelineStep } from "./clients";

export interface OrderCreate {
  client_id: string;
  manager_id: string;
  order_number: string;
  description?: string;
  status?: "do_wykonania" | "do_poswiadczenia" | "do_wydania" | "ustne" | "closed";
  deadline?: string;
  file_url?: string;
  office_id?: number;
}

export interface OrderUpdate {
  client_id?: string;
  manager_id?: string;
  order_number?: string;
  description?: string;
  status?: "do_wykonania" | "do_poswiadczenia" | "do_wydania" | "ustne" | "closed";
  deadline?: string;
  file_url?: string;
}

export const ordersApi = {
  /**
   * Get list of orders
   */
  async getOrders(params?: {
    status?: string;
    client_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<Order[]> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append("status", params.status);
    if (params?.client_id) queryParams.append("client_id", params.client_id);
    if (params?.skip) queryParams.append("skip", params.skip.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    
    return apiFetch<Order[]>(`/crm/orders?${queryParams.toString()}`);
  },

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order> {
    return apiFetch<Order>(`/crm/orders/${orderId}`);
  },

  /**
   * Create new order
   */
  async createOrder(order: OrderCreate): Promise<Order> {
    return apiFetch<Order>("/crm/orders", {
      method: "POST",
      body: JSON.stringify(order),
    });
  },

  /**
   * Update order (PATCH)
   */
  async updateOrder(orderId: string, order: OrderUpdate): Promise<Order> {
    return apiFetch<Order>(`/crm/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify(order),
    });
  },

  /**
   * Get order timeline
   */
  async getTimeline(orderId: string): Promise<TimelineStep[]> {
    return apiFetch<TimelineStep[]>(`/crm/orders/${orderId}/timeline`);
  },

  /**
   * Mark translation as ready (step 6)
   */
  async markTranslationReady(orderId: string): Promise<TimelineStep> {
    return apiFetch<TimelineStep>(`/crm/orders/${orderId}/timeline/mark-ready`, {
      method: "POST",
    });
  },

  /**
   * Mark order as issued/sent (step 7)
   */
  async markOrderIssued(orderId: string, trackingNumber?: string): Promise<TimelineStep> {
    return apiFetch<TimelineStep>(`/crm/orders/${orderId}/timeline/mark-issued`, {
      method: "POST",
      body: trackingNumber ? JSON.stringify({ tracking_number: trackingNumber }) : undefined,
    });
  },

  /**
   * Mark payment link sent (step 3)
   */
  async markPaymentLinkSent(orderId: string, paymentLink: string): Promise<TimelineStep> {
    return apiFetch<TimelineStep>(`/crm/orders/${orderId}/timeline/mark-payment-link-sent`, {
      method: "POST",
      body: JSON.stringify({ payment_link: paymentLink }),
    });
  },

  /**
   * Mark payment received (step 4)
   */
  async markPaymentReceived(orderId: string, transactionId?: string): Promise<TimelineStep> {
    return apiFetch<TimelineStep>(`/crm/orders/${orderId}/timeline/mark-payment-received`, {
      method: "POST",
      body: transactionId ? JSON.stringify({ transaction_id: transactionId }) : undefined,
    });
  },

  /**
   * Mark translator assigned (step 5)
   */
  async markTranslatorAssigned(orderId: string, translatorId: string): Promise<TimelineStep> {
    return apiFetch<TimelineStep>(`/crm/orders/${orderId}/timeline/mark-translator-assigned`, {
      method: "POST",
      body: JSON.stringify({ translator_id: translatorId }),
    });
  },
};

