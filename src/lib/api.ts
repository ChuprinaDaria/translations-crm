// API Configuration and Helper Functions

// Use relative path /api - will be proxied by nginx in Docker
const API_BASE_URL = '/api';

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

// Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface RegisterResponse {
  email: string;
  id: number;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  otpauth_url?: string | null;
}

export interface LoginResponse {
  access_token?: string;
  token?: string;
  token_type?: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Subcategory {
  id: number;
  name: string;
  category_id: number;
  category?: Category;
}

export interface Item {
  id: number;
  name: string;
  description?: string;
  price: number;
  weight?: number;
  unit?: string;
  photo_url?: string;
  active: boolean;
  subcategory_id: number;
  subcategory?: Subcategory;
  created_at?: string;
}

export interface ItemCreate {
  name: string;
  description?: string;
  price?: number;
  weight?: number;
  unit?: string;
  photo_url?: string;
  active?: boolean;
  subcategory_id?: number;
  photo?: File; // Для завантаження файлу
}

// Users API types
export interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  department?: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at?: string;
}

export interface UserUpdate {
  first_name?: string;
  last_name?: string;
  role?: string;
  department?: string | null;
  is_active?: boolean;
  is_admin?: boolean;
}

// Clients types
export interface Client {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  status?: string;
  event_date?: string;
  event_format?: string;
  event_group?: string;
  event_time?: string;
  event_location?: string;
  comments?: string;
  kp_total_amount?: number;
  paid_amount?: number;
  unpaid_amount?: number;
  payment_format?: string;
  cash_collector?: string;
  payment_plan_date?: string;
  discount?: string;
  cashback?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ClientUpdate {
  name?: string;
  phone?: string;
  email?: string;
  status?: string;
  event_date?: string;
  event_format?: string;
  event_group?: string;
  event_time?: string;
  event_location?: string;
  comments?: string;
  kp_total_amount?: number;
  paid_amount?: number;
  unpaid_amount?: number;
  payment_format?: string;
  cash_collector?: string;
  payment_plan_date?: string;
  discount?: string;
  cashback?: number;
}

// Menus types
export interface MenuItemCreate {
  item_id: number;
  quantity: number;
}

export interface MenuItem {
  id: number;
  item_id: number;
  quantity: number;
  item?: Item;
}

export interface Menu {
  id: number;
  name: string;
  description?: string;
  event_format?: string;
  people_count?: number;
  created_at?: string;
  items: MenuItem[];
}

export interface MenuCreate {
  name: string;
  description?: string;
  event_format?: string;
  people_count?: number;
  items: MenuItemCreate[];
}

export interface MenuUpdate {
  name?: string;
  description?: string;
  event_format?: string;
  people_count?: number;
  items?: MenuItemCreate[];
}

// Error handling
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: any
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

// Token management
export const tokenManager = {
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  },

  setToken(token: string): void {
    console.log('Saving token to localStorage:', token?.substring(0, 20) + '...');
    localStorage.setItem('auth_token', token);
  },

  removeToken(): void {
    console.log('Removing token from localStorage');
    localStorage.removeItem('auth_token');
  },

  isAuthenticated(): boolean {
    const hasToken = !!this.getToken();
    console.log('Is authenticated:', hasToken);
    return hasToken;
  }
};

// Fetch wrapper with authentication
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = tokenManager.getToken();
  
  console.log(`[API] ${options.method || 'GET'} ${endpoint}`);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('[API] Authorization header added');
  } else {
    console.log('[API] No token available');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    mode: 'cors',
  });

  console.log(`[API] Response status: ${response.status}`);

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }
    console.error('[API] Error response:', errorData);
    throw new ApiError(response.status, response.statusText, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  // Get content type
  const contentType = response.headers.get('content-type');
  
  // Handle text/plain response
  if (contentType && contentType.includes('text/plain')) {
    const text = await response.text();
    console.log('[API] Plain text response received');
    return text as T;
  }

  // Handle JSON response (default)
  const jsonData = await response.json();
  console.log('[API] JSON response received');
  return jsonData;
}

