/**
 * Facebook SDK for JavaScript - Utility functions
 * 
 * This module provides utilities for initializing and using the Facebook SDK
 * that is loaded asynchronously in index.html
 */

/**
 * Facebook Auth Response structure
 */
export interface FacebookAuthResponse {
  accessToken?: string;
  expiresIn?: number;
  signedRequest?: string;
  userID?: string;
  code?: string;  // Authorization code for Business Integration System User tokens
}

/**
 * Facebook Login Status Response
 */
export interface FacebookLoginStatusResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse?: FacebookAuthResponse;
}

declare global {
  interface Window {
    FB?: {
      init: (config: {
        appId: string;
        cookie?: boolean;
        xfbml?: boolean;
        version: string;
        autoLogAppEvents?: boolean;
      }) => void;
      getLoginStatus: (
        callback: (response: FacebookLoginStatusResponse) => void,
        force?: boolean
      ) => void;
      login: (
        callback: (response: FacebookLoginStatusResponse) => void,
        options?: { 
          scope?: string;
          config_id?: string;
          response_type?: string;
          override_default_response_type?: boolean;
        }
      ) => void;
      logout: (callback: (response: { status: string }) => void) => void;
      api: (path: string, callback: (response: any) => void) => void;
      AppEvents: {
        logPageView: () => void;
        logEvent: (eventName: string, valueToSum?: number, parameters?: Record<string, any>) => void;
      };
      Event: {
        subscribe: (event: string, callback: (response: any) => void) => void;
        unsubscribe: (event: string, callback: (response: any) => void) => void;
      };
    };
    fbAsyncInit?: () => void;
  }
}

/**
 * Initialize Facebook SDK with App ID
 * @param appId - Facebook App ID from settings
 */
export function initFacebookSDK(appId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!appId) {
      console.warn('Facebook App ID not provided, skipping SDK initialization');
      resolve();
      return;
    }

    // Check if SDK is already loaded
    if (window.FB) {
      // SDK already loaded, just initialize
      try {
        window.FB.init({
          appId: appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: 'v24.0'
        });
        
        // Log page view for analytics
        if (window.FB.AppEvents && window.FB.AppEvents.logPageView) {
          window.FB.AppEvents.logPageView();
        }
        
        console.log('Facebook SDK initialized with App ID:', appId);
        resolve();
      } catch (error) {
        console.error('Error initializing Facebook SDK:', error);
        reject(error);
      }
      return;
    }

    // SDK not loaded yet, wait for it
    const originalFbAsyncInit = window.fbAsyncInit;
    
    window.fbAsyncInit = function() {
      // Call original if it exists
      if (originalFbAsyncInit) {
        originalFbAsyncInit();
      }

      // Initialize with App ID
      if (window.FB) {
        try {
          window.FB.init({
            appId: appId,
            autoLogAppEvents: true,
            xfbml: true,
            version: 'v24.0'
          });
          
          // Log page view for analytics
          if (window.FB.AppEvents && window.FB.AppEvents.logPageView) {
            window.FB.AppEvents.logPageView();
          }
          
          console.log('Facebook SDK initialized with App ID:', appId);
          resolve();
        } catch (error) {
          console.error('Error initializing Facebook SDK:', error);
          reject(error);
        }
      } else {
        reject(new Error('Facebook SDK not available'));
      }
    };

    // If SDK loads before we set fbAsyncInit, initialize immediately
    const checkInterval = setInterval(() => {
      if (window.FB && window.FB.init) {
        clearInterval(checkInterval);
        try {
          window.FB.init({
            appId: appId,
            autoLogAppEvents: true,
            xfbml: true,
            version: 'v24.0'
          });
          
          // Log page view for analytics
          if (window.FB.AppEvents && window.FB.AppEvents.logPageView) {
            window.FB.AppEvents.logPageView();
          }
          
          console.log('Facebook SDK initialized with App ID:', appId);
          resolve();
        } catch (error) {
          console.error('Error initializing Facebook SDK:', error);
          reject(error);
        }
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!window.FB) {
        reject(new Error('Facebook SDK failed to load within 10 seconds'));
      }
    }, 10000);
  });
}

/**
 * Check if Facebook SDK is loaded and initialized
 */
