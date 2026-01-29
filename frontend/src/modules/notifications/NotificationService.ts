/**
 * WebSocket Notification Service
 * Manages real-time notifications via WebSocket connection
 */

import { toast } from "sonner";
import { handleNotificationNavigation } from "./utils/navigation";

export interface Notification {
  type: string;
  title: string;
  message: string;
  action_url?: string;
  sound?: boolean;
  [key: string]: any;
}

class NotificationService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private userId: string | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(userId: string) {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      console.log("[NotificationService] Already connected or connecting");
      return;
    }

    this.userId = userId;
    this.isConnecting = true;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = import.meta.env.VITE_WS_PORT || "8000";
    const wsUrl = `${protocol}//${host}:${port}/api/v1/notifications/ws/${userId}`;

    console.log(`[NotificationService] Connecting to ${wsUrl}`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("[NotificationService] Connected");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        if (event.data === "pong") {
          // Ignore pong messages
          return;
        }

        try {
          const notification: Notification = JSON.parse(event.data);
          this.handleNotification(notification);
        } catch (error) {
          console.error("[NotificationService] Failed to parse notification:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[NotificationService] WebSocket error:", error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        console.log("[NotificationService] Disconnected");
        this.isConnecting = false;
        this.stopPing();
        this.attemptReconnect();
      };
    } catch (error) {
      console.error("[NotificationService] Failed to create WebSocket:", error);
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    console.log("[NotificationService] Disconnecting");
    this.stopPing();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    this.userId = null;
  }

  /**
   * Handle incoming notification
   */
  private handleNotification(notification: Notification) {
    console.log("[NotificationService] Received:", notification);

    // Show toast notification
    const toastId = toast(notification.title, {
      description: notification.message,
      duration: notification.sound ? 7000 : 5000,
      action: notification.action_url
        ? {
            label: "Переглянути",
            onClick: () => {
              handleNotificationNavigation(notification.action_url);
            },
          }
        : undefined,
    });

    // Play sound if enabled
    if (notification.sound && this.shouldPlaySound()) {
      this.playNotificationSound();
    }

    // Show browser notification if permission granted
    if (Notification.permission === "granted" && document.hidden) {
      this.showBrowserNotification(notification);
    }

    // Emit custom event for other components to listen
    window.dispatchEvent(
      new CustomEvent("crm-notification", { detail: notification })
    );
  }

  /**
   * Show browser notification
   */
  private showBrowserNotification(notification: Notification) {
    try {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: "/logo.png",
        badge: "/logo-small.png",
        tag: notification.type,
        requireInteraction: notification.sound || false,
      });

      if (notification.action_url) {
        browserNotification.onclick = () => {
          window.focus();
          handleNotificationNavigation(notification.action_url);
          browserNotification.close();
        };
      }
    } catch (error) {
      console.error("[NotificationService] Failed to show browser notification:", error);
    }
  }

  /**
   * Play notification sound
   */
  private playNotificationSound() {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch((err) => {
        console.error("[NotificationService] Failed to play sound:", err);
      });
    } catch (error) {
      console.error("[NotificationService] Failed to create audio:", error);
    }
  }

  /**
   * Check if sound should be played (respecting user settings and time)
   */
  private shouldPlaySound(): boolean {
    // Check if sounds are enabled in user settings
    const soundEnabled = localStorage.getItem("notification_sound_enabled");
    if (soundEnabled === "false") {
      return false;
    }

    // Check Do Not Disturb hours
    const dndSettings = localStorage.getItem("notification_dnd");
    if (dndSettings) {
      try {
        const dnd = JSON.parse(dndSettings);
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

        // Check weekend DND
        if (dnd.weekend === "all_day" && (currentDay === 0 || currentDay === 6)) {
          return false;
        }

        // Check weekday DND hours
        if (dnd.weekdays && currentDay >= 1 && currentDay <= 5) {
          const [startHour] = dnd.weekdays[0].split(":").map(Number);
          const [endHour] = dnd.weekdays[1].split(":").map(Number);
          
          if (currentHour >= startHour || currentHour < endHour) {
            return false;
          }
        }
      } catch (error) {
        console.error("[NotificationService] Failed to parse DND settings:", error);
      }
    }

    return true;
  }

  /**
   * Start sending ping messages to keep connection alive
   */
  private startPing() {
    this.stopPing();
    
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("ping");
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect() {
    if (!this.userId || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[NotificationService] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`[NotificationService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId);
      }
    }, delay);
  }

  /**
   * Request browser notification permission
   */
  static async requestPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      console.warn("[NotificationService] Browser notifications not supported");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }

    return false;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

