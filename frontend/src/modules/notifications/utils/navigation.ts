/**
 * Utility functions for handling notification navigation
 */

/**
 * Handle navigation from notification action_url
 * Supports:
 * - /inbox/{conversation_id} - navigate to inbox and open conversation
 * - /orders/{order_id} - navigate to CRM and select order
 * - /communications?conversation={conversation_id} - navigate to inbox and open conversation
 * - /clients/{client_id} - navigate to clients page and select client
 */
export function handleNotificationNavigation(actionUrl: string | null | undefined): void {
  if (!actionUrl) {
    return;
  }

  // Parse /inbox/{conversation_id}
  if (actionUrl.startsWith('/inbox/')) {
    const conversationId = actionUrl.split('/inbox/')[1];
    if (conversationId) {
      // Navigate to inbox page
      window.dispatchEvent(
        new CustomEvent('command:navigate', { detail: { path: '/inbox' } })
      );
      
      // Dispatch event to open conversation after a short delay
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('navigate:conversation', { detail: { conversationId } })
        );
      }, 200);
      return;
    }
  }

  // Parse /communications/inbox?conversation_id={conversation_id}
  if (actionUrl.startsWith('/communications')) {
    const url = new URL(actionUrl, window.location.origin);
    const conversationId = url.searchParams.get('conversation_id') || url.searchParams.get('conversation');
    if (conversationId) {
      // Navigate to inbox page
      window.dispatchEvent(
        new CustomEvent('command:navigate', { detail: { path: '/inbox' } })
      );
      
      // Dispatch event to open conversation after a short delay
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('navigate:conversation', { detail: { conversationId } })
        );
      }, 200);
      return;
    }
  }

  // Parse /orders/{order_id}
  if (actionUrl.startsWith('/orders/')) {
    const orderId = actionUrl.split('/orders/')[1];
    if (orderId) {
      window.dispatchEvent(
        new CustomEvent('command:navigate', { detail: { path: '/crm', kpId: orderId } })
      );
      return;
    }
  }

  // Parse /clients/{client_id}
  if (actionUrl.startsWith('/clients/')) {
    const clientId = actionUrl.split('/clients/')[1];
    if (clientId) {
      window.dispatchEvent(
        new CustomEvent('command:navigate', { detail: { path: `/clients/${clientId}` } })
      );
      return;
    }
  }

  // Fallback: use window.location.href for other URLs
  window.location.href = actionUrl;
}

