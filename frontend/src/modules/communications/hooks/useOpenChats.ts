import { useState, useCallback, useEffect } from 'react';
import { type Conversation } from '../components/ConversationsSidebar';
import { type Message } from '../components/ChatArea';

export interface OpenChat {
  conversationId: string;
  conversation: Conversation;
  messages: Message[];
}

interface StoredChatState {
  conversationIds: string[];
  activeTabId: string | null;
}

interface UseOpenChatsReturn {
  openChats: OpenChat[];
  activeTabId: string | null;
  openChat: (conversation: Conversation, messages: Message[]) => void;
  closeChat: (conversationId: string) => void;
  switchToChat: (conversationId: string) => void;
  updateChatMessages: (conversationId: string, messages: Message[], conversation?: Conversation) => void;
  markChatAsRead: (conversationId: string) => void;
  getActiveChat: () => OpenChat | undefined;
  getStoredConversationIds: () => string[];
  getStoredActiveTabId: () => string | null;
}

const MAX_OPEN_TABS = 7;
const STORAGE_KEY = 'crm_open_chats';

// Helpers for localStorage
const saveToStorage = (conversationIds: string[], activeTabId: string | null) => {
  try {
    const state: StoredChatState = { conversationIds, activeTabId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save chat state to localStorage:', e);
  }
};

const loadFromStorage = (): StoredChatState | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load chat state from localStorage:', e);
  }
  return null;
};

/**
 * Hook для управління відкритими чатами (multi-tab system)
 * Підтримує:
 * - Відкриття/закриття табів
 * - Переключення між табами
 * - Максимум табів (auto-close oldest)
 * - Оновлення повідомлень
 * - Збереження стану в localStorage
 */
export function useOpenChats(): UseOpenChatsReturn {
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Save to localStorage whenever chats change
  useEffect(() => {
    if (isInitialized) {
      const conversationIds = openChats.map(c => c.conversationId);
      saveToStorage(conversationIds, activeTabId);
    }
  }, [openChats, activeTabId, isInitialized]);

  // Mark as initialized after first render
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Get stored conversation IDs for restoring
  const getStoredConversationIds = useCallback((): string[] => {
    const stored = loadFromStorage();
    return stored?.conversationIds || [];
  }, []);

  // Get stored active tab ID for restoring
  const getStoredActiveTabId = useCallback((): string | null => {
    const stored = loadFromStorage();
    return stored?.activeTabId || null;
  }, []);

  const openChat = useCallback((conversation: Conversation, messages: Message[]) => {
    setOpenChats(prev => {
      // Перевірити чи вже відкритий
      const exists = prev.find(c => c.conversationId === conversation.id);
      if (exists) {
        // Оновити повідомлення
        return prev.map(c =>
          c.conversationId === conversation.id
            ? { ...c, messages }
            : c
        );
      }

      // Якщо досягнуто максимум - закрити найстаріший неактивний таб
      let updated = prev;
      if (prev.length >= MAX_OPEN_TABS) {
        const oldestInactive = prev.find(c => c.conversationId !== activeTabId);
        if (oldestInactive) {
          updated = prev.filter(c => c.conversationId !== oldestInactive.conversationId);
        }
      }

      // Додати новий таб
      return [...updated, {
        conversationId: conversation.id,
        conversation,
        messages,
      }];
    });
    setActiveTabId(conversation.id);
  }, [activeTabId]);

  const closeChat = useCallback((conversationId: string) => {
    setOpenChats(prev => {
      const filtered = prev.filter(c => c.conversationId !== conversationId);

      // Auto-switch to last tab if closing active
      if (activeTabId === conversationId && filtered.length > 0) {
        setActiveTabId(filtered[filtered.length - 1].conversationId);
      } else if (filtered.length === 0) {
        setActiveTabId(null);
      }

      return filtered;
    });
  }, [activeTabId]);

  const switchToChat = useCallback((conversationId: string) => {
    setActiveTabId(conversationId);
  }, []);

  const updateChatMessages = useCallback((conversationId: string, messages: Message[], conversation?: Conversation) => {
    setOpenChats(prev =>
      prev.map(chat =>
        chat.conversationId === conversationId
          ? { 
              ...chat, 
              messages,
              ...(conversation && { conversation })
            }
          : chat
      )
    );
  }, []);

  const markChatAsRead = useCallback((conversationId: string) => {
    setOpenChats(prev =>
      prev.map(chat =>
        chat.conversationId === conversationId
          ? { 
              ...chat, 
              conversation: {
                ...chat.conversation,
                unread_count: 0
              }
            }
          : chat
      )
    );
  }, []);

  const getActiveChat = useCallback(() => {
    return openChats.find(chat => chat.conversationId === activeTabId);
  }, [openChats, activeTabId]);

  return {
    openChats,
    activeTabId,
    openChat,
    closeChat,
    switchToChat,
    updateChatMessages,
    markChatAsRead,
    getActiveChat,
    getStoredConversationIds,
    getStoredActiveTabId,
  };
}

