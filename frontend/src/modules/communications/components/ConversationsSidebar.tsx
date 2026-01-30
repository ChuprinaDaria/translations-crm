import React, { useState } from 'react';
import { Search, Clock, Bell, Archive, MessageSquare, Mail, MessageCircle, Instagram, Facebook, X } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { ConversationItem } from './ConversationItem';
import { Skeleton } from '../../../components/ui/skeleton';
import { cn } from '../../../components/ui/utils';

export type FilterType = 'all' | 'new' | 'archived';

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
  assigned_manager_id?: string;
}

interface ConversationsSidebarProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  isLoading?: boolean;
  total?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
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
  total,
  hasMore,
  onLoadMore,
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

  // Main filters with icons
  const mainFilters = [
    { id: 'all' as FilterType, icon: Clock, label: 'Останні', count: null },
    { id: 'new' as FilterType, icon: Bell, label: 'Нові', count: conversations.filter(c => c.unread_count > 0).length || null },
    { id: 'archived' as FilterType, icon: Archive, label: 'Архів', count: null },
  ];

  // Platform filters with icons
  const platformFilters = [
    { id: 'telegram' as const, icon: MessageSquare, label: 'Telegram', color: 'text-sky-500' },
    { id: 'email' as const, icon: Mail, label: 'Email', color: 'text-orange-500' },
    { id: 'whatsapp' as const, icon: MessageCircle, label: 'WhatsApp', color: 'text-green-500' },
    { id: 'instagram' as const, icon: Instagram, label: 'Instagram', color: 'text-fuchsia-500' },
    { id: 'facebook' as const, icon: Facebook, label: 'Facebook', color: 'text-blue-600' },
  ];

  // Filter conversations locally (server already filters, but we do it here for search)
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

    return true; // Server already filters by type
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header з фільтрами */}
      <div className="p-3 border-b space-y-3 flex-shrink-0 bg-white">
        {/* Основні фільтри — іконки в ряд */}
        <div className="flex items-center gap-1">
          {mainFilters.map((f) => {
            const Icon = f.icon;
            const isActive = filters.type === f.id;
            return (
              <button
                key={f.id}
                onClick={() => handleFilterChange(f.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  isActive 
                    ? 'bg-gray-900 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{f.label}</span>
                {f.count !== null && f.count > 0 && (
                  <span className={cn(
                    'ml-1 px-1.5 py-0.5 rounded-full text-xs',
                    isActive ? 'bg-white/20' : 'bg-red-500 text-white'
                  )}>
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        {/* Фільтр по платформі — іконки */}
        <div className="flex items-center gap-1">
          {platformFilters.map((p) => {
            const Icon = p.icon;
            const isActive = filters.platform === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onFilterChange({ 
                  ...filters, 
                  platform: isActive ? undefined : p.id
                })}
                title={p.label}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded-lg transition-colors',
                  isActive 
                    ? 'bg-gray-200 ring-2 ring-gray-400' 
                    : 'hover:bg-gray-100',
                  p.color
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
          
          {/* Clear platform filter */}
          {filters.platform && (
            <button
              onClick={() => onFilterChange({ ...filters, platform: undefined })}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
              title="Очистити фільтр"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Пошук */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Пошук..."
            value={localSearch}
            onChange={handleSearchChange}
            className="pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
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
              <Archive className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">
                {filters.type === 'archived' ? 'Архів порожній' : 'Нічого не знайдено'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {filters.type === 'archived' 
                  ? 'Немає архівованих діалогів' 
                  : 'За поточними фільтрами розмов немає'}
              </p>
            </div>
          ) : (
            <>
              {filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={selectedId === conversation.id}
                  onClick={() => onSelect(conversation.id)}
                />
              ))}
              
              {/* Load More */}
              {hasMore && onLoadMore && (
                <button
                  onClick={onLoadMore}
                  className="w-full py-3 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Завантажити ще...
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Footer з кількістю */}
      {total !== undefined && (
        <div className="p-2 border-t text-center text-xs text-gray-400 flex-shrink-0">
          Показано {conversations.length} з {total}
        </div>
      )}
    </div>
  );
}

