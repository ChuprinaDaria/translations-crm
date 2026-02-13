import { apiFetch } from '../../../lib/api/client';

export interface Shipment {
  id: string;
  order_id: string;
  order_number?: string;
  method: 'inpost_locker' | 'inpost_courier' | 'office_pickup' | 'courier';
  tracking_number: string | null;
  tracking_url: string | null;
  status: 'created' | 'label_printed' | 'in_transit' | 'ready_for_pickup' | 'delivered' | 'returned';
  paczkomat_code: string | null;
  delivery_address: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  shipping_cost: number | null;
  label_url: string | null;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  inpost_shipment_id: string | null;
}

export interface ShipmentsResponse {
  shipments: Shipment[];
}

export interface CreateShipmentRequest {
  order_id: string;
  method: 'inpost_locker' | 'inpost_courier' | 'office_pickup' | 'courier';
  tracking_number?: string;
  paczkomat_code?: string;
  delivery_address?: string;
  recipient_name?: string;
  recipient_email?: string;
  recipient_phone?: string;
  shipping_cost?: number;
  create_inpost_shipment?: boolean;
}

export interface UpdateShipmentRequest {
  tracking_number?: string;
  status?: 'created' | 'label_printed' | 'in_transit' | 'ready_for_pickup' | 'delivered' | 'returned';
  paczkomat_code?: string;
  delivery_address?: string;
  recipient_name?: string;
  recipient_email?: string;
  recipient_phone?: string;
  shipping_cost?: number;
  label_url?: string;
  shipped_at?: string;
  delivered_at?: string;
  inpost_shipment_id?: string;
}

export const shipmentsApi = {
  /**
   * Отримати список відправок
   */
  async getShipments(params?: {
    status?: string;
    method?: string;
    order_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<Shipment[]> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.method) queryParams.append('method', params.method);
    if (params?.order_id) queryParams.append('order_id', params.order_id);
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    return apiFetch<Shipment[]>(`/finance/shipments?${queryParams.toString()}`);
  },

  /**
   * Отримати деталі відправки
   */
  async getShipment(shipmentId: string): Promise<Shipment> {
    return apiFetch<Shipment>(`/finance/shipments/${shipmentId}`);
  },

  /**
   * Створити відправку
   */
  async createShipment(data: CreateShipmentRequest): Promise<Shipment> {
    return apiFetch<Shipment>('/finance/shipments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Оновити відправку
   */
  async updateShipment(shipmentId: string, data: UpdateShipmentRequest): Promise<Shipment> {
    return apiFetch<Shipment>(`/finance/shipments/${shipmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Оновити статус відправки з InPost API
   */
  async trackShipment(shipmentId: string): Promise<Shipment> {
    return apiFetch<Shipment>(`/finance/shipments/${shipmentId}/track`, {
      method: 'POST',
    });
  },
};

