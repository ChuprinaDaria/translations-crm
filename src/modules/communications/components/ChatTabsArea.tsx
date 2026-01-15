import React from 'react';
import { MessageSquare } from 'lucide-react';
import { ChatTab, type Conversation } from './ChatTab';
import { ChatArea, type Message } from './ChatArea';
import { EmptyStates } from './EmptyState';
import { cn } from '../../../components/ui/utils';

interface OpenChat {
  conversationId: string;
  conversation: Conversation;
  messages: Message[];
}

interface ChatTabsAreaProps {
  openChats: OpenChat[];
  activeTabId: string | null;
  onTabChange: (id: string) => void;
  onTabClose: (id: string) => void;
  onSendMessage: (conversationId: string, content: string, attachments?: File[]) => void;
  onQuickAction?: (conversationId: string, action: string, data?: Record<string, any>) => void;
  isLoading?: boolean;
}

/**
 * Multi-tab Chat Area з табами для кількох відкритих розмов
 */
export function ChatTabsArea({
  openChats,
  activeTabId,
  onTabChange,
  onTabClose,
  onSendMessage,
  onQuickAction,
  isLoading = false,
}: ChatTabsAreaProps) {
  if (openChats.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <EmptyStates.NoMessages />
      </div>
    );
  }

  const activeChat = openChats.find(chat => chat.conversationId === activeTabId);

  return (
    <div className="h-full flex flex-col">
      {/* Tabs Header */}
      <div className="flex items-center bg-gray-50 border-b border-gray-200 overflow-x-auto flex-shrink-0">
        {openChats.map((chat) => (
          <ChatTab
            key={chat.conversationId}
            conversation={chat.conversation}
            isActive={activeTabId === chat.conversationId}
            hasNewMessages={(chat.conversation.unread_count || 0) > 0}
            onClick={() => onTabChange(chat.conversationId)}
            onClose={() => onTabClose(chat.conversationId)}
          />
        ))}
      </div>

      {/* Active Chat Content */}
      <div className="flex-1 min-h-0 bg-white">
        {openChats.map((chat) => (
          <div
            key={chat.conversationId}
            className={cn(
              'h-full',
              activeTabId === chat.conversationId ? 'flex flex-col' : 'hidden'
            )}
          >
            <ChatArea
              conversation={chat.conversation}
              messages={chat.messages}
              onSendMessage={(content, attachments) => 
                onSendMessage(chat.conversationId, content, attachments)
              }
              isLoading={isLoading}
              onQuickAction={(action, data) => 
                onQuickAction?.(chat.conversationId, action, data)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

