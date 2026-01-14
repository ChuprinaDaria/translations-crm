// API Configuration

// Base URL for API requests - versioned endpoint
export const API_BASE_URL = '/api/v1';

// Helper function to get full URL for uploaded images
export function getImageUrl(imagePath?: string | null): string | undefined {
  if (!imagePath) return undefined;
  
  // Якщо це вже повний URL, повертаємо як є
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Якщо це відносний шлях, додаємо базовий URL
  return `${API_BASE_URL}/${imagePath}`;
}

// Query Keys Factory Pattern for TanStack Query
// This ensures easy cache invalidation and type safety

export const queryKeys = {
  // Communications module
  communications: {
    all: ['communications'] as const,
    conversations: () => [...queryKeys.communications.all, 'conversations'] as const,
    conversation: (id: string) => [...queryKeys.communications.conversations(), id] as const,
    messages: (conversationId: string) => [...queryKeys.communications.conversation(conversationId), 'messages'] as const,
    message: (conversationId: string, messageId: string) => [...queryKeys.communications.messages(conversationId), messageId] as const,
  },
  
  // CRM module
  crm: {
    all: ['crm'] as const,
    orders: () => [...queryKeys.crm.all, 'orders'] as const,
    order: (id: string | number) => [...queryKeys.crm.orders(), id] as const,
    orderByStatus: (status: string) => [...queryKeys.crm.orders(), 'status', status] as const,
    clients: () => [...queryKeys.crm.all, 'clients'] as const,
    client: (id: number) => [...queryKeys.crm.clients(), id] as const,
    kanban: () => [...queryKeys.crm.all, 'kanban'] as const,
  },
  
  // Finance module
  finance: {
    all: ['finance'] as const,
    transactions: () => [...queryKeys.finance.all, 'transactions'] as const,
    transaction: (id: string | number) => [...queryKeys.finance.transactions(), id] as const,
    invoices: () => [...queryKeys.finance.all, 'invoices'] as const,
    invoice: (id: string | number) => [...queryKeys.finance.invoices(), id] as const,
    payments: () => [...queryKeys.finance.all, 'payments'] as const,
    payment: (id: string | number) => [...queryKeys.finance.payments(), id] as const,
  },
  
  // Analytics module
  analytics: {
    all: ['analytics'] as const,
    dashboard: () => [...queryKeys.analytics.all, 'dashboard'] as const,
    metrics: () => [...queryKeys.analytics.all, 'metrics'] as const,
    reports: () => [...queryKeys.analytics.all, 'reports'] as const,
    report: (id: string | number) => [...queryKeys.analytics.reports(), id] as const,
  },
  
  // Legacy/Shared
  auth: {
    all: ['auth'] as const,
    user: () => [...queryKeys.auth.all, 'user'] as const,
    users: () => [...queryKeys.auth.all, 'users'] as const,
  },
  
  items: {
    all: ['items'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.items.all, 'list', filters] as const,
    item: (id: number) => [...queryKeys.items.all, id] as const,
    categories: () => [...queryKeys.items.all, 'categories'] as const,
  },
  
  kp: {
    all: ['kp'] as const,
    list: () => [...queryKeys.kp.all, 'list'] as const,
    kp: (id: number) => [...queryKeys.kp.all, id] as const,
    templates: () => [...queryKeys.kp.all, 'templates'] as const,
  },
} as const;

