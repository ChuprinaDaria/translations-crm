/**
 * Design Tokens - централізовані дизайн-значення для unified inbox
 */

export const colors = {
  // Source colors
  telegram: '#0088cc',
  whatsapp: '#25D366',
  email: '#EA4335',
  facebook: '#1877F2',
  instagram: '#E4405F',
  
  // Neutral
  gray: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  
  // Status
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Brand
  primary: '#FF5A00',
  primaryHover: '#FF5A00',
}

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
}

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  full: '9999px',
}

export const typography = {
  fontFamily: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"SF Mono", "Monaco", "Cascadia Code", monospace',
  },
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
}

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
}

export const breakpoints = {
  mobile: '640px',    // Sidebar стає drawer
  tablet: '1024px',   // Context panel toggle
  desktop: '1280px',  // Full 3-column
}

/**
 * Отримати колір платформи
 */
export function getPlatformColor(platform: string): string {
  const platformLower = platform.toLowerCase();
  switch (platformLower) {
    case 'telegram':
      return colors.telegram;
    case 'whatsapp':
      return colors.whatsapp;
    case 'email':
      return colors.email;
    case 'facebook':
      return colors.facebook;
    case 'instagram':
      return colors.instagram;
    default:
      return colors.gray[500];
  }
}

