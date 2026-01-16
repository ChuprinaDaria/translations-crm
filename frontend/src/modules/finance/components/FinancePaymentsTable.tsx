import React, { useState, useMemo, useEffect } from 'react';
import { ArrowUpDown, Download, ArrowUp, ArrowDown, StickyNote } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../../../components/ui/tooltip';
import { financeApi, Payment } from '../api/transactions';
import { applyCustomizationsToPayments, savePaymentCustomization, getPaymentCustomization, HiddenNote } from '../utils/paymentStorage';
import { NotesManager, Note } from '../../../components/NotesManager';
import { toast } from 'sonner';
import { cn } from '../../../components/ui/utils';
import { useI18n } from '../../../lib/i18n';

type SortField = 'lp' | 'order_number' | 'service_date' | 'buyer_name' | 'amount_gross' | 'payment_date' | 'posting_date' | 'payment_method' | 'receipt_number';
type SortDirection = 'asc' | 'desc' | null;

interface FinancePaymentsTableProps {
  payments: Payment[];
  loading?: boolean;
}

export function FinancePaymentsTable({ payments, loading }: FinancePaymentsTableProps) {
  const { t } = useI18n();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [exporting, setExporting] = useState(false);
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
      if (sortField === 'service_date' || sortField === 'payment_date' || sortField === 'posting_date') {
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await financeApi.exportPaymentsToExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `platnosci_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(t('finance.payments.exportSuccess'));
    } catch (e: any) {
      console.error(e);
      toast.error(t('finance.payments.exportError'));
    } finally {
      setExporting(false);
    }
  };

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

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-4 h-4 ml-1" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="w-4 h-4 ml-1" />;
    }
    return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
  };

  // Кольори для заголовків колонок (згідно з зображенням)
  const headerColors = [
    'bg-green-200',      // LP - зелений
    'bg-blue-200',       // Numer zlecenia - синій
    'bg-purple-200',     // Data wykonania usługi - фіолетовий
    'bg-yellow-200',     // Nabywca - жовтий
    'bg-orange-200',     // Kwota płatności brutto - помаранчевий
    'bg-red-200',        // Data płatności - червоний
    'bg-blue-200',       // Data nabicia na KF - синій
    'bg-pink-200',       // Sposób płatności - рожевий
    'bg-red-200',        // Numer dowodu sprzedaży - червоний
    'bg-gray-200',       // Uwagi - сірий
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('finance.payments.title')}</CardTitle>
        <Button
          onClick={handleExport}
          disabled={exporting || payments.length === 0}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          {exporting ? t('finance.payments.exporting') : t('finance.payments.export')}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className={cn("cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[0])}
                  onClick={() => handleSort('lp')}
                >
                  <div className="flex items-center">
                    {t('finance.payments.columns.lp')}
                    {getSortIcon('lp')}
                  </div>
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[1])}
                  onClick={() => handleSort('order_number')}
                >
                  <div className="flex items-center">
                    {t('finance.payments.columns.orderNumber')}
                    {getSortIcon('order_number')}
                  </div>
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[2])}
                  onClick={() => handleSort('service_date')}
                >
                  <div className="flex items-center">
                    {t('finance.payments.columns.serviceDate')}
                    {getSortIcon('service_date')}
                  </div>
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[3])}
                  onClick={() => handleSort('buyer_name')}
                >
                  <div className="flex items-center">
                    {t('finance.payments.columns.buyerName')}
                    {getSortIcon('buyer_name')}
                  </div>
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[4])}
                  onClick={() => handleSort('amount_gross')}
                >
                  <div className="flex items-center">
                    {t('finance.payments.columns.amountGross')}
                    {getSortIcon('amount_gross')}
                  </div>
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[5])}
                  onClick={() => handleSort('payment_date')}
                >
                  <div className="flex items-center">
                    {t('finance.payments.columns.paymentDate')}
                    {getSortIcon('payment_date')}
                  </div>
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[6])}
                  onClick={() => handleSort('posting_date')}
                >
                  <div className="flex items-center">
                    {t('finance.payments.columns.postingDate')}
                    {getSortIcon('posting_date')}
                  </div>
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[7])}
                  onClick={() => handleSort('payment_method')}
                >
                  <div className="flex items-center">
                    {t('finance.payments.columns.paymentMethod')}
                    {getSortIcon('payment_method')}
                  </div>
                </TableHead>
                <TableHead
                  className={cn("cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[8])}
                  onClick={() => handleSort('receipt_number')}
                >
                  <div className="flex items-center">
                    {t('finance.payments.columns.receiptNumber')}
                    {getSortIcon('receipt_number')}
                  </div>
                </TableHead>
                <TableHead className={cn("cursor-pointer select-none hover:bg-opacity-80 transition-colors", headerColors[9])}>
                  {t('finance.payments.columns.notes')}
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8">
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
                        className={cn(
                          "hover:bg-opacity-80 transition-colors cursor-pointer",
                          payment.color ? "" : "hover:bg-gray-50"
                        )}
                        style={rowStyle}
                        onClick={() => handleRowClick(payment)}
                      >
                        <TableCell className="font-medium">{payment.lp}</TableCell>
                        <TableCell>{payment.order_number}</TableCell>
                        <TableCell>{formatDate(payment.service_date)}</TableCell>
                        <TableCell>{payment.buyer_name}</TableCell>
                        <TableCell className="font-medium">
                          {payment.amount_gross.toLocaleString('uk-UA', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} ₴
                        </TableCell>
                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                        <TableCell>{formatDate(payment.posting_date)}</TableCell>
                        <TableCell>{formatPaymentMethod(payment.payment_method)}</TableCell>
                        <TableCell>{payment.receipt_number}</TableCell>
                        <TableCell className="text-gray-500">
                          {payment.notes || ''}
                          {(() => {
                            const customization = getPaymentCustomization(payment.id);
                            const notes = customization?.hidden_notes;
                            if (notes && Array.isArray(notes) && notes.length > 0) {
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="ml-2 inline-flex items-center cursor-help">
                                      <StickyNote className="w-3 h-3 text-blue-500" />
                                      <span className="ml-1 text-xs font-medium text-blue-600">
                                        {notes.length}
                                      </span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    <div className="space-y-2">
                                      <div className="font-semibold text-sm flex items-center gap-1">
                                        <StickyNote className="w-3 h-3" />
                                        {t('finance.payments.hiddenNotes')} ({notes.length})
                                      </div>
                                      {notes.map((note: HiddenNote, idx: number) => (
                                        <div key={note.id || idx} className="text-sm border-l-2 border-blue-300 pl-2">
                                          <div className="whitespace-pre-wrap">{note.text}</div>
                                          <div className="text-xs text-gray-500 mt-1">
                                            {note.created_by} • {new Date(note.created_at).toLocaleDateString()}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            } else if (payment.hidden_notes && typeof payment.hidden_notes === 'string') {
                              // Legacy формат
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="ml-2 inline-flex items-center cursor-help">
                                      <StickyNote className="w-3 h-3 text-blue-500" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    <div className="space-y-1">
                                      <div className="font-semibold text-sm flex items-center gap-1">
                                        <StickyNote className="w-3 h-3" />
                                        {t('finance.payments.hiddenNotes')}
                                      </div>
                                      <div className="text-sm whitespace-pre-wrap">
                                        {payment.hidden_notes}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                            return null;
                          })()}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
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

