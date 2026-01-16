// Token Management

const TOKEN_KEY = 'auth_token';

// JWT helpers (frontend only)
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    // payload is almost always ASCII JSON; handle UTF-8 just in case
    try {
      return JSON.parse(binary);
    } catch {
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const text = new TextDecoder().decode(bytes);
      return JSON.parse(text);
    }
  } catch {
    return null;
  }
}

// JWT expiration check helper
function isJwtExpired(token: string, leewaySeconds: number = 30): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return false; // якщо exp нема — не блокуємо
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + leewaySeconds;
}

export const tokenManager = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    console.log('Saving token to localStorage:', token?.substring(0, 20) + '...');
    localStorage.setItem(TOKEN_KEY, token);
    console.log('[TokenManager] Token saved');
    
    // Dispatch event for auth state change
    window.dispatchEvent(new CustomEvent("auth:token-changed", { detail: { action: "set" } }));
  },

  removeToken(): void {
    if (typeof window === 'undefined') return;
    console.log('Removing token from localStorage');
    localStorage.removeItem(TOKEN_KEY);
    console.log('[TokenManager] Token removed');
    
    // Dispatch event for auth state change
    window.dispatchEvent(new CustomEvent("auth:token-changed", { detail: { action: "remove" } }));
    window.dispatchEvent(new CustomEvent("auth:logout"));
  },

  isAuthenticated(): boolean {
    const token = this.getToken();
    const hasToken = !!token;
    if (!hasToken) {
      console.log('[TokenManager] Is authenticated:', false);
      return false;
    }
    if (token && isJwtExpired(token)) {
      console.log("[Auth] Token expired - logging out");
      this.removeToken();
      console.log('[TokenManager] Is authenticated:', false);
      return false;
    }
    console.log('[TokenManager] Is authenticated:', true);
    return true;
  },
};

// Convenience function for direct import
export function getToken(): string | null {
  return tokenManager.getToken();
}

