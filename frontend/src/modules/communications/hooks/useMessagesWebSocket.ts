/**
 * WebSocket hook for real-time message updates
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { Message, ConversationListItem } from '../api/inbox';

export interface WebSocketMessage {
  type: 'new_message' | 'message_status' | 'conversation_update' | 'connection_established' | 'manager_assigned';
  conversation_id?: string;
  message?: Message;
  conversation?: Partial<ConversationListItem>;
  manager_id?: string;
  manager_name?: string;
  timestamp?: string;
}

interface UseMessagesWebSocketOptions {
  userId: string;
  onNewMessage?: (message: Message, conversationId: string) => void;
  onConversationUpdate?: (conversation: Partial<ConversationListItem>) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useMessagesWebSocket({
  userId,
  onNewMessage,
  onConversationUpdate,
  onConnect,
  onDisconnect,
}: UseMessagesWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  // Store callbacks in refs to avoid re-creating connection on callback changes
  const onNewMessageRef = useRef(onNewMessage);
  const onConversationUpdateRef = useRef(onConversationUpdate);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  
  // Update refs when callbacks change
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onConversationUpdateRef.current = onConversationUpdate;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onNewMessage, onConversationUpdate, onConnect, onDisconnect]);

  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In production, use the same host without port (nginx handles routing)
    // In development, use port 8000
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const host = isProduction 
      ? window.location.host  // Production: tlumaczeniamt.com.pl (nginx proxies to backend)
      : `${window.location.hostname}:8000`;  // Development: localhost:8000
    const wsUrl = `${protocol}//${host}/api/v1/communications/ws/${userId}`;

    console.log('[WebSocket] Connecting to:', wsUrl);
    
    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        onConnectRef.current?.();

        // Clear any pending reconnect
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      wsRef.current.onmessage = (event) => {
        // Handle ping/pong для keep-alive з'єднання
        // Сервер може надсилати як рядок 'ping', так і JSON {"type":"ping"}
        if (event.data === 'ping') {
          wsRef.current?.send('pong');
          return;
        }
        
        if (event.data === 'pong') {
          return;
        }
        
        try {
          const data = JSON.parse(event.data);
          
          // Handle JSON ping from server: {"type": "ping"}
          if (data.type === 'ping') {
            wsRef.current?.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          
          console.log('[WebSocket] Message received:', data);
          setLastMessage(data);

          if (data.type === 'new_message' && data.message && data.conversation_id) {
            // Передаємо platform дані в message для використання в нотифікаціях
            const messageWithPlatform = {
              ...data.message,
              wsData: {
                platform: data.platform,
                platform_icon: data.platform_icon,
                platform_name: data.platform_name,
              }
            };
            onNewMessageRef.current?.(messageWithPlatform, data.conversation_id);
          }

          if (data.type === 'conversation_update' && data.conversation) {
            onConversationUpdateRef.current?.(data.conversation);
          }

          if (data.type === 'manager_assigned' && data.conversation_id) {
            // Handle manager assignment as a conversation update
            onConversationUpdateRef.current?.({
              id: data.conversation_id,
              assigned_manager_id: data.manager_id,
            });
          }
        } catch (e) {
          console.error('[WebSocket] Failed to parse message:', e, event.data);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        onDisconnectRef.current?.();

        // Don't reconnect on clean close (1000) or if manually closed
        if (event.code === 1000) {
          return;
        }

        // For abnormal closures (1006, 1012), wait longer before reconnecting
        // These usually indicate server issues
        const isAbnormalClosure = event.code === 1006 || event.code === 1012;
        const reconnectDelay = isAbnormalClosure ? 10000 : 5000; // 10s for abnormal, 5s for others

        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WebSocket] Attempting to reconnect...');
            reconnectTimeoutRef.current = null;
            connect();
          }, reconnectDelay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        // Error event doesn't provide much info, but we'll let onclose handle reconnection
        // This is usually followed by an onclose event with code 1006
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
    }
  }, [userId]); // Only depends on userId

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounting'); // Clean close
      wsRef.current = null;
    }
  }, []);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('ping');
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    // Send ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(sendPing, 30000);

    return () => {
      clearInterval(pingInterval);
      disconnect();
    };
  }, [userId]); // Only reconnect if userId changes

  return {
    isConnected,
    lastMessage,
    connect,
    disconnect,
  };
}