// Fetch wrapper for multipart/form-data
async function apiFetchMultipart<T>(
  endpoint: string,
  formData: FormData,
  method: string = 'POST'
): Promise<T> {
  const token = tokenManager.getToken();
  
  console.log(`[API] ${method} ${endpoint} (multipart/form-data)`);
  
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('[API] Authorization header added');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: formData,
    mode: 'cors',
  });

  console.log(`[API] Response status: ${response.status}`);

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }
    console.error('[API] Error response:', errorData);
    throw new ApiError(response.status, response.statusText, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  const jsonData = await response.json();
  console.log('[API] JSON response received');
  return jsonData;
}

// Auth API
export const authApi = {
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return apiFetch<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async login(data: LoginRequest): Promise<string> {
    console.log('[Auth] Attempting login...');
    
    const response = await apiFetch<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    console.log('[Auth] Login response type:', typeof response);
    console.log('[Auth] Login response:', response);
    
    // Handle different response formats
    // Case 1: Response is an object with access_token field
    if (typeof response === 'object' && response !== null) {
      if (response.access_token) {
        console.log('[Auth] Extracted access_token from response object');
        return response.access_token;
      }
      
      // Case 2: Response is an object with token field
      if (response.token) {
        console.log('[Auth] Extracted token from response object');
        return response.token;
      }
      
      // Case 3: Response is an object but no token field found
      console.error('[Auth] Response is object but no token field found:', Object.keys(response));
      throw new Error('Invalid token response format: no token field in response object');
    }
    
    // Case 4: Response is already a plain string token
    if (typeof response === 'string') {
      console.log('[Auth] Response is plain string token');
      return response;
    }
    
    // Case 5: Unexpected response format
    console.error('[Auth] Unexpected response format:', response);
    throw new Error('Invalid token response: unexpected format');
  },

  logout(): void {
    console.log('[Auth] Logging out...');
    tokenManager.removeToken();
    // Clear all localStorage data on logout
    localStorage.clear();
    console.log('[Auth] LocalStorage cleared');
  }
};

