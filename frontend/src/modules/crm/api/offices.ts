/**
 * Offices API
 */
import { apiFetch } from '../../../lib/api/client';

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

export interface OfficeCreate {
  name: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  working_hours: string;
  is_active?: boolean;
  is_default?: boolean;
}

export const officesApi = {
  /**
   * Get list of offices
   */
  async getOffices(params?: { is_active?: boolean }): Promise<Office[]> {
    const queryParams = new URLSearchParams();
    if (params?.is_active !== undefined) {
      queryParams.append('is_active', params.is_active.toString());
    }
    
    const query = queryParams.toString();
    return apiFetch<Office[]>(`/crm/offices${query ? `?${query}` : ''}`);
  },

  /**
   * Get office by ID
   */
  async getOffice(id: number): Promise<Office> {
    return apiFetch<Office>(`/crm/offices/${id}`);
  },

  /**
   * Get default office
   */
  async getDefaultOffice(): Promise<Office> {
    return apiFetch<Office>('/crm/offices/default');
  },

  /**
   * Create office
   */
  async createOffice(data: OfficeCreate): Promise<Office> {
    return apiFetch<Office>('/crm/offices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update office
   */
  async updateOffice(id: number, data: Partial<OfficeCreate>): Promise<Office> {
    return apiFetch<Office>(`/crm/offices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete office (soft delete)
   */
  async deleteOffice(id: number): Promise<void> {
    return apiFetch(`/crm/offices/${id}`, {
      method: 'DELETE',
    });
  },
};

