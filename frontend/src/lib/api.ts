// API Configuration and Helper Functions
// Re-export from modular API structure

export { API_BASE_URL, getImageUrl, queryKeys } from './api/config';
export { apiFetch, apiFetchMultipart, ApiError, apiClient } from './api/client';
export { tokenManager, getToken } from './api/token';

// Import API utilities for use in this file
import { API_BASE_URL } from './api/config';
import { apiFetch, apiFetchMultipart, ApiError } from './api/client';
import { tokenManager } from './api/token';

// Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  new_password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface RegisterResponse {
  email: string;
  id: number;  // Integer, не UUID
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  otpauth_url?: string | null;
  role?: string;
  first_name?: string | null;
  last_name?: string | null;
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
  price: number; // Ціна прокату за шт/грн
  stock_quantity?: number; // Кількість на складі
  loss_price?: number; // Ціна втрати шт/грн
  weight?: string | number; // Може бути число або рядок типу "150/75"
  volume?: string | number; // Об'єм (необов'язкове поле)
  unit?: string;
  photo_url?: string;
  icon_name?: string; // Назва іконки (emoji або назва іконки)
  can_cook_on_location?: boolean; // Чи можна готувати страву на локації (будинок/палатка/вогонь)
  active: boolean;
  subcategory_id: number;
  subcategory?: Subcategory;
  created_at?: string;
}

export interface ItemCreate {
  name: string;
  description?: string;
  price?: number; // Ціна прокату за шт/грн
  stock_quantity?: number; // Кількість на складі
  loss_price?: number; // Ціна втрати шт/грн
  weight?: string | number; // Може бути число або рядок типу "150/75"
  volume?: string | number; // Об'єм (необов'язкове поле)
  unit?: string;
  photo_url?: string;
  icon_name?: string; // Назва іконки (emoji або назва іконки)
  can_cook_on_location?: boolean; // Чи можна готувати страву на локації (будинок/палатка/вогонь)
  active?: boolean;
  subcategory_id?: number;
  photo?: File; // Для завантаження файлу
}

// Users API types
export interface User {
  id: string; // UUID as string
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role: string;
  department?: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at?: string;
}

export interface UserUpdate {
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: string;
  department?: string | null;
  is_active?: boolean;
  is_admin?: boolean;
}

