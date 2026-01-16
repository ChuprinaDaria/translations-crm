/**
 * WebSocket service для нотифікацій
 */
import type { WebSocketNotificationMessage } from '../types';

type NotificationCallback = (notification: WebSocketNotificationMessage['data']) => void;
type ConnectionCallback = (connected: boolean) => void;

class NotificationWebSocketService {
  private ws: WebSocket | null = null;
  private userId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isManualClose = false;
  private notificationCallbacks: Set<NotificationCallback> = new Set();
  private connectionCallbacks: Set<ConnectionCallback> = new Set();

  /**
   * Підключитися до WebSocket
   */
  connect(userId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.userId === userId) {
      console.log('[WebSocket] Already connected');
      return;
    }

    this.userId = userId;
    this.isManualClose = false;
    this.reconnectAttempts = 0;

    this._connect();
  }

  private _connect(): void {
    if (!this.userId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // TODO: Додати токен до URL для автентифікації
    // const token = getToken();
    // const wsUrl = `${protocol}//${host}/api/v1/notifications/ws/${this.userId}?token=${token}`;
    const wsUrl = `${protocol}//${host}/api/v1/notifications/ws/${this.userId}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this._notifyConnectionCallbacks(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketNotificationMessage = JSON.parse(event.data);
          
          if (message.type === 'notification') {
            this._notifyNotificationCallbacks(message.data);
          } else if (event.data === 'pong') {
            // Ping/pong response
            console.log('[WebSocket] Received pong');
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this._notifyConnectionCallbacks(false);
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this._notifyConnectionCallbacks(false);
        this.ws = null;

        // Автоматичне переподключення
        if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(
            `[WebSocket] Reconnecting in ${this.reconnectDelay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
          );
          this.reconnectTimer = setTimeout(() => {
            this._connect();
          }, this.reconnectDelay);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this._notifyConnectionCallbacks(false);
    }
  }

  /**
   * Відключитися від WebSocket
   */
  disconnect(): void {
    this.isManualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.userId = null;
  }

  /**
   * Підписатися на нотифікації
   */
  onNotification(callback: NotificationCallback): () => void {
    this.notificationCallbacks.add(callback);
    return () => {
      this.notificationCallbacks.delete(callback);
    };
  }

  /**
   * Підписатися на зміни стану з'єднання
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  /**
   * Перевірити чи підключено
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private _notifyNotificationCallbacks(notification: WebSocketNotificationMessage['data']): void {
    this.notificationCallbacks.forEach((callback) => {
      try {
        callback(notification);
      } catch (error) {
        console.error('[WebSocket] Error in notification callback:', error);
      }
    });
  }

  private _notifyConnectionCallbacks(connected: boolean): void {
    this.connectionCallbacks.forEach((callback) => {
      try {
        callback(connected);
      } catch (error) {
        console.error('[WebSocket] Error in connection callback:', error);
      }
    });
  }

  /**
   * Відправити ping (для підтримки з'єднання)
   */
  ping(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send('ping');
    }
  }
}

// Singleton instance
export const notificationWebSocket = new NotificationWebSocketService();

