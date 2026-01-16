/**
 * Notification API client
 */
import { apiClient } from '@/lib/api/client';
import type { Notification, NotificationSettings, NotificationSettingsUpdate } from '../types';

export const notificationApi = {
  /**
   * Отримати нотифікації
   */
  async getNotifications(params?: {
    limit?: number;
    offset?: number;
    unread_only?: boolean;
  }): Promise<Notification[]> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.unread_only) searchParams.set('unread_only', 'true');

    const response = await apiClient.get<Notification[]>(
      `/notifications/?${searchParams.toString()}`
    );
    return response;
  },

  /**
   * Отримати кількість непрочитаних нотифікацій
   */
  async getUnreadCount(): Promise<{ count: number }> {
    return apiClient.get<{ count: number }>('/notifications/unread/count');
  },

  /**
   * Позначити нотифікацію як прочитану
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>(
      `/notifications/${notificationId}/read`
    );
  },

  /**
   * Позначити всі нотифікації як прочитані
   */
  async markAllAsRead(): Promise<{ success: boolean; count: number }> {
    return apiClient.post<{ success: boolean; count: number }>(
      '/notifications/read-all'
    );
  },

  /**
   * Отримати налаштування нотифікацій
   */
  async getSettings(): Promise<NotificationSettings> {
    return apiClient.get<NotificationSettings>('/notifications/settings');
  },

  /**
   * Оновити налаштування нотифікацій
   */
  async updateSettings(settings: NotificationSettingsUpdate): Promise<NotificationSettings> {
    return apiClient.put<NotificationSettings>(
      '/notifications/settings',
      settings
    );
  },
};

