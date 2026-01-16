/**
 * Constants for communications module
 */

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
export const DEBOUNCE_DELAY = 300; // ms
export const MESSAGE_POLL_INTERVAL = 5000; // ms
export const CONVERSATION_LIST_LIMIT = 50;
export const MESSAGE_LIST_LIMIT = 100;

export const PLATFORM_NAMES: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  email: 'Email',
  facebook: 'Facebook Messenger',
  instagram: 'Instagram',
};

export const MESSAGE_STATUS_LABELS: Record<string, string> = {
  queued: 'В черзі',
  sent: 'Відправлено',
  read: 'Прочитано',
  failed: 'Помилка',
};