// Clients types
export interface Client {
  id: number;
  name: string;
  company_name?: string;
  phone: string;
  email?: string;
  total_orders?: number;
  lifetime_spent?: number;
  current_year_spent?: number;
  cashback_balance?: number;
  cashback_earned_total?: number;
  cashback_used_total?: number;
  cashback_expires_at?: string;
  loyalty_tier?: string;
  cashback_rate?: number;
  is_custom_rate?: boolean;
  yearly_photographer_used?: boolean;
  yearly_robot_used?: boolean;
  bonus_year?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  questionnaire_id?: number; // ID останньої анкети клієнта
  // Старі поля для сумісності
  total_spent?: number;
  status?: string;
  event_date?: string;
  event_format?: string;
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

export interface ClientCreate {
  name: string;
  company_name?: string;
  phone: string;
  email?: string;
  total_orders?: number;
  total_spent?: number;
  cashback_balance?: number;
  notes?: string;
}

export interface ClientUpdate {
  name?: string;
  company_name?: string;
  phone?: string;
  email?: string;
  total_orders?: number;
  total_spent?: number;
  cashback_balance?: number;
  notes?: string;
}

export interface ClientQuestionnaire {
  id: number;
  client_id: number;
  manager_id?: number;
  // СЕРВІС
  event_date?: string;
  event_type?: string;
  location?: string;
  contact_person?: string;
  contact_phone?: string;
  on_site_contact?: string;
  on_site_phone?: string;
  arrival_time?: string;
  event_start_time?: string;
  event_end_time?: string;
  service_type_timing?: string;
  additional_services_timing?: string;
  equipment_notes?: string;
  selected_equipment_ids?: number[];
  payment_method?: string;
  textile_color?: string;
  banquet_line_color?: string;
  // ЗАЇЗД
  venue_complexity?: string;
  floor_number?: string;
  elevator_available?: boolean;
  technical_room?: string;
  kitchen_available?: string;
  venue_photos?: boolean;
  arrival_photos?: boolean;
  venue_photos_urls?: string[];
  arrival_photos_urls?: string[];
  // КУХНЯ
  dish_serving?: string;
  hot_snacks_serving?: string;
  salad_serving?: string;
  product_allergy?: string;
  vegetarians?: boolean;
  hot_snacks_prep?: string;
  menu_notes?: string;
  client_order_notes?: string;
  client_drinks_notes?: string;
  // КОНТЕНТ
  photo_allowed?: string;
  video_allowed?: string;
  branded_products?: string;
  // ЗАМОВНИК
  client_company_name?: string;
  client_activity_type?: string;
  // КОМЕНТАРІ
  special_notes?: string;
  created_at?: string;
  updated_at?: string;
  // Додаткові поля для відображення
  client_name?: string;
  client_phone?: string;
  client_company?: string;
}

export interface ClientQuestionnaireUpdate {
  event_date?: string;
  event_type?: string;
  location?: string;
  contact_person?: string;
  contact_phone?: string;
  on_site_contact?: string;
  on_site_phone?: string;
  arrival_time?: string;
  event_start_time?: string;
  event_end_time?: string;
  service_type_timing?: string;
  additional_services_timing?: string;
  equipment_notes?: string;
  payment_method?: string;
  textile_color?: string;
  banquet_line_color?: string;
  venue_complexity?: string;
  floor_number?: string;
  elevator_available?: boolean;
  technical_room?: string;
  kitchen_available?: string;
  venue_photos?: boolean;
  arrival_photos?: boolean;
  venue_photos_urls?: string[];
  arrival_photos_urls?: string[];
  dish_serving?: string;
  hot_snacks_serving?: string;
  salad_serving?: string;
  product_allergy?: string;
  vegetarians?: boolean;
  hot_snacks_prep?: string;
  menu_notes?: string;
  client_order_notes?: string;
  client_drinks_notes?: string;
  photo_allowed?: string;
  video_allowed?: string;
  branded_products?: string;
  client_company_name?: string;
  client_activity_type?: string;
  special_notes?: string;
}

export interface ClientQuestionnaireCreate extends ClientQuestionnaireUpdate {
  client_id: number;
  manager_id?: number;
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

// All API utilities are imported from modular structure above
// No duplicate definitions here

// Auth API - uses direct fetch without API_BASE_URL prefix
const authFetch = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = tokenManager.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    mode: 'cors',
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }
    throw new ApiError(response.status, response.statusText, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return await response.json();
};

export const authApi = {
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return authFetch<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async login(data: LoginRequest): Promise<string> {
    console.log('[Auth] Attempting login...');
    
    const response = await authFetch<any>('/auth/login', {
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
    console.error('[Auth] Unexpected response format:', typeof response, response);
    throw new Error('Invalid token response format');
  },

  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string }> {
    return authFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verifyResetCode(data: VerifyResetCodeRequest): Promise<{ message: string }> {
    return authFetch<{ message: string }>('/auth/verify-reset-code', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    return authFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
    // Endpoint завжди очікує multipart/form-data, тому завжди використовуємо FormData
    const formData = new FormData();
    
    formData.append('name', data.name);
    if (data.description !== undefined) formData.append('description', data.description || '');
    if (data.price !== undefined && data.price !== null) {
      formData.append('price', data.price.toString());
    }
    if (data.stock_quantity !== undefined && data.stock_quantity !== null) {
      formData.append('stock_quantity', data.stock_quantity.toString());
    }
    if (data.loss_price !== undefined && data.loss_price !== null) {
      formData.append('loss_price', data.loss_price.toString());
    }
    if (data.weight !== undefined && data.weight !== null) {
      formData.append('weight', String(data.weight));
    }
    if (data.volume !== undefined && data.volume !== null) {
      formData.append('volume', String(data.volume));
    }
    if (data.unit !== undefined) formData.append('unit', data.unit || '');
    if (data.subcategory_id !== undefined && data.subcategory_id !== null) {
      formData.append('subcategory_id', data.subcategory_id.toString());
    }
    if (data.active !== undefined) formData.append('active', data.active.toString());
    if (data.photo) formData.append('photo', data.photo);
    if (data.photo_url !== undefined) formData.append('photo_url', data.photo_url || '');
    if (data.icon_name !== undefined) formData.append('icon_name', data.icon_name || '');
    
    return apiFetchMultipart<Item>('/items', formData, 'POST');
  },

  async updateItem(itemId: number, data: Partial<ItemCreate>): Promise<Item> {
    // Endpoint завжди очікує multipart/form-data, тому завжди використовуємо FormData
    const formData = new FormData();
    
    // Завжди передаємо name, якщо воно є (обов'язкове поле)
    if (data.name !== undefined && data.name !== null) {
      formData.append('name', data.name);
    }
    if (data.description !== undefined) formData.append('description', data.description || '');
    if (data.price !== undefined && data.price !== null) {
      formData.append('price', data.price.toString());
    }
    if (data.stock_quantity !== undefined && data.stock_quantity !== null) {
      formData.append('stock_quantity', data.stock_quantity.toString());
    }
    if (data.loss_price !== undefined && data.loss_price !== null) {
      formData.append('loss_price', data.loss_price.toString());
    }
    if (data.weight !== undefined && data.weight !== null) {
      // weight може бути числом або рядком, завжди перетворюємо на рядок
      formData.append('weight', String(data.weight));
    }
    if (data.volume !== undefined && data.volume !== null) {
      // volume може бути числом або рядком, завжди перетворюємо на рядок
      formData.append('volume', String(data.volume));
    }
    if (data.unit !== undefined) formData.append('unit', data.unit || '');
    if (data.subcategory_id !== undefined && data.subcategory_id !== null && data.subcategory_id !== 0) {
      formData.append('subcategory_id', data.subcategory_id.toString());
    }
    if (data.active !== undefined) formData.append('active', data.active.toString());
    if (data.photo) formData.append('photo', data.photo);
    // Передаємо photo_url тільки якщо він явно вказаний (не undefined)
    // Якщо photo_url === undefined, не передаємо його взагалі, щоб залишити старе фото без змін
    if (data.photo_url !== undefined) {
      formData.append('photo_url', data.photo_url || '');
    }
    if (data.icon_name !== undefined) formData.append('icon_name', data.icon_name || '');
    
    console.log(`[API] PUT /items/${itemId}`, {
      name: data.name,
      price: data.price,
      subcategory_id: data.subcategory_id,
      active: data.active,
      hasPhoto: !!data.photo,
      photo_url: data.photo_url
    });
    
    const result = await apiFetchMultipart<Item>(`/items/${itemId}`, formData, 'PUT');
    
    console.log(`[API] Отримано оновлену страву:`, result);
    
    return result;
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

  async bulkDeleteCategories(categoryIds: number[]): Promise<{ status: string; deleted_count: number }> {
    return apiFetch<{ status: string; deleted_count: number }>('/categories/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: categoryIds }),
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

  async bulkDeleteSubcategories(subcategoryIds: number[]): Promise<{ status: string; deleted_count: number }> {
    return apiFetch<{ status: string; deleted_count: number }>('/subcategories/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: subcategoryIds }),
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
  transport_equipment_total?: number;
  transport_personnel_total?: number;
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

export interface PurchaseExportRequest {
  kp_ids: number[];
  format?: "excel" | "pdf";
}

export interface ProcurementGenerateRequest {
  kp_ids: number[];
  filename?: string;
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
  transport_equipment_total?: number;
  transport_personnel_total?: number;
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

// Purchase / Procurement API
export const purchaseApi = {
  async exportPurchase(data: PurchaseExportRequest): Promise<Blob> {
    const token = tokenManager.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/purchase/export`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
      mode: "cors",
    });

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { detail: response.statusText };
      }
      throw new ApiError(response.status, response.statusText, errorData);
    }

    return response.blob();
  },

  async generateProcurement(data: ProcurementGenerateRequest): Promise<Blob> {
    const token = tokenManager.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/procurement/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
      mode: "cors",
    });

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { detail: response.statusText };
      }
      throw new ApiError(response.status, response.statusText, errorData);
    }

    return response.blob();
  },
};

// Service Export Request
export interface ServiceExportRequest {
  kp_ids: number[];
  format?: "excel" | "pdf";
}

// Service / Сервіс API
export const serviceApi = {
  async exportService(data: ServiceExportRequest): Promise<Blob> {
    const token = tokenManager.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/service/export`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
      mode: "cors",
    });

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { detail: response.statusText };
      }
      throw new ApiError(response.status, response.statusText, errorData);
    }

    return response.blob();
  },
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
  category_separator_image_url?: string | null;
  is_default: boolean;
  // Налаштування теми
  primary_color?: string | null;
  secondary_color?: string | null;
  text_color?: string | null;
  font_family?: string | null;
  // Заголовок КП
  title_text?: string | null;
  company_name?: string | null;
  // Шрифти для різних елементів
  title_font?: string | null;
  header_font?: string | null;
  body_font?: string | null;
  table_font?: string | null;
  // Кольори елементів PDF
  format_bg_color?: string | null;
  table_header_bg_color?: string | null;
  category_bg_color?: string | null;
  summary_bg_color?: string | null;
  total_bg_color?: string | null;
  // Налаштування тексту категорій та страв
  category_text_align?: string | null;
  category_text_color?: string | null;
  dish_text_align?: string | null;
  dish_text_color?: string | null;
  // Налаштування відображення колонок
  show_item_photo?: boolean;
  show_item_weight?: boolean;
  show_item_quantity?: boolean;
  show_item_price?: boolean;
  show_item_total?: boolean;
  show_item_description?: boolean;
  // Налаштування підсумкових блоків
  show_weight_summary?: boolean;
  show_weight_per_person?: boolean;
  show_discount_block?: boolean;
  show_equipment_block?: boolean;
  show_service_block?: boolean;
  show_transport_block?: boolean;
  // Секції меню
  menu_sections?: string[];
  // Галерея фото
  gallery_photos?: string[];
  // Умови бронювання
  booking_terms?: string;
  // Текстові налаштування
  menu_title?: string;
  summary_title?: string;
  footer_text?: string;
  // Layout
  page_orientation?: string;
  items_per_page?: number;
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
  logo_image?: File; // Логотип
  header_image_url?: string; // URL завантаженого зображення шапки
  background_image_url?: string; // URL завантаженого фонового зображення
  category_separator_image_url?: string; // URL завантаженого зображення розділювача
  primary_color?: string;
  secondary_color?: string;
  text_color?: string;
  font_family?: string;
  // Заголовок КП
  title_text?: string;
  company_name?: string;
  // Шрифти
  title_font?: string;
  header_font?: string;
  body_font?: string;
  table_font?: string;
  // Кольори елементів PDF
  format_bg_color?: string;
  table_header_bg_color?: string;
  category_bg_color?: string;
  summary_bg_color?: string;
  total_bg_color?: string;
  // Налаштування тексту категорій та страв
  category_text_align?: string; // left, center, right
  category_text_color?: string;
  dish_text_align?: string; // left, center, right
  dish_text_color?: string;
  // Налаштування відображення
  show_item_photo?: boolean;
  show_item_weight?: boolean;
  show_item_quantity?: boolean;
  show_item_price?: boolean;
  show_item_total?: boolean;
  show_item_description?: boolean;
  show_weight_summary?: boolean;
  show_weight_per_person?: boolean;
  show_discount_block?: boolean;
  show_equipment_block?: boolean;
  show_service_block?: boolean;
  show_transport_block?: boolean;
  menu_sections?: string[];
  menu_title?: string;
  summary_title?: string;
  footer_text?: string;
  page_orientation?: string;
  items_per_page?: number;
  // Умови бронювання
  booking_terms?: string;
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
  logo_image?: File;
  header_image_url?: string;
  background_image_url?: string;
  primary_color?: string;
  secondary_color?: string;
  text_color?: string;
  font_family?: string;
  // Заголовок КП
  title_text?: string;
  company_name?: string;
  // Шрифти
  title_font?: string;
  header_font?: string;
  body_font?: string;
  table_font?: string;
  // Кольори елементів PDF
  format_bg_color?: string;
  table_header_bg_color?: string;
  category_bg_color?: string;
  summary_bg_color?: string;
  total_bg_color?: string;
  // Налаштування відображення
  show_item_photo?: boolean;
  show_item_weight?: boolean;
  show_item_quantity?: boolean;
  show_item_price?: boolean;
  show_item_total?: boolean;
  show_item_description?: boolean;
  show_weight_summary?: boolean;
  show_weight_per_person?: boolean;
  show_discount_block?: boolean;
  show_equipment_block?: boolean;
  show_service_block?: boolean;
  show_transport_block?: boolean;
  menu_sections?: string[];
  menu_title?: string;
  summary_title?: string;
  footer_text?: string;
  page_orientation?: string;
  items_per_page?: number;
  // Умови бронювання
  booking_terms?: string;
  // Галерея фото
  gallery_photos?: string[];
}

// Branding / Settings
export interface BrandingSettings {
  logo_url?: string | null;
}

export interface TelegramAccount {
  id: number;
  name: string;
  phone?: string;
  api_id?: number;
  api_hash?: string;
  is_active: boolean;
  created_at?: string;
}

export interface TelegramAccountCreate {
  name: string;
  phone?: string;
  session_string: string;
  api_id?: number;
  api_hash?: string;
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

export interface WhatsAppConfig {
  access_token: string;
  phone_number_id: string;
  app_secret: string;
  verify_token: string;
}

export interface InstagramConfig {
  app_id: string;
  access_token: string;
  app_secret: string;
  verify_token: string;
}

export interface FacebookConfig {
  app_id: string;
  access_token: string;
  app_secret: string;
  verify_token: string;
  page_id: string;
}

export interface StripeConfig {
  secret_key: string;
}

export interface InPostConfig {
  api_key: string;
}

export interface ManagerSmtpAccount {
  id: number;
  name: string;
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  imap_host: string | null;
  imap_port: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string | null;
}

export interface ManagerSmtpAccountCreate {
  name: string;
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  imap_host?: string | null;
  imap_port?: number | null;
}

export interface ManagerSmtpAccountUpdate {
  name?: string;
  email?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  imap_host?: string | null;
  imap_port?: number | null;
  is_active?: boolean;
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
    // Завжди використовуємо multipart/form-data, щоб мати можливість передати html_content і всі налаштування дизайну
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('filename', data.filename);
    if (data.description !== undefined) formData.append('description', data.description || '');
    if (data.is_default !== undefined) formData.append('is_default', data.is_default.toString());
    if (data.preview_image) formData.append('preview_image', data.preview_image);
    if (data.preview_image_url !== undefined) formData.append('preview_image_url', data.preview_image_url || '');
    if (data.html_content) formData.append('html_content', data.html_content);
    if (data.header_image) formData.append('header_image', data.header_image);
    if (data.background_image) formData.append('background_image', data.background_image);
    if (data.logo_image) formData.append('logo_image', data.logo_image);
    // URL завантажених зображень
    if (data.header_image_url !== undefined) formData.append('header_image_url', data.header_image_url || '');
    if (data.background_image_url !== undefined) formData.append('background_image_url', data.background_image_url || '');
    if (data.category_separator_image_url !== undefined) formData.append('category_separator_image_url', data.category_separator_image_url || '');
    if (data.primary_color) formData.append('primary_color', data.primary_color);
    if (data.secondary_color) formData.append('secondary_color', data.secondary_color);
    if (data.text_color) formData.append('text_color', data.text_color);
    if (data.font_family) formData.append('font_family', data.font_family);
    // Заголовок КП
    if (data.title_text !== undefined) formData.append('title_text', data.title_text || '');
    if (data.company_name !== undefined) formData.append('company_name', data.company_name || '');
    // Шрифти
    if (data.title_font !== undefined) formData.append('title_font', data.title_font || '');
    if (data.header_font !== undefined) formData.append('header_font', data.header_font || '');
    if (data.body_font !== undefined) formData.append('body_font', data.body_font || '');
    if (data.table_font !== undefined) formData.append('table_font', data.table_font || '');
    // Кольори PDF
    if (data.format_bg_color !== undefined) formData.append('format_bg_color', data.format_bg_color || '');
    if (data.table_header_bg_color !== undefined) formData.append('table_header_bg_color', data.table_header_bg_color || '');
    if (data.category_bg_color !== undefined) formData.append('category_bg_color', data.category_bg_color || '');
    if (data.summary_bg_color !== undefined) formData.append('summary_bg_color', data.summary_bg_color || '');
    if (data.total_bg_color !== undefined) formData.append('total_bg_color', data.total_bg_color || '');
    // Налаштування тексту категорій та страв
    if (data.category_text_align !== undefined) formData.append('category_text_align', data.category_text_align || '');
    if (data.category_text_color !== undefined) formData.append('category_text_color', data.category_text_color || '');
    if (data.dish_text_align !== undefined) formData.append('dish_text_align', data.dish_text_align || '');
    if (data.dish_text_color !== undefined) formData.append('dish_text_color', data.dish_text_color || '');
    // Налаштування відображення колонок
    if (data.show_item_photo !== undefined) formData.append('show_item_photo', String(data.show_item_photo));
    if (data.show_item_weight !== undefined) formData.append('show_item_weight', String(data.show_item_weight));
    if (data.show_item_quantity !== undefined) formData.append('show_item_quantity', String(data.show_item_quantity));
    if (data.show_item_price !== undefined) formData.append('show_item_price', String(data.show_item_price));
    if (data.show_item_total !== undefined) formData.append('show_item_total', String(data.show_item_total));
    if (data.show_item_description !== undefined) formData.append('show_item_description', String(data.show_item_description));
    // Підсумкові блоки
    if (data.show_weight_summary !== undefined) formData.append('show_weight_summary', String(data.show_weight_summary));
    if (data.show_weight_per_person !== undefined) formData.append('show_weight_per_person', String(data.show_weight_per_person));
    if (data.show_discount_block !== undefined) formData.append('show_discount_block', String(data.show_discount_block));
    if (data.show_equipment_block !== undefined) formData.append('show_equipment_block', String(data.show_equipment_block));
    if (data.show_service_block !== undefined) formData.append('show_service_block', String(data.show_service_block));
    if (data.show_transport_block !== undefined) formData.append('show_transport_block', String(data.show_transport_block));
    // Секції меню та тексти (завжди передаємо, навіть якщо порожній масив)
    if (data.menu_sections !== undefined) {
      formData.append('menu_sections', JSON.stringify(data.menu_sections));
    }
    if (data.menu_title) formData.append('menu_title', data.menu_title);
    if (data.summary_title) formData.append('summary_title', data.summary_title);
    if (data.footer_text !== undefined) formData.append('footer_text', data.footer_text || '');
    if (data.booking_terms !== undefined) formData.append('booking_terms', data.booking_terms || '');
    // Layout
    if (data.page_orientation) formData.append('page_orientation', data.page_orientation);
    if (data.items_per_page !== undefined) formData.append('items_per_page', String(data.items_per_page));
    
    return apiFetchMultipart<Template>('/templates', formData, 'POST');
  },

  async updateTemplate(templateId: number, data: TemplateUpdate): Promise<Template> {
    // Так само завжди multipart/form-data, включаючи всі налаштування дизайну
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
    if (data.category_separator_image) formData.append('category_separator_image', data.category_separator_image);
    if (data.header_image_url !== undefined) formData.append('header_image_url', data.header_image_url || '');
    if (data.background_image_url !== undefined) formData.append('background_image_url', data.background_image_url || '');
    if (data.category_separator_image_url !== undefined) formData.append('category_separator_image_url', data.category_separator_image_url || '');
    if (data.logo_image) formData.append('logo_image', data.logo_image);
    if (data.primary_color !== undefined) formData.append('primary_color', data.primary_color || '');
    if (data.secondary_color !== undefined) formData.append('secondary_color', data.secondary_color || '');
    if (data.text_color !== undefined) formData.append('text_color', data.text_color || '');
    if (data.font_family !== undefined) formData.append('font_family', data.font_family || '');
    // Заголовок КП
    if (data.title_text !== undefined) formData.append('title_text', data.title_text || '');
    if (data.company_name !== undefined) formData.append('company_name', data.company_name || '');
    // Шрифти
    if (data.title_font !== undefined) formData.append('title_font', data.title_font || '');
    if (data.header_font !== undefined) formData.append('header_font', data.header_font || '');
    if (data.body_font !== undefined) formData.append('body_font', data.body_font || '');
    if (data.table_font !== undefined) formData.append('table_font', data.table_font || '');
    // Кольори PDF
    if (data.format_bg_color !== undefined) formData.append('format_bg_color', data.format_bg_color || '');
    if (data.table_header_bg_color !== undefined) formData.append('table_header_bg_color', data.table_header_bg_color || '');
    if (data.category_bg_color !== undefined) formData.append('category_bg_color', data.category_bg_color || '');
    if (data.summary_bg_color !== undefined) formData.append('summary_bg_color', data.summary_bg_color || '');
    if (data.total_bg_color !== undefined) formData.append('total_bg_color', data.total_bg_color || '');
    // Налаштування тексту категорій та страв
    if (data.category_text_align !== undefined) formData.append('category_text_align', data.category_text_align || '');
    if (data.category_text_color !== undefined) formData.append('category_text_color', data.category_text_color || '');
    if (data.dish_text_align !== undefined) formData.append('dish_text_align', data.dish_text_align || '');
    if (data.dish_text_color !== undefined) formData.append('dish_text_color', data.dish_text_color || '');
    // Налаштування відображення колонок
    if (data.show_item_photo !== undefined) formData.append('show_item_photo', String(data.show_item_photo));
    if (data.show_item_weight !== undefined) formData.append('show_item_weight', String(data.show_item_weight));
    if (data.show_item_quantity !== undefined) formData.append('show_item_quantity', String(data.show_item_quantity));
    if (data.show_item_price !== undefined) formData.append('show_item_price', String(data.show_item_price));
    if (data.show_item_total !== undefined) formData.append('show_item_total', String(data.show_item_total));
    if (data.show_item_description !== undefined) formData.append('show_item_description', String(data.show_item_description));
    // Підсумкові блоки
    if (data.show_weight_summary !== undefined) formData.append('show_weight_summary', String(data.show_weight_summary));
    if (data.show_weight_per_person !== undefined) formData.append('show_weight_per_person', String(data.show_weight_per_person));
    if (data.show_discount_block !== undefined) formData.append('show_discount_block', String(data.show_discount_block));
    if (data.show_equipment_block !== undefined) formData.append('show_equipment_block', String(data.show_equipment_block));
    if (data.show_service_block !== undefined) formData.append('show_service_block', String(data.show_service_block));
    if (data.show_transport_block !== undefined) formData.append('show_transport_block', String(data.show_transport_block));
    // Секції меню та тексти (завжди передаємо, навіть якщо порожній масив)
    if (data.menu_sections !== undefined) {
      formData.append('menu_sections', JSON.stringify(data.menu_sections));
    }
    if (data.menu_title !== undefined) formData.append('menu_title', data.menu_title || '');
    if (data.summary_title !== undefined) formData.append('summary_title', data.summary_title || '');
    if (data.footer_text !== undefined) formData.append('footer_text', data.footer_text || '');
    if (data.booking_terms !== undefined) formData.append('booking_terms', data.booking_terms || '');
    // Layout
    if (data.page_orientation !== undefined) formData.append('page_orientation', data.page_orientation || '');
    if (data.items_per_page !== undefined) formData.append('items_per_page', String(data.items_per_page));
    // Галерея фото (завжди передаємо, навіть якщо порожній масив)
    if (data.gallery_photos !== undefined) {
      formData.append('gallery_photos', JSON.stringify(data.gallery_photos));
    }
    
    return apiFetchMultipart<Template>(`/templates/${templateId}`, formData, 'PUT');
  },

  async deleteTemplate(templateId: number): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(`/templates/${templateId}`, {
      method: 'DELETE',
    });
  },

  async uploadGalleryPhoto(templateId: number, photo: File): Promise<{ status: string; photo_url: string; gallery_photos: string[] }> {
    const formData = new FormData();
    formData.append('photo', photo);
    
    return apiFetch<{ status: string; photo_url: string; gallery_photos: string[] }>(
      `/templates/${templateId}/upload-gallery-photo`,
      {
        method: 'POST',
        body: formData,
      }
    );
  },

  async deleteGalleryPhoto(templateId: number, photoIndex: number): Promise<{ status: string; gallery_photos: string[] }> {
    return apiFetch<{ status: string; gallery_photos: string[] }>(
      `/templates/${templateId}/gallery-photo/${photoIndex}`,
      {
        method: 'DELETE',
      }
    );
  },

  async uploadTemplateImage(file: File, imageType: 'header' | 'separator' | 'background' | 'logo'): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('image_type', imageType);
    
    return apiFetchMultipart<{ url: string }>('/templates/upload-image', formData, 'POST');
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

  async getManagerSmtpAccounts(): Promise<ManagerSmtpAccount[]> {
    return apiFetch<ManagerSmtpAccount[]>("/settings/manager-smtp-accounts");
  },

  async createManagerSmtpAccount(data: ManagerSmtpAccountCreate): Promise<ManagerSmtpAccount> {
    return apiFetch<ManagerSmtpAccount>("/settings/manager-smtp-accounts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateManagerSmtpAccount(
    id: number,
    data: ManagerSmtpAccountUpdate
  ): Promise<ManagerSmtpAccount> {
    return apiFetch<ManagerSmtpAccount>(`/settings/manager-smtp-accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteManagerSmtpAccount(id: number): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(`/settings/manager-smtp-accounts/${id}`, {
      method: "DELETE",
    });
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

  async generateTelegramSession(data: {
    api_id: string;
    api_hash: string;
    phone: string;
    code?: string;
    password?: string;
    session_id?: string;
  }): Promise<{ status: string; session_string?: string; message?: string; session_id?: string }> {
    const formData = new FormData();
    formData.append("api_id", data.api_id);
    formData.append("api_hash", data.api_hash);
    formData.append("phone", data.phone);
    if (data.code) formData.append("code", data.code);
    if (data.password) formData.append("password", data.password);
    if (data.session_id) formData.append("session_id", data.session_id);
    return apiFetchMultipart<{ status: string; session_string?: string; message?: string; session_id?: string }>(
      "/settings/telegram-session/generate",
      formData,
      "POST"
    );
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

  // WhatsApp API
  async getWhatsAppConfig(): Promise<WhatsAppConfig> {
    return apiFetch<WhatsAppConfig>("/settings/whatsapp-config");
  },
  async updateWhatsAppConfig(data: WhatsAppConfig): Promise<{ status: string }> {
    const formData = new FormData();
    formData.append("access_token", data.access_token);
    formData.append("phone_number_id", data.phone_number_id);
    formData.append("app_secret", data.app_secret);
    formData.append("verify_token", data.verify_token);
    return apiFetchMultipart<{ status: string }>("/settings/whatsapp-config", formData, "POST");
  },

  // Instagram API
  async getInstagramConfig(): Promise<InstagramConfig> {
    return apiFetch<InstagramConfig>("/settings/instagram-config");
  },
  async updateInstagramConfig(data: InstagramConfig): Promise<{ status: string }> {
    const formData = new FormData();
    formData.append("app_id", data.app_id);
    formData.append("access_token", data.access_token);
    formData.append("app_secret", data.app_secret);
    formData.append("verify_token", data.verify_token);
    return apiFetchMultipart<{ status: string }>("/settings/instagram-config", formData, "POST");
  },

  // Facebook API
  async getFacebookConfig(): Promise<FacebookConfig> {
    return apiFetch<FacebookConfig>("/settings/facebook-config");
  },
  async updateFacebookConfig(data: FacebookConfig): Promise<{ status: string }> {
    const formData = new FormData();
    formData.append("app_id", data.app_id);
    formData.append("access_token", data.access_token);
    formData.append("app_secret", data.app_secret);
    formData.append("verify_token", data.verify_token);
    formData.append("page_id", data.page_id);
    return apiFetchMultipart<{ status: string }>("/settings/facebook-config", formData, "POST");
  },

  // Stripe API
  async getStripeConfig(): Promise<StripeConfig> {
    return apiFetch<StripeConfig>("/settings/stripe-config");
  },
  async updateStripeConfig(data: StripeConfig): Promise<{ status: string }> {
    const formData = new FormData();
    formData.append("secret_key", data.secret_key);
    return apiFetchMultipart<{ status: string }>("/settings/stripe-config", formData, "POST");
  },

  // InPost API
  async getInPostConfig(): Promise<InPostConfig> {
    return apiFetch<InPostConfig>("/settings/inpost-config");
  },
  async updateInPostConfig(data: InPostConfig): Promise<{ status: string }> {
    const formData = new FormData();
    formData.append("api_key", data.api_key);
    return apiFetchMultipart<{ status: string }>("/settings/inpost-config", formData, "POST");
  },
};

// Users API
export const usersApi = {
  async getUsers(): Promise<User[]> {
    return apiFetch<User[]>("/users");
  },

  async updateUser(id: string, data: UserUpdate): Promise<User> {
    return apiFetch<User>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

// Clients API
export const clientsApi = {
  async getClients(skip?: number, limit?: number, search?: string): Promise<{ total: number; clients: Client[] }> {
    const params = new URLSearchParams();
    if (skip !== undefined) params.append("skip", skip.toString());
    if (limit !== undefined) params.append("limit", limit.toString());
    if (search) params.append("search", search);
    return apiFetch<{ total: number; clients: Client[] }>(`/clients?${params.toString()}`);
  },

  async getClient(id: number): Promise<{ client: Client; kps: KP[]; questionnaire?: ClientQuestionnaire }> {
    return apiFetch<{ client: Client; kps: KP[]; questionnaire?: ClientQuestionnaire }>(`/clients/${id}`);
  },

  async createClient(data: ClientCreate): Promise<Client> {
    return apiFetch<Client>("/clients", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateClient(id: number, data: ClientUpdate): Promise<Client> {
    return apiFetch<Client>(`/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async getQuestionnaire(clientId: number): Promise<ClientQuestionnaire> {
    return apiFetch<ClientQuestionnaire>(`/clients/${clientId}/questionnaire`);
  },

  async createOrUpdateQuestionnaire(clientId: number, data: ClientQuestionnaireUpdate): Promise<ClientQuestionnaire> {
    return apiFetch<ClientQuestionnaire>(`/clients/${clientId}/questionnaire`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async searchByPhone(phone: string): Promise<{ found: boolean; client: Client | null }> {
    return apiFetch<{ found: boolean; client: Client | null }>(`/clients/search-by-phone/${encodeURIComponent(phone)}`);
  },

  async deleteClient(id: number): Promise<{ status: string; id: number }> {
    return apiFetch<{ status: string; id: number }>(`/clients/${id}`, {
      method: "DELETE",
    });
  },
};

// Questionnaires API
export const questionnairesApi = {
  async getAll(skip?: number, limit?: number, managerId?: number): Promise<{ total: number; questionnaires: ClientQuestionnaire[] }> {
    const params = new URLSearchParams();
    if (skip !== undefined) params.append("skip", skip.toString());
    if (limit !== undefined) params.append("limit", limit.toString());
    if (managerId !== undefined) params.append("manager_id", managerId.toString());
    return apiFetch<{ total: number; questionnaires: ClientQuestionnaire[] }>(`/questionnaires?${params.toString()}`);
  },

  async getById(id: number): Promise<ClientQuestionnaire> {
    return apiFetch<ClientQuestionnaire>(`/questionnaires/${id}`);
  },

  async create(data: ClientQuestionnaireCreate): Promise<ClientQuestionnaire> {
    return apiFetch<ClientQuestionnaire>("/questionnaires", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async update(id: number, data: ClientQuestionnaireUpdate): Promise<ClientQuestionnaire> {
    return apiFetch<ClientQuestionnaire>(`/questionnaires/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async delete(id: number): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/questionnaires/${id}`, {
      method: "DELETE",
    });
  },

  async getClientQuestionnaires(clientId: number): Promise<{ total: number; questionnaires: ClientQuestionnaire[] }> {
    return apiFetch<{ total: number; questionnaires: ClientQuestionnaire[] }>(`/clients/${clientId}/questionnaires`);
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

// ========== Checklist Types ==========

export interface Checklist {
  id: number;
  checklist_type: "box" | "catering";
  client_id?: number;
  kp_id?: number;
  manager_id?: number;
  
  // Дата
  event_date?: string;
  
  // Контакт
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  
  // Формат заходу
  event_format?: string;
  
  // Привід/причина святкування
  event_reason?: string;
  
  // Номер замовлення (бокси)
  order_number?: string;
  
  // Час доставки / Час початку
  delivery_time?: string;
  
  // Тривалість заходу
  event_duration?: string;
  
  // Кур'єр/персонал
  needs_courier?: boolean;
  personnel_notes?: string;
  
  // Локація
  location_address?: string;
  location_floor?: string;
  location_elevator?: boolean;
  
  // К-кість гостей
  guest_count?: number;
  
  // Бюджет
  budget?: string;
  budget_amount?: number;
  
  // Обладнання (кейтеринг)
  equipment_furniture?: boolean;
  equipment_tablecloths?: boolean;
  equipment_disposable_dishes?: boolean;
  equipment_glass_dishes?: boolean;
  equipment_notes?: string;
  
  // Побажання щодо страв
  food_hot?: boolean;
  food_cold?: boolean;
  food_salads?: boolean;
  food_garnish?: boolean;
  food_sweet?: boolean;
  food_vegetarian?: boolean;
  food_vegan?: boolean;
  food_preference?: string;
  food_notes?: string;
  
  // Загальний коментар
  general_comment?: string;
  
  // Напої та алкоголь
  drinks_notes?: string;
  alcohol_notes?: string;
  
  // Знижка та націнка
  discount_notes?: string;
  surcharge_notes?: string;
  
  // Статус
  status?: string;
  
  // Метадані
  created_at?: string;
  updated_at?: string;
  
  // Додаткові поля для відображення
  client_name?: string;
  manager_name?: string;
}

export interface ChecklistCreate {
  checklist_type: "box" | "catering";
  client_id?: number;
  manager_id?: number;
  event_date?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  event_format?: string;
  event_reason?: string;
  order_number?: string;
  delivery_time?: string;
  event_duration?: string;
  needs_courier?: boolean;
  personnel_notes?: string;
  location_address?: string;
  location_floor?: string;
  location_elevator?: boolean;
  guest_count?: number;
  budget?: string;
  budget_amount?: number;
  equipment_furniture?: boolean;
  equipment_tablecloths?: boolean;
  equipment_disposable_dishes?: boolean;
  equipment_glass_dishes?: boolean;
  equipment_notes?: string;
  food_hot?: boolean;
  food_cold?: boolean;
  food_salads?: boolean;
  food_garnish?: boolean;
  food_sweet?: boolean;
  food_vegetarian?: boolean;
  food_vegan?: boolean;
  food_preference?: string;
  food_notes?: string;
  general_comment?: string;
  drinks_notes?: string;
  alcohol_notes?: string;
  discount_notes?: string;
  surcharge_notes?: string;
  status?: string;
}

export interface ChecklistUpdate extends Partial<ChecklistCreate> {
  kp_id?: number;
}

export interface ChecklistListResponse {
  checklists: Checklist[];
  total: number;
  box_count: number;
  catering_count: number;
}

// ========== Checklist API ==========

export const checklistsApi = {
  async getAll(
    skip?: number,
    limit?: number,
    checklistType?: "box" | "catering",
    status?: string,
    managerId?: number
  ): Promise<ChecklistListResponse> {
    const params = new URLSearchParams();
    if (skip !== undefined) params.append("skip", skip.toString());
    if (limit !== undefined) params.append("limit", limit.toString());
    if (checklistType) params.append("checklist_type", checklistType);
    if (status) params.append("status", status);
    if (managerId !== undefined) params.append("manager_id", managerId.toString());
    return apiFetch<ChecklistListResponse>(`/checklists?${params.toString()}`);
  },

  async getById(id: number): Promise<Checklist> {
    return apiFetch<Checklist>(`/checklists/${id}`);
  },

  async create(data: ChecklistCreate): Promise<Checklist> {
    return apiFetch<Checklist>("/checklists", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async update(id: number, data: ChecklistUpdate): Promise<Checklist> {
    return apiFetch<Checklist>(`/checklists/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async delete(id: number): Promise<{ message: string; id: number }> {
    return apiFetch<{ message: string; id: number }>(`/checklists/${id}`, {
      method: "DELETE",
    });
  },

  async createKP(id: number): Promise<{ message: string; kp_id: number; checklist_id: number }> {
    return apiFetch<{ message: string; kp_id: number; checklist_id: number }>(
      `/checklists/${id}/create-kp`,
      { method: "POST" }
    );
  },

  async getClientChecklists(clientId: number): Promise<{ checklists: Checklist[]; total: number }> {
    return apiFetch<{ checklists: Checklist[]; total: number }>(
      `/clients/${clientId}/checklists`
    );
  },
};