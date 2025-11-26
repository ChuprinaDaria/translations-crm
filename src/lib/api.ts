// API Configuration and Helper Functions

// Use relative path /api for proxy (configured on web server)
// Web server should proxy /api/* to http://157.180.36.97:8000/*
const API_BASE_URL = '/api';

// Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
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
  price: number;
  weight?: number;
  unit?: string;
  photo_url?: string;
  active: boolean;
  subcategory_id: number;
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
    return apiFetch<Item>('/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateItem(itemId: number, data: Partial<ItemCreate>): Promise<Item> {
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
  }
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
  }
};