import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Users,
  MessageSquare,
  Phone,
  Package,
  Calendar,
  X,
  Building,
} from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Label } from '../../../components/ui/label';
import { ScrollArea } from '../../../components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../components/ui/collapsible';
import { Badge } from '../../../components/ui/badge';
import { cn } from '../../../components/ui/utils';
import type { Client } from '../api/clients';

// Platform icons mapping
const platformIcons: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  telegram: { icon: MessageSquare, color: 'text-blue-500', label: 'Telegram' },
  whatsapp: { icon: MessageSquare, color: 'text-green-500', label: 'WhatsApp' },
  instagram: { icon: MessageSquare, color: 'text-pink-500', label: 'Instagram' },
  email: { icon: MessageSquare, color: 'text-gray-500', label: 'Email' },
  facebook: { icon: MessageSquare, color: 'text-blue-600', label: 'Facebook' },
  manual: { icon: Phone, color: 'text-gray-600', label: 'Formularz' },
  office_visit: { icon: Building, color: 'text-purple-500', label: 'Візит в офіс' },
  meta: { icon: MessageSquare, color: 'text-blue-500', label: 'Meta' },
  tg: { icon: MessageSquare, color: 'text-blue-400', label: 'Telegram' },
};

export interface FilterState {
  sources: string[];
  isActive: boolean | null;
  dateFrom: string;
  dateTo: string;
  ordersCount: 'any' | '1' | '2-5' | '5+';
}

export interface ClientListItem {
  id: string;
  full_name: string;
  email?: string;
  phone: string;
  source: string;
  created_at: string;
  orders_count?: number;
  total_amount?: number;
  last_order_date?: string;
}

interface ClientsSidebarProps {
  clients: ClientListItem[];
  selectedClientId?: string;
  onSelectClient: (clientId: string) => void;
  isLoading?: boolean;
}

const SOURCES = [
  { id: 'telegram', label: 'Telegram' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'email', label: 'Email' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'manual', label: 'Formularz kontaktowy' },
  { id: 'office_visit', label: 'Візит в офіс' },
  { id: 'meta', label: 'Meta' },
  { id: 'tg', label: 'Telegram (TG)' },
];

