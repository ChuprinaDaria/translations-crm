import React, { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { ConversationItem } from './ConversationItem';
import { Skeleton } from '../../../components/ui/skeleton';
import { cn } from '../../../components/ui/utils';

export type FilterType = 'all' | 'new' | 'in_progress' | 'needs_reply' | 'archived';

export interface FilterState {
  type: FilterType;
  platform?: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
  search?: string;
}

export interface Conversation {
  id: string;
  platform: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
  external_id: string;
  subject?: string;
  client_id?: string;
  client_name?: string;
  client_avatar?: string;
  unread_count: number;
  last_message?: string;
  last_message_at?: string;
  updated_at: string;
}

interface ConversationsSidebarProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  isLoading?: boolean;
}

/**
 * Бічна панель зі списком розмов
 * Структура:
 * 1. Filter tabs (Всі, Нові, В роботі, Архів)
 * 2. Search input
 * 3. Scrollable list of ConversationItem
 * 4. Loading skeleton states
 */
export function ConversationsSidebar({
  conversations,
  selectedId,
  onSelect,
  filters,
  onFilterChange,
  isLoading = false,
}: ConversationsSidebarProps) {
  const [localSearch, setLocalSearch] = useState('');

  const handleFilterChange = (type: FilterType) => {
    onFilterChange({ ...filters, type });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    onFilterChange({ ...filters, search: value });
  };

  const filteredConversations = conversations.filter((conv) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        conv.client_name?.toLowerCase().includes(searchLower) ||
        conv.last_message?.toLowerCase().includes(searchLower) ||
        conv.external_id.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    if (filters.platform && conv.platform !== filters.platform) {
      return false;
    }

    switch (filters.type) {
      case 'new':
        return conv.unread_count > 0;
      case 'in_progress':
        // TODO: Implement logic based on conversation status
        return true;
      case 'needs_reply':
        // TODO: Implement logic - last message is inbound and not replied
        return conv.unread_count > 0;
      case 'archived':
        // TODO: Implement archived logic
        return false;
      default:
        return true;
    }
  });

  // Calculate unread total
  const unreadTotal = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter Tabs - Horizontal Segment Control */}
      <div className="p-1.5 border-b border-gray-200 flex-shrink-0 bg-white">
        <div className="flex bg-gray-100 rounded-full p-0 gap-0 w-full">
          <button
            onClick={() => handleFilterChange('all')}
            className={cn(
              'px-0 py-0 rounded-full text-[5px] font-medium transition-all flex-1 min-w-0',
              filters.type === 'all'
                ? 'bg-white shadow-sm text-gray-900'
                : 'bg-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Всі
          </button>
          <button
            onClick={() => handleFilterChange('new')}
            className={cn(
              'px-0 py-0 rounded-full text-[5px] font-medium transition-all relative flex-1 min-w-0',
              filters.type === 'new'
                ? 'bg-white shadow-sm text-gray-900'
                : 'bg-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <span className="truncate">Нові</span>
            {unreadTotal > 0 && (
              <span className="ml-0.5 px-0.5 py-0 bg-red-500 text-white text-[4px] rounded-full leading-none">
                {unreadTotal}
              </span>
            )}
          </button>
          <button
            onClick={() => handleFilterChange('in_progress')}
            className={cn(
              'px-0 py-0 rounded-full text-[5px] font-medium transition-all flex-1 min-w-0 truncate',
              filters.type === 'in_progress'
                ? 'bg-white shadow-sm text-gray-900'
                : 'bg-transparent text-gray-500 hover:text-gray-700'
            )}
            title="В роботі"
          >
            В роботі
          </button>
          <button
            onClick={() => handleFilterChange('needs_reply')}
            className={cn(
              'px-0 py-0 rounded-full text-[5px] font-medium transition-all flex-1 min-w-0 truncate',
              filters.type === 'needs_reply'
                ? 'bg-white shadow-sm text-gray-900'
                : 'bg-transparent text-gray-500 hover:text-gray-700'
            )}
            title="Потребують відповіді"
          >
            Потрібна відповідь
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-gray-200 flex-shrink-0 bg-white">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Пошук..."
            value={localSearch}
            onChange={handleSearchChange}
            className="pl-8 h-8 text-sm bg-gray-50 border-gray-200 focus:bg-white"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        onWheel={(e) => {
          // Запобігаємо scroll propagation на основну сторінку
          e.stopPropagation();
        }}
      >
        <div className="p-2">
          {isLoading ? (
            // Loading skeleton
            <>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="mb-2 p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Filter className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">Розмови не знайдено</p>
              <p className="text-xs text-gray-400 mt-1">
                Спробуйте змінити фільтри або пошук
              </p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Filter className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">Нічого не знайдено</p>
              <p className="text-xs text-gray-400 mt-1">
                За поточними фільтрами розмов немає
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedId === conversation.id}
                onClick={() => onSelect(conversation.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

