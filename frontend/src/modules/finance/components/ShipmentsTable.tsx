import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Card, CardContent } from '../../../components/ui/card';
import { Shipment } from '../api/shipments';
import { cn } from '../../../components/ui/utils';
import { useI18n } from '../../../lib/i18n';
import { ExternalLink, Package, Truck, MapPin, Building2 } from 'lucide-react';

type SortField = 'order_number' | 'tracking_number' | 'status' | 'method' | 'created_at' | 'delivered_at';
type SortDirection = 'asc' | 'desc' | null;

interface ShipmentsTableProps {
  shipments: Shipment[];
  loading?: boolean;
}

export function ShipmentsTable({ shipments, loading }: ShipmentsTableProps) {
  const { t } = useI18n();
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

  const sortedShipments = useMemo(() => {
    if (!sortField || !sortDirection) {
      return shipments;
    }

    const sorted = [...shipments].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Обробка дат
      if (sortField === 'created_at' || sortField === 'delivered_at') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
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
  }, [shipments, sortField, sortDirection]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('uk-UA');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      'created': { label: 'Створено', className: 'bg-gray-100 text-gray-800' },
      'label_printed': { label: 'Етикетка', className: 'bg-blue-100 text-blue-800' },
      'in_transit': { label: 'В дорозі', className: 'bg-blue-100 text-blue-800' },
      'ready_for_pickup': { label: 'Готово', className: 'bg-yellow-100 text-yellow-800' },
      'delivered': { label: 'Доставлено', className: 'bg-green-100 text-green-800' },
      'returned': { label: 'Повернено', className: 'bg-red-100 text-red-800' },
    };
    
    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    
    return (
      <span className={cn("px-2 py-1 rounded text-xs font-medium", config.className)}>
        {config.label}
      </span>
    );
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'inpost_locker':
        return <Package className="w-4 h-4" />;
      case 'inpost_courier':
        return <Truck className="w-4 h-4" />;
      case 'office_pickup':
        return <Building2 className="w-4 h-4" />;
      case 'courier':
        return <Truck className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  const getMethodLabel = (method: string) => {
    const methodLabels: Record<string, string> = {
      'inpost_locker': 'InPost пачкомат',
      'inpost_courier': 'InPost кур\'єр',
      'office_pickup': 'Самовивіз',
      'courier': 'Кур\'єр',
    };
    return methodLabels[method] || method;
  };

  const getDeliveryInfo = (shipment: Shipment) => {
    if (shipment.paczkomat_code) {
      return shipment.paczkomat_code;
    }
    if (shipment.delivery_address) {
      return shipment.delivery_address.length > 30 
        ? `${shipment.delivery_address.substring(0, 30)}...`
        : shipment.delivery_address;
    }
    return '-';
  };

  // Кольори для заголовків колонок
  const headerColors = [
    'bg-blue-200',       // Numer zlecenia
    'bg-purple-200',     // Tracking
    'bg-indigo-200',     // Статус
    'bg-cyan-200',       // Метод
    'bg-teal-200',       // Пачкомат/Адреса
    'bg-green-200',      // Створено
    'bg-emerald-200',    // Доставлено
  ];

  return (
    <Card className="border shadow-sm bg-white overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto w-full scrollbar-thin">
          <Table className="table-fixed border-collapse w-full min-w-[800px]">
            <TableHeader className="bg-slate-50">
              <TableRow className="h-9">
                <TableHead className={cn("px-2 text-[10px] border-r w-[100px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[0])} onClick={() => handleSort('order_number')}>
                  Numer zlecenia
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[120px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[1])} onClick={() => handleSort('tracking_number')}>
                  Tracking
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[100px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[2])} onClick={() => handleSort('status')}>
                  Статус
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[110px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[3])} onClick={() => handleSort('method')}>
                  Метод
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[150px]", headerColors[4])}>
                  Пачкомат/Адреса
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[90px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[5])} onClick={() => handleSort('created_at')}>
                  Створено
                </TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[90px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[6])} onClick={() => handleSort('delivered_at')}>
                  Доставлено
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-orange-500 border-t-transparent" />
                      <span className="ml-2">{t('finance.shipments.loading')}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedShipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    {t('finance.shipments.noShipments')}
                  </TableCell>
                </TableRow>
              ) : (
                sortedShipments.map((shipment) => (
                  <TableRow 
                    key={shipment.id}
                    className="h-8 hover:bg-slate-50 transition-colors border-b"
                  >
                    <TableCell className="px-2 text-[10px] truncate border-r font-mono tracking-tighter" title={shipment.order_number}>
                      {shipment.order_number || '-'}
                    </TableCell>
                    <TableCell className="px-2 text-[10px] border-r">
                      {shipment.tracking_number ? (
                        <div className="flex items-center gap-1">
                          <a
                            href={shipment.tracking_url || `https://inpost.pl/sledzenie-przesylek?number=${shipment.tracking_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                            title="Відкрити tracking на inpost.pl"
                          >
                            <span className="font-mono text-[9px]">{shipment.tracking_number}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="px-2 text-[10px] border-r">
                      {getStatusBadge(shipment.status)}
                    </TableCell>
                    <TableCell className="px-2 text-[10px] border-r">
                      <div className="flex items-center gap-1.5">
                        {getMethodIcon(shipment.method)}
                        <span className="text-[9px]">{getMethodLabel(shipment.method)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 text-[10px] truncate border-r" title={shipment.paczkomat_code || shipment.delivery_address || ''}>
                      {getDeliveryInfo(shipment)}
                    </TableCell>
                    <TableCell className="px-2 text-[10px] border-r">
                      {formatDate(shipment.created_at)}
                    </TableCell>
                    <TableCell className="px-2 text-[10px] border-r">
                      {formatDate(shipment.delivered_at)}
                    </TableCell>
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

