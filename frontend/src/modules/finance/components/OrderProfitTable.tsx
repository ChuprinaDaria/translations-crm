import React, { useState, useMemo } from 'react';
import { ArrowUpDown, TrendingUp, DollarSign, User } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { cn } from '../../../components/ui/utils';
import { useI18n } from '../../../lib/i18n';

export interface OrderProfit {
  orderId: string;
  orderNumber: string;
  clientName: string;
  clientPayment: number; // Оплата від клієнта
  translatorPayment: number; // Оплата перекладачу
  profit: number; // Різниця (прибуток)
  profitPercent: number; // Відсоток прибутку
  created_at?: string;
}

interface OrderProfitTableProps {
  orders: OrderProfit[];
  loading?: boolean;
}

type SortField = 'order_number' | 'clientName' | 'clientPayment' | 'translatorPayment' | 'profit' | 'profitPercent' | 'created_at';
type SortDirection = 'asc' | 'desc' | null;

export function OrderProfitTable({ orders, loading }: OrderProfitTableProps) {
  const { t } = useI18n();
  const [sortField, setSortField] = useState<SortField | null>('profit');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

  const sortedOrders = useMemo(() => {
    if (!sortField || !sortDirection) {
      return orders;
    }

    const sorted = [...orders].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Обробка дат
      if (sortField === 'created_at') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // Обробка чисел
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Обробка рядків
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });

    return sorted;
  }, [orders, sortField, sortDirection]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const totalClientPayment = useMemo(() => 
    orders.reduce((sum, o) => sum + o.clientPayment, 0), 
    [orders]
  );
  const totalTranslatorPayment = useMemo(() => 
    orders.reduce((sum, o) => sum + o.translatorPayment, 0), 
    [orders]
  );
  const totalProfit = useMemo(() => 
    orders.reduce((sum, o) => sum + o.profit, 0), 
    [orders]
  );
  const avgProfitPercent = useMemo(() => 
    orders.length > 0 
      ? orders.reduce((sum, o) => sum + o.profitPercent, 0) / orders.length 
      : 0, 
    [orders]
  );

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
    >
      {children}
      <ArrowUpDown className={cn(
        "w-4 h-4 transition-opacity",
        sortField === field ? "opacity-100" : "opacity-30"
      )} />
    </button>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[#FF5A00] border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Загальна оплата клієнтів
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatAmount(totalClientPayment)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <User className="w-4 h-4" />
              Загальна оплата перекладачам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatAmount(totalTranslatorPayment)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Загальний прибуток
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatAmount(totalProfit)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              Середній % прибутку
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {avgProfitPercent.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Różnica płatności według zleceń</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortButton field="order_number">Nr. Zlecenia</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="clientName">Клієнт</SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="clientPayment">Оплата клієнта</SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="translatorPayment">Оплата перекладачу</SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="profit">Прибуток</SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="profitPercent">% Прибутку</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton field="created_at">Дата створення</SortButton>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      Немає даних для відображення
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedOrders.map((order) => (
                    <TableRow key={order.orderId}>
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>{order.clientName}</TableCell>
                      <TableCell className="text-right font-semibold text-blue-600">
                        {formatAmount(order.clientPayment)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-purple-600">
                        {formatAmount(order.translatorPayment)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-bold",
                        order.profit >= 0 ? "text-emerald-600" : "text-red-600"
                      )}>
                        {formatAmount(order.profit)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-semibold",
                        order.profitPercent >= 0 ? "text-emerald-600" : "text-red-600"
                      )}>
                        {order.profitPercent.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatDate(order.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

