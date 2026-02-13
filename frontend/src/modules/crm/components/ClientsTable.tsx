import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Card, CardContent } from '../../../components/ui/card';
import { cn } from '../../../components/ui/utils';
import type { ClientListItem } from './ClientsSidebar';

type SortField = 'lp' | 'full_name' | 'email' | 'phone' | 'source' | 'orders_count' | 'total_amount' | 'created_at' | 'last_order_date';
type SortDirection = 'asc' | 'desc' | null;

interface ClientsTableProps {
  clients: ClientListItem[];
  loading?: boolean;
  onClientClick?: (clientId: string) => void;
}

export function ClientsTable({ clients, loading, onClientClick }: ClientsTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedClients = useMemo(() => {
    if (!sortField || !sortDirection) {
      return clients;
    }

    const sorted = [...clients].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Обробка дат
      if (sortField === 'created_at' || sortField === 'last_order_date') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // Обробка чисел
      if (sortField === 'orders_count' || sortField === 'total_amount') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      // Обробка рядків
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
      }
      if (typeof bValue === 'string') {
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [clients, sortField, sortDirection]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pl-PL');
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount || amount === 0) return '-';
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
  };

  const formatSource = (source: string) => {
    const sourceLabels: Record<string, string> = {
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      instagram: 'Instagram',
      email: 'Email',
      facebook: 'Facebook',
      manual: 'Formularz',
      office_visit: 'Wizyta w biurze',
      meta: 'Meta',
      tg: 'Telegram',
    };
    return sourceLabels[source] || source;
  };

  // Кольори для заголовків колонок
  const headerColors = [
    'bg-green-200',      // LP - зелений
    'bg-blue-200',       // Imię - синій
    'bg-purple-200',     // Email - фіолетовий
    'bg-yellow-200',     // Telefon - жовтий
    'bg-orange-200',     // Źródło - помаранчевий
    'bg-red-200',        // Liczba zamówień - червоний
    'bg-pink-200',       // Suma - рожевий
    'bg-cyan-200',       // Data utworzenia - блакитний
    'bg-indigo-200',     // Ostatnie zamówienie - індиго
  ];

  return (
    <Card className="border shadow-sm bg-white overflow-hidden">
      <CardContent className="p-0">
        {/* Контейнер для скролу */}
        <div className="overflow-x-auto w-full scrollbar-thin">
          <Table className="table-fixed border-collapse w-full min-w-[800px]">
            <TableHeader className="bg-slate-50">
              <TableRow className="h-9">
                <TableHead className={cn("px-2 text-[10px] font-bold border-r w-[35px] text-center cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[0])} onClick={() => handleSort('lp')}>
                  LP
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[150px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[1])} onClick={() => handleSort('full_name')}>
                  Imię
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[150px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[2])} onClick={() => handleSort('email')}>
                  Email
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[120px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[3])} onClick={() => handleSort('phone')}>
                  Telefon
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[100px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[4])} onClick={() => handleSort('source')}>
                  Źródło
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[80px] text-center cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[5])} onClick={() => handleSort('orders_count')}>
                  Zamówienia
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[100px] text-right cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[6])} onClick={() => handleSort('total_amount')}>
                  Suma
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[90px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[7])} onClick={() => handleSort('created_at')}>
                  Data utworzenia
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[90px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[8])} onClick={() => handleSort('last_order_date')}>
                  Ostatnie zamówienie
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-orange-500 border-t-transparent" />
                      <span className="ml-2">Ładowanie...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    Brak klientów
                  </TableCell>
                </TableRow>
              ) : (
                sortedClients.map((client, index) => (
                  <TableRow
                    key={client.id}
                    className="h-8 hover:bg-slate-50 transition-colors border-b cursor-pointer"
                    onClick={() => onClientClick?.(client.id)}
                  >
                    <TableCell className="px-2 text-[10px] text-center border-r">{index + 1}</TableCell>
                    <TableCell className="px-2 text-[10px] truncate border-r font-medium" title={client.full_name}>
                      {client.full_name}
                    </TableCell>
                    <TableCell className="px-2 text-[10px] truncate border-r" title={client.email}>
                      {client.email || '-'}
                    </TableCell>
                    <TableCell className="px-2 text-[10px] border-r">{client.phone || '-'}</TableCell>
                    <TableCell className="px-2 text-[10px] border-r">{formatSource(client.source)}</TableCell>
                    <TableCell className="px-2 text-[10px] border-r text-center">
                      {client.orders_count || 0}
                    </TableCell>
                    <TableCell className="px-2 text-[10px] border-r text-right font-semibold">
                      {formatCurrency(client.total_amount)}
                    </TableCell>
                    <TableCell className="px-2 text-[10px] border-r">{formatDate(client.created_at)}</TableCell>
                    <TableCell className="px-2 text-[10px] border-r">{formatDate(client.last_order_date)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

