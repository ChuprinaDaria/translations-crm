import { useState, useCallback } from 'react';
import { type Conversation } from '../components/ConversationsSidebar';
import { type Message } from '../components/ChatArea';

export interface OpenChat {
  conversationId: string;
  conversation: Conversation;
  messages: Message[];
}

interface UseOpenChatsReturn {
  openChats: OpenChat[];
  activeTabId: string | null;
  openChat: (conversation: Conversation, messages: Message[]) => void;
  closeChat: (conversationId: string) => void;
  switchToChat: (conversationId: string) => void;
  updateChatMessages: (conversationId: string, messages: Message[]) => void;
  getActiveChat: () => OpenChat | undefined;
}

const MAX_OPEN_TABS = 7;

/**
 * Hook для управління відкритими чатами (multi-tab system)
 * Підтримує:
 * - Відкриття/закриття табів
 * - Переключення між табами
 * - Максимум табів (auto-close oldest)
 * - Оновлення повідомлень
 */
export function useOpenChats(): UseOpenChatsReturn {
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

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

  const updateChatMessages = useCallback((conversationId: string, messages: Message[]) => {
    setOpenChats(prev =>
      prev.map(chat =>
        chat.conversationId === conversationId
          ? { ...chat, messages }
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
    getActiveChat,
  };
}

