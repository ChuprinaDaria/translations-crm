import { useState, useMemo, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Card, CardContent } from '../../../components/ui/card';
import { TooltipProvider } from '../../../components/ui/tooltip';
import { Payment } from '../api/transactions';
import { applyCustomizationsToPayments, savePaymentCustomization, getPaymentCustomization, HiddenNote } from '../utils/paymentStorage';
import { NotesManager, Note } from '../../../components/NotesManager';
import { cn } from '../../../components/ui/utils';
import { useI18n } from '../../../lib/i18n';

type SortField = 'lp' | 'order_number' | 'service_date' | 'buyer_name' | 'amount_gross' | 'payment_date' | 'payment_method' | 'receipt_number';
type SortDirection = 'asc' | 'desc' | null;

interface FinancePaymentsTableProps {
  payments: Payment[];
  loading?: boolean;
}

export function FinancePaymentsTable({ payments, loading }: FinancePaymentsTableProps) {
  const { t } = useI18n();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [customizedPayments, setCustomizedPayments] = useState<Payment[]>([]);

  // Застосовуємо кастомізації при завантаженні платежів
  useEffect(() => {
    try {
      if (!payments || !Array.isArray(payments)) {
        setCustomizedPayments([]);
        return;
      }
      const customized = applyCustomizationsToPayments(payments);
      setCustomizedPayments(customized);
    } catch (error) {
      console.error('Error applying customizations:', error);
      setCustomizedPayments(payments || []);
    }
  }, [payments]);

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

  const handlePaymentUpdate = (updatedPayment: Payment) => {
    setCustomizedPayments(prev => 
      prev.map(p => p.id === updatedPayment.id ? updatedPayment : p)
    );
  };

  const handleRowClick = (payment: Payment) => {
    const YELLOW_COLOR = 'rgba(254, 252, 232, 1)'; // --color-bg-yellow
    const newColor = payment.color === YELLOW_COLOR ? null : YELLOW_COLOR;
    
    // Зберігаємо існуючі нотатки
    const customization = getPaymentCustomization(payment.id);
    
    savePaymentCustomization(payment.id, {
      color: newColor,
      hidden_notes: customization?.hidden_notes || null,
    });

    const updatedPayment: Payment = {
      ...payment,
      color: newColor,
    };

    handlePaymentUpdate(updatedPayment);
  };

  const sortedPayments = useMemo(() => {
    const paymentsToSort = customizedPayments.length > 0 ? customizedPayments : payments;
    
    if (!sortField || !sortDirection) {
      return paymentsToSort;
    }

    const sorted = [...paymentsToSort].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Обробка дат
      if (sortField === 'service_date' || sortField === 'payment_date') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // Обробка чисел
      if (sortField === 'amount_gross' || sortField === 'lp') {
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
  }, [customizedPayments, payments, sortField, sortDirection]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('uk-UA');
  };

  const formatPaymentMethod = (method: string) => {
    const methodKey = `finance.payments.paymentMethods.${method}`;
    const translated = t(methodKey);
    // Якщо переклад не знайдено, повертаємо оригінальний метод
    return translated !== methodKey ? translated : method;
  };


  // Кольори для заголовків колонок (згідно з зображенням)
  const headerColors = [
    'bg-green-200',      // LP - зелений
    'bg-blue-200',       // Numer zlecenia - синій
    'bg-purple-200',     // Data wykonania usługi - фіолетовий
    'bg-yellow-200',     // Nabywca - жовтий
    'bg-orange-200',     // Kwota płatności brutto - помаранчевий
    'bg-red-200',        // Data płatności - червоний
    'bg-pink-200',       // Sposób płatności - рожевий
    'bg-red-200',        // Numer dowodu sprzedaży - червоний
  ];

  return (
    <Card className="border shadow-sm bg-white overflow-hidden">
      <CardContent className="p-0">
        {/* Контейнер для скролу */}
        <div className="overflow-x-auto w-full scrollbar-thin">
          <Table className="table-fixed border-collapse w-full min-w-[700px]">
            <TableHeader className="bg-slate-50">
              <TableRow className="h-9">
                <TableHead className={cn("px-2 text-[10px] font-bold border-r w-[35px] text-center cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[0])} onClick={() => handleSort('lp')}>LP</TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[80px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[1])} onClick={() => handleSort('order_number')}>Numer</TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[75px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[2])} onClick={() => handleSort('service_date')}>Data</TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[110px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[3])} onClick={() => handleSort('buyer_name')}>Nabywca</TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[90px] text-right cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[4])} onClick={() => handleSort('amount_gross')}>Kwota</TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[75px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[5])} onClick={() => handleSort('payment_date')}>Płatność</TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[80px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[6])} onClick={() => handleSort('payment_method')}>Metoda</TableHead>
                <TableHead className={cn("px-2 text-[10px] border-r w-[90px] cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[7])} onClick={() => handleSort('receipt_number')}>Dowód</TableHead>
                <TableHead className="w-[40px] px-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-orange-500 border-t-transparent" />
                      <span className="ml-2">{t('finance.payments.loading')}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-gray-500">
                    {t('finance.payments.noPayments')}
                  </TableCell>
                </TableRow>
              ) : (
                <TooltipProvider delayDuration={0}>
                  {sortedPayments.map((payment) => {
                    const rowStyle = payment.color 
                      ? { backgroundColor: payment.color } 
                      : {};
                    
                    return (
                      <TableRow 
                        key={payment.id}
                        className="h-8 hover:bg-slate-50 transition-colors border-b group"
                        style={rowStyle}
                        onClick={() => handleRowClick(payment)}
                      >
                        <TableCell className="px-2 text-[10px] text-center border-r">{payment.lp}</TableCell>
                        <TableCell className="px-2 text-[10px] truncate border-r font-mono tracking-tighter" title={payment.order_number}>{payment.order_number}</TableCell>
                        <TableCell className="px-2 text-[10px] border-r">{formatDate(payment.service_date)}</TableCell>
                        <TableCell className="px-2 text-[10px] truncate border-r" title={payment.buyer_name}>{payment.buyer_name}</TableCell>
                        <TableCell className="px-2 text-[10px] text-right border-r font-semibold">
                          {payment.amount_gross.toFixed(2)} ₴
                        </TableCell>
                        <TableCell className="px-2 text-[10px] border-r">{formatDate(payment.payment_date)}</TableCell>
                        <TableCell className="px-2 text-[10px] truncate border-r" title={formatPaymentMethod(payment.payment_method)}>{formatPaymentMethod(payment.payment_method)}</TableCell>
                        <TableCell className="px-2 text-[10px] truncate border-r text-center" title={payment.receipt_number}>{payment.receipt_number}</TableCell>
                        <TableCell className="p-0 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center items-center">
                            {payment?.id ? (
                              <NotesManager
                                entityId={payment.id}
                                entityName={payment.order_number}
                                iconSize="sm"
                                storageKey={`finance_payment_${payment.id}`}
                                onSave={(notes: Note[]) => {
                                  // Адаптер для сумісності з paymentStorage
                                  const customization = getPaymentCustomization(payment.id);
                                  savePaymentCustomization(payment.id, {
                                    color: customization?.color || payment.color || null,
                                    hidden_notes: notes.length > 0 ? notes as HiddenNote[] : null,
                                  });
                                  
                                  // Оновлюємо payment в стані
                                  const updatedPayment: Payment = {
                                    ...payment,
                                    hidden_notes: notes.length > 0 
                                      ? notes.map(n => n.text).join('\n\n---\n\n')
                                      : null,
                                    hidden_notes_list: notes.length > 0 ? notes as HiddenNote[] : null,
                                  };
                                  handlePaymentUpdate(updatedPayment);
                                }}
                                onLoad={async () => {
                                  // Завантажуємо з paymentStorage
                                  const customization = getPaymentCustomization(payment.id);
                                  if (customization?.hidden_notes && Array.isArray(customization.hidden_notes)) {
                                    return customization.hidden_notes as Note[];
                                  }
                                  return [];
                                }}
                              />
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TooltipProvider>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

