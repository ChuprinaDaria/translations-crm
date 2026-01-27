import { apiFetch } from '../../../lib/api/client';

export interface WorkingHours {
  start: string | null;  // HH:MM format
  end: string | null;
  is_working_day: boolean;
}

export interface AutobotSettings {
  id: number;
  office_id: number;
  enabled: boolean;
  monday: WorkingHours | null;
  tuesday: WorkingHours | null;
  wednesday: WorkingHours | null;
  thursday: WorkingHours | null;
  friday: WorkingHours | null;
  saturday: WorkingHours | null;
  sunday: WorkingHours | null;
  auto_reply_message: string;
  auto_create_client: boolean;
  auto_create_order: boolean;
  auto_save_files: boolean;
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: number;
  settings_id: number;
  date: string;  // YYYY-MM-DD
  name: string;
  is_recurring: boolean;
  created_at: string;
}

export interface AutobotStatus {
  is_working_hours: boolean;
  current_time: string;
  next_working_period: string | null;
  message: string;
}

export const autobotApi = {
  /**
   * Отримати налаштування
   */
  async getSettings(officeId: number): Promise<AutobotSettings> {
    return apiFetch<AutobotSettings>(`/api/v1/autobot/settings/${officeId}`);
  },

  /**
   * Створити налаштування
   */
  async createSettings(settings: Partial<AutobotSettings>): Promise<AutobotSettings> {
    return apiFetch<AutobotSettings>('/api/v1/autobot/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  /**
   * Оновити налаштування
   */
  async updateSettings(
    officeId: number,
    settings: Partial<AutobotSettings>
  ): Promise<AutobotSettings> {
    return apiFetch<AutobotSettings>(`/api/v1/autobot/settings/${officeId}`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  },

  /**
   * Отримати статус бота
   */
  async getStatus(officeId: number): Promise<AutobotStatus> {
    return apiFetch<AutobotStatus>(`/api/v1/autobot/status/${officeId}`);
  },

  /**
   * Додати свято
   */
  async addHoliday(
    settingsId: number,
    holiday: Omit<Holiday, 'id' | 'settings_id' | 'created_at'>
  ): Promise<Holiday> {
    return apiFetch<Holiday>(`/api/v1/autobot/holidays?settings_id=${settingsId}`, {
      method: 'POST',
      body: JSON.stringify(holiday),
    });
  },

  /**
   * Видалити свято
   */
  async deleteHoliday(holidayId: number): Promise<void> {
    await apiFetch(`/api/v1/autobot/holidays/${holidayId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Отримати свята
   */
  async getHolidays(settingsId: number): Promise<Holiday[]> {
    return apiFetch<Holiday[]>(`/api/v1/autobot/holidays/${settingsId}`);
  },
};

