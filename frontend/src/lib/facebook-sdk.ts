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
  accessToken: string;
  expiresIn: number;
  signedRequest: string;
  userID: string;
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
      }) => void;
      getLoginStatus: (
        callback: (response: FacebookLoginStatusResponse) => void,
        force?: boolean
      ) => void;
      login: (
        callback: (response: FacebookLoginStatusResponse) => void,
        options?: { scope?: string }
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
          cookie: true,
          xfbml: true,
          version: 'v18.0'
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
            cookie: true,
            xfbml: true,
            version: 'v18.0'
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
            cookie: true,
            xfbml: true,
            version: 'v18.0'
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

