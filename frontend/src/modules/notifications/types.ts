/**
 * Types для нотифікацій
 */

export type NotificationType =
  | 'new_message'
  | 'payment_received'
  | 'translator_accepted'
  | 'translator_rejected'
  | 'translation_ready'
  | 'internal_note'
  | 'deadline_warning'
  | 'deadline_passed';

export type EntityType = 'order' | 'client' | 'chat' | 'message' | 'transaction';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type: EntityType | null;
  entity_id: string | null;
  action_url: string | null;
  data: Record<string, any> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  vibration: boolean;
  types_enabled: Record<NotificationType, boolean>;
  do_not_disturb: {
    weekdays: [string, string] | null; // ["22:00", "08:00"]
    weekend: 'all_day' | null;
  };
  created_at: string;
  updated_at: string;
}

export interface NotificationSettingsUpdate {
  enabled?: boolean;
  sound?: boolean;
  desktop?: boolean;
  vibration?: boolean;
  types_enabled?: Partial<Record<NotificationType, boolean>>;
  do_not_disturb?: {
    weekdays?: [string, string] | null;
    weekend?: 'all_day' | null;
  };
}

export interface WebSocketNotificationMessage {
  type: 'notification';
  data: {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    entity_type: EntityType | null;
    entity_id: string | null;
    action_url: string | null;
    data: Record<string, any> | null;
    created_at: string;
  };
}