export function isFacebookSDKReady(): boolean {
  return typeof window !== 'undefined' && !!window.FB;
}

/**
 * Get Facebook SDK instance
 */
export function getFacebookSDK() {
  if (!isFacebookSDKReady()) {
    throw new Error('Facebook SDK is not loaded. Call initFacebookSDK first.');
  }
  return window.FB!;
}

/**
 * Log page view event for Facebook Analytics
 * Should be called after SDK initialization and on route changes
 */
export function logFacebookPageView(): void {
  if (!isFacebookSDKReady()) {
    console.warn('Facebook SDK not ready, skipping page view log');
    return;
  }

  try {
    const FB = getFacebookSDK();
    if (FB.AppEvents && FB.AppEvents.logPageView) {
      FB.AppEvents.logPageView();
    }
  } catch (error) {
    console.error('Error logging Facebook page view:', error);
  }
}

/**
 * Get the current login status of the user
 * @param force - Force a fresh check (bypass cache)
 * @returns Promise with login status response
 */
export function getFacebookLoginStatus(force: boolean = false): Promise<FacebookLoginStatusResponse> {
  return new Promise((resolve, reject) => {
    if (!isFacebookSDKReady()) {
      reject(new Error('Facebook SDK is not loaded. Call initFacebookSDK first.'));
      return;
    }

    try {
      const FB = getFacebookSDK();
      FB.getLoginStatus((response: FacebookLoginStatusResponse) => {
        resolve(response);
      }, force);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Check if user is connected to Facebook and the app
 */
export async function isFacebookConnected(): Promise<boolean> {
  try {
    const status = await getFacebookLoginStatus();
    return status.status === 'connected' && !!status.authResponse;
  } catch (error) {
    console.error('Error checking Facebook connection:', error);
    return false;
  }
}

/**
 * Prompt user to login with Facebook
 * @param scope - Comma-separated list of permissions (e.g., 'email,public_profile')
 * @returns Promise with login status response
 */
export function loginWithFacebook(scope?: string): Promise<FacebookLoginStatusResponse> {
  return new Promise((resolve, reject) => {
    if (!isFacebookSDKReady()) {
      reject(new Error('Facebook SDK is not loaded. Call initFacebookSDK first.'));
      return;
    }

    try {
      const FB = getFacebookSDK();
      FB.login((response: FacebookLoginStatusResponse) => {
        if (response.status === 'connected' && response.authResponse) {
          resolve(response);
        } else {
          reject(new Error(`Login failed with status: ${response.status}`));
        }
      }, scope ? { scope } : undefined);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Prompt user to login with Facebook for Business (using config_id)
 * This is the preferred method for business applications that need access to business assets
 * @param configId - Configuration ID from Meta App Dashboard (Facebook Login for Business)
 * @param useSystemUserToken - If true, requests Business Integration System User access token (requires response_type: 'code')
 * @returns Promise with login status response
 */
export function loginWithFacebookForBusiness(
  configId: string,
  useSystemUserToken: boolean = false
): Promise<FacebookLoginStatusResponse> {
  return new Promise((resolve, reject) => {
    if (!isFacebookSDKReady()) {
      reject(new Error('Facebook SDK is not loaded. Call initFacebookSDK first.'));
      return;
    }

    if (!configId) {
      reject(new Error('config_id is required for Facebook Login for Business'));
      return;
    }

    try {
      const FB = getFacebookSDK();
      const options: {
        config_id: string;
        response_type?: string;
        override_default_response_type?: boolean;
      } = {
        config_id: configId,
      };

      // For Business Integration System User tokens, we need response_type: 'code'
      if (useSystemUserToken) {
        options.response_type = 'code';
        options.override_default_response_type = true;
      }

      FB.login((response: FacebookLoginStatusResponse) => {
        if (response.status === 'connected' && response.authResponse) {
          resolve(response);
        } else {
          reject(new Error(`Login failed with status: ${response.status}`));
        }
      }, options);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Login with Facebook for Business using config_id from settings
 * Automatically fetches config_id from backend settings
 * @param useSystemUserToken - If true, requests Business Integration System User access token (requires response_type: 'code')
 * @returns Promise with login status response containing code (if useSystemUserToken is true)
 */
export async function loginWithFacebookForBusinessFromSettings(
  useSystemUserToken: boolean = true
): Promise<FacebookLoginStatusResponse & { code?: string }> {
  // Import settingsApi dynamically to avoid circular dependencies
  const { settingsApi } = await import('./api');
  
  try {
    // Отримуємо config_id з налаштувань
    const facebookConfig = await settingsApi.getFacebookConfig();
    
    if (!facebookConfig.config_id) {
      throw new Error('Facebook config_id не налаштовано. Будь ласка, введіть Config ID в Settings → Facebook.');
    }

    // Викликаємо login з config_id
    const response = await loginWithFacebookForBusiness(
      facebookConfig.config_id,
      useSystemUserToken
    );

    // Якщо використовуємо системний токен, код буде в authResponse.code
    if (useSystemUserToken && response.authResponse) {
      const code = (response.authResponse as any).code;
      // Для WhatsApp Business Messaging може бути redirect_uri в authResponse
      const redirectUri = (response.authResponse as any).redirect_uri;
      if (code) {
        return { ...response, code, redirect_uri: redirectUri };
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
}

/**
 * Exchange authorization code for access token
 * @param code - Authorization code received from FB.login()
 * @returns Promise with access token and business account information
 */
export async function exchangeFacebookCodeForToken(code: string): Promise<{
  access_token: string;
  pages: Array<{
    page_id: string;
    page_name: string;
    page_access_token: string;
  }>;
  whatsapp_accounts: Array<{
    waba_id: string;
    page_id: string;
    page_name: string;
  }>;
}> {
  const { settingsApi } = await import('./api');
  return settingsApi.exchangeFacebookCode(code);
}

/**
 * Generate WhatsApp Business onboarding URL
 * @param appId - Facebook App ID
 * @param configId - Facebook Login for Business configuration ID
 * @param features - Optional array of feature names (e.g., ['marketing_messages_lite', 'app_only_install'])
 * @returns WhatsApp Business onboarding URL
 */
export function generateWhatsAppOnboardingURL(
  appId: string,
  configId: string,
  features: string[] = ['marketing_messages_lite', 'app_only_install']
): string {
  const baseURL = 'https://business.facebook.com/messaging/whatsapp/onboard/';
  
  const extras = {
    featureType: 'whatsapp_business_app_onboarding',
    sessionInfoVersion: '3',
    version: 'v3',
    features: features.map(name => ({ name })),
  };
  
  const params = new URLSearchParams({
    app_id: appId,
    config_id: configId,
    extras: JSON.stringify(extras),
  });
  
  return `${baseURL}?${params.toString()}`;
}

/**
 * Open WhatsApp Business onboarding page using settings from backend
 * Automatically fetches app_id and config_id from settings
 * @param features - Optional array of feature names
 */
export async function openWhatsAppOnboarding(
  features: string[] = ['marketing_messages_lite', 'app_only_install']
): Promise<void> {
  const { settingsApi } = await import('./api');
  
  try {
    // Отримуємо налаштування Facebook
    const facebookConfig = await settingsApi.getFacebookConfig();
    
    if (!facebookConfig.app_id) {
      throw new Error('Facebook App ID не налаштовано. Будь ласка, введіть App ID в Settings → Facebook.');
    }
    
    if (!facebookConfig.config_id) {
      throw new Error('Facebook Config ID не налаштовано. Будь ласка, введіть Config ID в Settings → Facebook.');
    }
    
    // Генеруємо URL та відкриваємо в новому вікні
    const onboardingURL = generateWhatsAppOnboardingURL(
      facebookConfig.app_id,
      facebookConfig.config_id,
      features
    );
    
    // Відкриваємо onboarding в новому вікні
    window.open(onboardingURL, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Помилка відкриття WhatsApp onboarding:', error);
    throw error;
  }
}

/**
 * Logout from Facebook
 */
export function logoutFromFacebook(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isFacebookSDKReady()) {
      reject(new Error('Facebook SDK is not loaded. Call initFacebookSDK first.'));
      return;
    }

    try {
      const FB = getFacebookSDK();
      FB.logout((response: { status: string }) => {
        console.log('Facebook logout successful:', response);
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