export function ClientsSidebar({
  clients,
  selectedClientId,
  onSelectClient,
  isLoading = false,
}: ClientsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    sources: [],
    isActive: null,
    dateFrom: '',
    dateTo: '',
    ordersCount: 'any',
  });
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'orders' | 'amount'>('date');

  // Filter and sort clients
  const filteredClients = useMemo(() => {
    let result = [...clients];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (client) =>
          client.full_name.toLowerCase().includes(q) ||
          (client.email || '').toLowerCase().includes(q) ||
          (client.phone || '').toLowerCase().includes(q)
      );
    }

    // Source filter
    if (filters.sources.length > 0) {
      result = result.filter((client) => filters.sources.includes(client.source));
    }

    // Activity filter
    if (filters.isActive !== null) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      result = result.filter((client) => {
        const lastOrderDate = client.last_order_date ? new Date(client.last_order_date) : null;
        const isActive = lastOrderDate ? lastOrderDate > thirtyDaysAgo : false;
        return filters.isActive ? isActive : !isActive;
      });
    }

    // Date range filter
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      result = result.filter((client) => new Date(client.created_at) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((client) => new Date(client.created_at) <= to);
    }

    // Orders count filter
    if (filters.ordersCount !== 'any') {
      result = result.filter((client) => {
        const count = client.orders_count || 0;
        switch (filters.ordersCount) {
          case '1':
            return count === 1;
          case '2-5':
            return count >= 2 && count <= 5;
          case '5+':
            return count > 5;
          default:
            return true;
        }
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.full_name.localeCompare(b.full_name);
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'orders':
          return (b.orders_count || 0) - (a.orders_count || 0);
        case 'amount':
          return (b.total_amount || 0) - (a.total_amount || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [clients, searchQuery, filters, sortBy]);

  const resetFilters = () => {
    setFilters({
      sources: [],
      isActive: null,
      dateFrom: '',
      dateTo: '',
      ordersCount: 'any',
    });
  };

  const toggleSource = (sourceId: string) => {
    setFilters((prev) => ({
      ...prev,
      sources: prev.sources.includes(sourceId)
        ? prev.sources.filter((s) => s !== sourceId)
        : [...prev.sources, sourceId],
    }));
  };

  const hasActiveFilters =
    filters.sources.length > 0 ||
    filters.isActive !== null ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.ordersCount !== 'any';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Пошук клієнта..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Filters */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between px-3 py-2 h-auto rounded-none border-b"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Фільтри</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {filters.sources.length + (filters.isActive !== null ? 1 : 0) + (filters.dateFrom || filters.dateTo ? 1 : 0) + (filters.ordersCount !== 'any' ? 1 : 0)}
                </Badge>
              )}
            </div>
            {isFiltersOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-3 space-y-4 border-b bg-gray-50">
            {/* Sources */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">Джерело:</Label>
              <div className="space-y-1">
                {SOURCES.map((source) => (
                  <div key={source.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`source-${source.id}`}
                      checked={filters.sources.includes(source.id)}
                      onCheckedChange={() => toggleSource(source.id)}
                    />
                    <Label
                      htmlFor={`source-${source.id}`}
                      className="text-xs cursor-pointer"
                    >
                      {source.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity status */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">Статус:</Label>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="active"
                    checked={filters.isActive === true}
                    onCheckedChange={(checked) =>
                      setFilters((prev) => ({
                        ...prev,
                        isActive: checked ? true : prev.isActive === true ? null : prev.isActive,
                      }))
                    }
                  />
                  <Label htmlFor="active" className="text-xs cursor-pointer">
                    Активні
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="inactive"
                    checked={filters.isActive === false}
                    onCheckedChange={(checked) =>
                      setFilters((prev) => ({
                        ...prev,
                        isActive: checked ? false : prev.isActive === false ? null : prev.isActive,
                      }))
                    }
                  />
                  <Label htmlFor="inactive" className="text-xs cursor-pointer">
                    Неактивні (30+ днів)
                  </Label>
                </div>
              </div>
            </div>

            {/* Date range */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">
                Період реєстрації:
              </Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                  }
                  className="h-8 text-xs"
                />
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Orders count */}
            <div>
              <Label className="text-xs font-medium text-gray-600 mb-2 block">
                Кількість замовлень:
              </Label>
              <div className="space-y-1">
                {[
                  { value: '1', label: '1 замовлення' },
                  { value: '2-5', label: '2-5 замовлень' },
                  { value: '5+', label: '5+ замовлень (VIP)' },
                ].map((option) => (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`orders-${option.value}`}
                      checked={filters.ordersCount === option.value}
                      onCheckedChange={(checked) =>
                        setFilters((prev) => ({
                          ...prev,
                          ordersCount: checked ? (option.value as FilterState['ordersCount']) : 'any',
                        }))
                      }
                    />
                    <Label
                      htmlFor={`orders-${option.value}`}
                      className="text-xs cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="flex-1 text-xs"
                disabled={!hasActiveFilters}
              >
                Скинути
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Sort */}
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Сортування:
        </span>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-auto h-7 text-xs gap-1 border-0 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">За іменем (A-Z)</SelectItem>
            <SelectItem value="date">За датою</SelectItem>
            <SelectItem value="orders">За замовленнями</SelectItem>
            <SelectItem value="amount">За сумою</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clients list header */}
      <div className="px-3 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Клієнти ({filteredClients.length})
          </span>
        </div>
      </div>

      {/* Clients list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Клієнтів не знайдено</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredClients.map((client) => {
              const platform = platformIcons[client.source] || platformIcons.manual;
              const PlatformIcon = platform.icon;
              const isSelected = selectedClientId === client.id;
              const isVip = (client.orders_count || 0) >= 5;

              return (
                <button
                  key={client.id}
                  onClick={() => onSelectClient(client.id)}
                  className={cn(
                    'w-full p-3 rounded-lg text-left transition-all',
                    'hover:bg-blue-50 hover:shadow-sm',
                    isSelected
                      ? 'bg-blue-100 border border-blue-200 shadow-sm'
                      : 'bg-white border border-transparent'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                        isVip ? 'bg-amber-100' : 'bg-gray-100'
                      )}
                    >
                      <Users className={cn('w-4 h-4', isVip ? 'text-amber-600' : 'text-gray-600')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {client.full_name}
                        </span>
                        {isVip && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-amber-100 text-amber-700">
                            VIP
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                        {client.phone && (
                          <>
                            <Phone className="w-3 h-3" />
                            <span className="truncate">{client.phone}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className={cn('flex items-center gap-0.5', platform.color)}>
                          <PlatformIcon className="w-3 h-3" />
                          <span>{platform.label}</span>
                        </span>
                        
                        {(client.orders_count || 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-gray-500">
                            <Package className="w-3 h-3" />
                            {client.orders_count} ({formatAmount(client.total_amount || 0)})
                          </span>
                        )}
                      </div>

                      {client.last_order_date && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>Останнє: {formatDate(client.last_order_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