// Items API
export const itemsApi = {
  async getItems(skip = 0, limit = 50): Promise<Item[]> {
    return apiFetch<Item[]>(
      `/items?skip=${skip}&limit=${limit}`
    );
  },

  async getItem(itemId: number): Promise<Item> {
    return apiFetch<Item>(`/items/${itemId}`);
  },

  async createItem(data: ItemCreate): Promise<Item> {
    // Якщо є файл фото, використовуємо multipart/form-data
    if (data.photo) {
      const formData = new FormData();
      formData.append('name', data.name);
      if (data.description) formData.append('description', data.description);
      if (data.price !== undefined) formData.append('price', data.price.toString());
      if (data.weight !== undefined) formData.append('weight', data.weight.toString());
      if (data.unit) formData.append('unit', data.unit);
      if (data.subcategory_id !== undefined) formData.append('subcategory_id', data.subcategory_id.toString());
      if (data.active !== undefined) formData.append('active', data.active.toString());
      if (data.photo) formData.append('photo', data.photo);
      if (data.photo_url) formData.append('photo_url', data.photo_url);
      
      return apiFetchMultipart<Item>('/items', formData, 'POST');
    }
    
    // Інакше використовуємо JSON
    return apiFetch<Item>('/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateItem(itemId: number, data: Partial<ItemCreate>): Promise<Item> {
    // Якщо є файл фото, використовуємо multipart/form-data
    if (data.photo) {
      const formData = new FormData();
      if (data.name) formData.append('name', data.name);
      if (data.description !== undefined) formData.append('description', data.description || '');
      if (data.price !== undefined) formData.append('price', data.price.toString());
      if (data.weight !== undefined) formData.append('weight', data.weight.toString());
      if (data.unit) formData.append('unit', data.unit);
      if (data.subcategory_id !== undefined) formData.append('subcategory_id', data.subcategory_id.toString());
      if (data.active !== undefined) formData.append('active', data.active.toString());
      if (data.photo) formData.append('photo', data.photo);
      if (data.photo_url !== undefined) formData.append('photo_url', data.photo_url || '');
      
      return apiFetchMultipart<Item>(`/items/${itemId}`, formData, 'PUT');
    }
    
    // Інакше використовуємо JSON
    return apiFetch<Item>(`/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteItem(itemId: number): Promise<string> {
    return apiFetch<string>(`/items/${itemId}`, {
      method: 'DELETE',
    });
  }
};

// Categories API
export const categoriesApi = {
  async getCategories(): Promise<Category[]> {
    return apiFetch<Category[]>('/categories');
  },

  async createCategory(name: string): Promise<Category> {
    return apiFetch<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async deleteCategory(categoryId: number): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(`/categories/${categoryId}`, {
      method: 'DELETE',
    });
  },
};

// Subcategories API
export const subcategoriesApi = {
  async getSubcategories(categoryId?: number): Promise<Subcategory[]> {
    const params = categoryId ? `?category_id=${categoryId}` : '';
    return apiFetch<Subcategory[]>(`/subcategories${params}`);
  },

  async createSubcategory(data: { name: string; category_id: number }): Promise<Subcategory> {
    return apiFetch<Subcategory>('/subcategories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteSubcategory(subcategoryId: number): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(`/subcategories/${subcategoryId}`, {
      method: 'DELETE',
    });
  },
};

// KP (Commercial Proposal) Types

// Формат заходу в КП (бекендова модель KPEventFormat)
export interface KPEventFormat {
  id: number;
  kp_id: number;
  name: string;
  event_time?: string | null;
  people_count?: number | null;
  order_index: number;
}

// Формат заходу при створенні КП
export interface KPEventFormatCreate {
  name: string;
  event_time?: string;
  people_count?: number;
  order_index?: number;
}

export interface KPItem {
  id: number;
  kp_id: number;
  item_id: number;
  quantity: number;
  // Опціональний зв'язок з конкретним форматом заходу
  event_format_id?: number | null;
}

export interface KPItemCreate {
  item_id: number;
  quantity: number;
  // Використовуємо як індекс формату заходу в масиві event_formats при створенні КП
  event_format_id?: number;
}

export interface KP {
  id: number;
  title: string;
  people_count: number;
  created_at?: string;
  // Дані про клієнта та подію
  client_name?: string;
  event_format?: string;
  event_group?: string;
  event_date?: string;
  event_location?: string;
  event_time?: string;
  coordinator_name?: string;
  coordinator_phone?: string;
  items: KPItem[];
  total_price?: number;
  price_per_person?: number;
  template_id?: number;
  client_email?: string;
  client_phone?: string;
  equipment_total?: number;
  service_total?: number;
  transport_total?: number;
  total_weight?: number; // Орієнтовний вихід (сума ваги) - загальна вага в грамах
  weight_per_person?: number; // Вага на 1 гостя в грамах
  created_by_id?: number;
  status?: string;
  // Формати заходу, пов'язані з КП
  event_formats?: KPEventFormat[];
  discount_id?: number;
  cashback_id?: number;
  use_cashback?: boolean;
  discount_amount?: number;
  cashback_amount?: number;
  discount_include_menu?: boolean;
  discount_include_equipment?: boolean;
  discount_include_service?: boolean;
}

export interface KPCreate {
  title: string;
  people_count: number;
  // Дані про клієнта та подію
  client_name?: string;
  event_format?: string;
  event_group?: string;
  event_date?: string;
  event_location?: string;
  event_time?: string;
  coordinator_name?: string;
  coordinator_phone?: string;
  total_price?: number;
  price_per_person?: number;
  items: KPItemCreate[];
  template_id?: number;
  client_email?: string;
  send_email?: boolean;
  email_message?: string;
  client_phone?: string;
  send_telegram?: boolean;
  telegram_message?: string;
  equipment_total?: number;
  service_total?: number;
  transport_total?: number;
  total_weight?: number; // Орієнтовний вихід (сума ваги) - загальна вага в грамах
  weight_per_person?: number; // Вага на 1 гостя в грамах
  discount_id?: number;
  cashback_id?: number;
  use_cashback?: boolean;
  discount_amount?: number;
  cashback_amount?: number;
  discount_include_menu?: boolean;
  discount_include_equipment?: boolean;
  discount_include_service?: boolean;
  // Список форматів заходу (для KPEventFormat)
  event_formats?: KPEventFormatCreate[];
}

export interface EmailSendRequest {
  to_email: string;
  message?: string;
}

export interface TelegramSendRequest {
  to_phone: string;
  message?: string;
  telegram_account_id?: number;
}

// KP API
export const kpApi = {
  async getKPs(): Promise<KP[]> {
    return apiFetch<KP[]>('/kp');
  },

  async getKP(kpId: number): Promise<KP> {
    return apiFetch<KP>(`/kp/${kpId}`);
  },

  async createKP(data: KPCreate): Promise<KP> {
    return apiFetch<KP>('/kp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteKP(kpId: number): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(`/kp/${kpId}`, {
      method: 'DELETE',
    });
  },

  async updateKPStatus(kpId: number, status: string): Promise<KP> {
    return apiFetch<KP>(`/kp/${kpId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async updateKP(kpId: number, data: KPCreate): Promise<KP> {
    return apiFetch<KP>(`/kp/${kpId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async generateKPPDF(kpId: number, templateId?: number): Promise<Blob> {
    const token = tokenManager.getToken();
    const params = templateId ? `?template_id=${templateId}` : '';
    const url = `${API_BASE_URL}/kp/${kpId}/pdf${params}`;
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      mode: 'cors',
    });

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    return response.blob();
  },

  async sendKPByEmail(kpId: number, emailData: EmailSendRequest, templateId?: number): Promise<{ status: string; message: string }> {
    const params = templateId ? `?template_id=${templateId}` : '';
    return apiFetch<{ status: string; message: string }>(`/kp/${kpId}/send-email${params}`, {
      method: 'POST',
      body: JSON.stringify(emailData),
    });
  },

  async sendKPByTelegram(kpId: number, data: TelegramSendRequest, templateId?: number): Promise<{ status: string; message: string }> {
    const params = templateId ? `?template_id=${templateId}` : '';
    return apiFetch<{ status: string; message: string }>(`/kp/${kpId}/send-telegram${params}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
};

// Template Types
export interface Template {
  id: number;
  name: string;
  filename: string;
  description?: string;
  preview_image_url?: string;
  header_image_url?: string;
  background_image_url?: string;
  is_default: boolean;
   // Налаштування теми
   primary_color?: string | null;
   secondary_color?: string | null;
   text_color?: string | null;
   font_family?: string | null;
  created_at?: string;
  updated_at?: string;
  /**
   * HTML‑вміст шаблону (читається при запиті конкретного шаблону).
   */
  html_content?: string;
}

export interface TemplateCreate {
  name: string;
  filename: string;
  description?: string;
  preview_image_url?: string;
  is_default?: boolean;
  preview_image?: File; // Для завантаження прев'ю
  html_content?: string; // HTML шаблону (ctrl+V)
  header_image?: File; // Шапка
  background_image?: File; // Фонове зображення
  primary_color?: string;
  secondary_color?: string;
  text_color?: string;
  font_family?: string;
}

export interface TemplateUpdate {
  name?: string;
  filename?: string;
  description?: string;
  preview_image_url?: string;
  is_default?: boolean;
  preview_image?: File; // Для завантаження прев'ю
  html_content?: string; // Оновлений HTML шаблону
  header_image?: File;
  background_image?: File;
  header_image_url?: string;
  background_image_url?: string;
  primary_color?: string;
  secondary_color?: string;
  text_color?: string;
  font_family?: string;
}

// Branding / Settings
export interface BrandingSettings {
  logo_url?: string | null;
}

export interface TelegramAccount {
  id: number;
  name: string;
  phone?: string;
  is_active: boolean;
  created_at?: string;
}

export interface TelegramAccountCreate {
  name: string;
  phone?: string;
  session_string: string;
}

export interface SmtpSettings {
  host: string;
  port: string;
  user: string;
  password: string;
  from_email: string;
  from_name: string;
}

export interface TelegramApiConfig {
  api_id: string;
  api_hash: string;
  sender_name: string;
}

// Templates API
export const templatesApi = {
  async getTemplates(): Promise<Template[]> {
    return apiFetch<Template[]>('/templates');
  },

  async getTemplate(templateId: number): Promise<Template> {
    return apiFetch<Template>(`/templates/${templateId}`);
  },

  async createTemplate(data: TemplateCreate): Promise<Template> {
    // Завжди використовуємо multipart/form-data, щоб мати можливість передати html_content
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('filename', data.filename);
    if (data.description) formData.append('description', data.description);
    if (data.is_default !== undefined) formData.append('is_default', data.is_default.toString());
    if (data.preview_image) formData.append('preview_image', data.preview_image);
    if (data.preview_image_url) formData.append('preview_image_url', data.preview_image_url);
    if (data.html_content) formData.append('html_content', data.html_content);
    if (data.header_image) formData.append('header_image', data.header_image);
    if (data.background_image) formData.append('background_image', data.background_image);
    if (data.primary_color) formData.append('primary_color', data.primary_color);
    if (data.secondary_color) formData.append('secondary_color', data.secondary_color);
    if (data.text_color) formData.append('text_color', data.text_color);
    if (data.font_family) formData.append('font_family', data.font_family);
    
    return apiFetchMultipart<Template>('/templates', formData, 'POST');
  },

  async updateTemplate(templateId: number, data: TemplateUpdate): Promise<Template> {
    // Так само завжди multipart/form-data
    const formData = new FormData();
    if (data.name) formData.append('name', data.name);
    if (data.filename) formData.append('filename', data.filename);
    if (data.description !== undefined) formData.append('description', data.description || '');
    if (data.is_default !== undefined) formData.append('is_default', data.is_default.toString());
    if (data.preview_image) formData.append('preview_image', data.preview_image);
    if (data.preview_image_url !== undefined) formData.append('preview_image_url', data.preview_image_url || '');
    if (data.html_content !== undefined) formData.append('html_content', data.html_content);
    if (data.header_image) formData.append('header_image', data.header_image);
    if (data.background_image) formData.append('background_image', data.background_image);
    if (data.header_image_url !== undefined) formData.append('header_image_url', data.header_image_url || '');
    if (data.background_image_url !== undefined) formData.append('background_image_url', data.background_image_url || '');
    if (data.primary_color !== undefined) formData.append('primary_color', data.primary_color || '');
    if (data.secondary_color !== undefined) formData.append('secondary_color', data.secondary_color || '');
    if (data.text_color !== undefined) formData.append('text_color', data.text_color || '');
    if (data.font_family !== undefined) formData.append('font_family', data.font_family || '');
    
    return apiFetchMultipart<Template>(`/templates/${templateId}`, formData, 'PUT');
  },

  async deleteTemplate(templateId: number): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(`/templates/${templateId}`, {
      method: 'DELETE',
    });
  }
};

// Settings / Branding API
export const settingsApi = {
  async getBranding(): Promise<BrandingSettings> {
    return apiFetch<BrandingSettings>("/settings/logo");
  },

  async uploadLogo(file: File): Promise<BrandingSettings> {
    const formData = new FormData();
    formData.append("logo", file);
    return apiFetchMultipart<BrandingSettings>("/settings/logo", formData, "POST");
  },

  async getTelegramAccounts(): Promise<TelegramAccount[]> {
    return apiFetch<TelegramAccount[]>("/settings/telegram-accounts");
  },

  async createTelegramAccount(data: TelegramAccountCreate): Promise<TelegramAccount> {
    return apiFetch<TelegramAccount>("/settings/telegram-accounts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteTelegramAccount(id: number): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(`/settings/telegram-accounts/${id}`, {
      method: "DELETE",
    });
  },

  async getSmtpSettings(): Promise<SmtpSettings> {
    return apiFetch<SmtpSettings>("/settings/smtp");
  },

  async updateSmtpSettings(data: SmtpSettings): Promise<{ status: string }> {
    const formData = new FormData();
    formData.append("host", data.host);
    formData.append("port", data.port);
    formData.append("user", data.user);
    formData.append("password", data.password);
    formData.append("from_email", data.from_email);
    formData.append("from_name", data.from_name);
    return apiFetchMultipart<{ status: string }>("/settings/smtp", formData, "POST");
  },

  async getTelegramApiConfig(): Promise<TelegramApiConfig> {
    return apiFetch<TelegramApiConfig>("/settings/telegram-config");
  },

  async updateTelegramApiConfig(data: TelegramApiConfig): Promise<{ status: string }> {
    const formData = new FormData();
    formData.append("api_id", data.api_id);
    formData.append("api_hash", data.api_hash);
    formData.append("sender_name", data.sender_name);
    return apiFetchMultipart<{ status: string }>("/settings/telegram-config", formData, "POST");
  },

  async importMenuCsv(file: File): Promise<{ status: string; created: number }> {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetchMultipart<{ status: string; created: number }>(
      "/settings/import-menu-csv",
      formData,
      "POST"
    );
  },
};

// Users API
export const usersApi = {
  async getUsers(): Promise<User[]> {
    return apiFetch<User[]>("/users");
  },

  async updateUser(id: number, data: UserUpdate): Promise<User> {
    return apiFetch<User>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

// Clients API
export const clientsApi = {
  async getClients(): Promise<Client[]> {
    return apiFetch<Client[]>("/clients");
  },

  async getClient(id: number): Promise<Client> {
    return apiFetch<Client>(`/clients/${id}`);
  },

  async updateClient(id: number, data: ClientUpdate): Promise<Client> {
    return apiFetch<Client>(`/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

// Menus API
export const menusApi = {
  async getMenus(): Promise<Menu[]> {
    return apiFetch<Menu[]>("/menus");
  },

  async getMenu(menuId: number): Promise<Menu> {
    return apiFetch<Menu>(`/menus/${menuId}`);
  },

  async createMenu(data: MenuCreate): Promise<Menu> {
    return apiFetch<Menu>("/menus", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateMenu(menuId: number, data: MenuUpdate): Promise<Menu> {
    return apiFetch<Menu>(`/menus/${menuId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteMenu(menuId: number): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(`/menus/${menuId}`, {
      method: "DELETE",
    });
  },
};

// Benefits types
export interface Benefit {
  id: number;
  name: string;
  type: "discount" | "cashback";
  value: number;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BenefitCreate {
  name: string;
  type: "discount" | "cashback";
  value: number;
  description?: string;
  is_active?: boolean;
}

export interface BenefitUpdate {
  name?: string;
  type?: "discount" | "cashback";
  value?: number;
  description?: string;
  is_active?: boolean;
}

// Benefits API
export const benefitsApi = {
  async getBenefits(type?: "discount" | "cashback", activeOnly: boolean = true): Promise<Benefit[]> {
    const params = new URLSearchParams();
    if (type) params.append("type", type);
    params.append("active_only", activeOnly.toString());
    return apiFetch<Benefit[]>(`/benefits?${params.toString()}`);
  },

  async getBenefit(id: number): Promise<Benefit> {
    return apiFetch<Benefit>(`/benefits/${id}`);
  },

  async createBenefit(data: BenefitCreate): Promise<Benefit> {
    return apiFetch<Benefit>("/benefits", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateBenefit(id: number, data: BenefitUpdate): Promise<Benefit> {
    return apiFetch<Benefit>(`/benefits/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteBenefit(id: number): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(`/benefits/${id}`, {
      method: "DELETE",
    });
  },
};