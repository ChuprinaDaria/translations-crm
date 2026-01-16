import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  MessageSquare,
  Instagram,
  Globe,
  Calendar,
  Package,
  FileText,
  CreditCard,
  Users,
  Truck,
  StickyNote,
  Plus,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  Eye,
  Edit2,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Textarea } from '../../../components/ui/textarea';
import { cn } from '../../../components/ui/utils';
import type { Client, Order, TimelineStep } from '../api/clients';

// Статуси замовлень для прогрес-бару
const ORDER_STATUSES = [
  { key: 'client_created', label: 'Клієнт' },
  { key: 'order_created', label: 'Замовлення' },
  { key: 'payment_link_sent', label: 'Лінк оплати' },
  { key: 'payment_received', label: 'Оплата' },
  { key: 'translator_assigned', label: 'Перекладач' },
  { key: 'translation_ready', label: 'Переклад' },
  { key: 'issued_sent', label: 'Видано' },
];

interface InternalNote {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

interface Document {
  id: string;
  name: string;
  size: number;
  created_at: string;
  order_id?: string;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  order_id?: string;
  order_number?: string;
}

interface DeliveryInfo {
  id: string;
  order_id: string;
  order_number: string;
  method: 'inpost' | 'pickup';
  tracking_number?: string;
  address?: string;
  status: 'pending' | 'in_transit' | 'delivered';
  delivered_at?: string;
}

interface TranslatorInfo {
  id: number;
  name: string;
  orders_count: number;
  languages: string[];
}

interface ClientTabContentProps {
  client: Client;
  orders: Order[];
  onEditClient: () => void;
  onOpenOrder: (orderId: string, orderNumber: string) => void;
  onCreateOrder: () => void;
  isLoading?: boolean;
}

export function ClientTabContent({
  client,
  orders,
  onEditClient,
  onOpenOrder,
  onCreateOrder,
  isLoading = false,
}: ClientTabContentProps) {
  const [expandedSections, setExpandedSections] = useState({
    orders: true,
    documents: false,
    payments: false,
    translators: false,
    delivery: false,
    notes: false,
  });
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [newNote, setNewNote] = useState('');

  // Mock data - in real app would be loaded from API
  const [documents] = useState<Document[]>([
    { id: '1', name: 'TRC_translated_dnk.pdf', size: 2.3 * 1024 * 1024, created_at: '2026-01-15', order_id: 'order-1' },
    { id: '2', name: 'TRC_original_dnk.pdf', size: 1.8 * 1024 * 1024, created_at: '2026-01-02', order_id: 'order-1' },
    { id: '3', name: 'Zaswiadczenie_ang.pdf', size: 0.9 * 1024 * 1024, created_at: '2026-01-10', order_id: 'order-2' },
  ]);

  const [payments] = useState<Payment[]>([
    { id: '1', amount: 200, method: 'Przelew24', status: 'completed', created_at: '2026-01-15', order_number: '#N/01/02/01/26/dnk' },
    { id: '2', amount: 150, method: 'Stripe', status: 'completed', created_at: '2026-01-10', order_number: '#N/03/02/01/26/ang' },
  ]);

  const [translators] = useState<TranslatorInfo[]>([
    { id: 1, name: 'Олена Kowalska', orders_count: 3, languages: ['Данська', 'Німецька'] },
    { id: 2, name: 'Марта Nowak', orders_count: 1, languages: ['Англійська'] },
  ]);

  const [deliveries] = useState<DeliveryInfo[]>([
    { id: '1', order_id: 'order-1', order_number: '#N/01', method: 'inpost', tracking_number: 'XYZ123456789', status: 'delivered', delivered_at: '2026-01-16' },
    { id: '2', order_id: 'order-2', order_number: '#N/03', method: 'pickup', address: 'Warszawa Centrum', status: 'delivered', delivered_at: '2026-01-11' },
  ]);

  const [notes] = useState<InternalNote[]>([
    { id: '1', author: 'Оля', content: 'Клієнт дуже задоволений, хоче більше співпраці', created_at: '2026-01-15T10:30:00' },
    { id: '2', author: 'Марта', content: 'Запитав про термінову доставку', created_at: '2026-01-10T14:20:00' },
    { id: '3', author: 'Оля', content: 'VIP клієнт, завжди дає чайові', created_at: '2026-01-05T09:15:00' },
  ]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'telegram':
      case 'tg':
        return MessageSquare;
      case 'whatsapp':
        return MessageSquare;
      case 'instagram':
        return Instagram;
      case 'email':
        return Mail;
      default:
        return Globe;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'telegram':
      case 'tg':
        return 'text-blue-500';
      case 'whatsapp':
        return 'text-green-500';
      case 'instagram':
        return 'text-pink-500';
      case 'email':
        return 'text-gray-500';
      default:
        return 'text-gray-600';
    }
  };

  const getOrderProgress = (order: Order) => {
    const steps = order.timeline_steps || [];
    return ORDER_STATUSES.map((status) => {
      const step = steps.find((s) => s.step_type === status.key);
      return {
        ...status,
        completed: step?.completed || false,
        completedAt: step?.completed_at,
      };
    });
  };

  const totalOrdersAmount = orders.reduce((sum, order) => {
    // Calculate from order transactions or use default
    return sum + (order.transactions?.reduce((s, t) => t.type === 'income' ? s + t.amount : s, 0) || 0);
  }, 0);

  const SourceIcon = getSourceIcon(client.source);
  const displayedOrders = showAllOrders ? orders : orders.slice(0, 3);
  const isVip = orders.length >= 5;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-32 bg-gray-100 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center',
                isVip ? 'bg-amber-100' : 'bg-orange-100'
              )}
            >
              <User className={cn('w-7 h-7', isVip ? 'text-amber-600' : 'text-[#FF5A00]')} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-900">{client.full_name}</h2>
                {isVip && (
                  <Badge className="bg-amber-100 text-amber-700">VIP</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                <span className={cn('flex items-center gap-1', getSourceColor(client.source))}>
                  <SourceIcon className="w-4 h-4" />
                  {client.source}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(client.created_at)}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onEditClient}>
            <Edit2 className="w-4 h-4 mr-2" />
            Редагувати
          </Button>
        </div>

        {/* Basic info */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-500" />
            Основна інформація
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {client.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">{client.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <SourceIcon className={cn('w-4 h-4', getSourceColor(client.source))} />
              <span className="text-gray-700">Джерело: {client.source}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">Перший контакт: {formatDate(client.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">
                Всього замовлень: {orders.length} ({formatAmount(totalOrdersAmount)})
              </span>
            </div>
          </div>
        </div>

        {/* Orders Section */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <div
            onClick={() => toggleSection('orders')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-500" />
              <span className="font-medium">Замовлення ({orders.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateOrder();
                }}
                className="text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Нове замовлення
              </Button>
              {expandedSections.orders ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>

          {expandedSections.orders && (
            <div className="border-t px-4 py-3 space-y-3">
              {displayedOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Немає замовлень</p>
                </div>
              ) : (
                <>
                  {displayedOrders.map((order) => {
                    const progress = getOrderProgress(order);
                    const completedSteps = progress.filter((p) => p.completed).length;

                    return (
                      <div
                        key={order.id}
                        onClick={() => onOpenOrder(order.id, order.order_number)}
                        className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 hover:shadow-sm cursor-pointer transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-medium text-gray-900">
                              {order.order_number}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDate(order.created_at)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-gray-900">
                              {formatAmount(order.transactions?.reduce((s, t) => t.type === 'income' ? s + t.amount : s, 0) || 0)}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs',
                                order.status === 'closed' ? 'bg-green-50 text-green-700' :
                                order.status === 'do_wydania' ? 'bg-blue-50 text-blue-700' :
                                'bg-yellow-50 text-yellow-700'
                              )}
                            >
                              {order.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Mini progress bar */}
                        <div className="flex items-center gap-1">
                          {progress.map((step, i) => (
                            <React.Fragment key={step.key}>
                              <div
                                className={cn(
                                  'w-2.5 h-2.5 rounded-full',
                                  step.completed ? 'bg-emerald-500' : 'bg-gray-300'
                                )}
                              />
                              {i < progress.length - 1 && (
                                <div
                                  className={cn(
                                    'flex-1 h-0.5',
                                    step.completed ? 'bg-emerald-500' : 'bg-gray-300'
                                  )}
                                />
                              )}
                            </React.Fragment>
                          ))}
                          <span className="ml-2 text-xs text-gray-500">
                            {completedSteps === progress.length ? 'Видано' : `${completedSteps}/${progress.length}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {orders.length > 3 && (
                    <Button
                      variant="ghost"
                      onClick={() => setShowAllOrders(!showAllOrders)}
                      className="w-full text-blue-600"
                    >
                      {showAllOrders
                        ? 'Приховати'
                        : `Показати всі ${orders.length} замовлень ↓`}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Documents Section */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('documents')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              <span className="font-medium">Документи ({documents.length} файлів)</span>
            </div>
            {expandedSections.documents ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.documents && (
            <div className="border-t px-4 py-3 space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">{doc.name}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(doc.created_at)} · {formatFileSize(doc.size)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payments Section */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('payments')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-500" />
              <span className="font-medium">
                Оплати ({payments.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-green-600">
                {formatAmount(payments.reduce((s, p) => p.status === 'completed' ? s + p.amount : s, 0))}
              </span>
              {expandedSections.payments ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </button>

          {expandedSections.payments && (
            <div className="border-t px-4 py-3 space-y-2">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        payment.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                      )}
                    />
                    <div>
                      <div className="text-sm text-gray-700">
                        {formatDate(payment.created_at)} · {payment.method}
                      </div>
                      <div className="text-xs text-gray-500">{payment.order_number}</div>
                    </div>
                  </div>
                  <div className="font-medium text-gray-900">
                    {formatAmount(payment.amount)}
                    {payment.status === 'completed' && <span className="ml-1 text-green-500">✓</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Translators Section */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('translators')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              <span className="font-medium">Перекладачі ({translators.length})</span>
            </div>
            {expandedSections.translators ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.translators && (
            <div className="border-t px-4 py-3 space-y-2">
              {translators.map((translator) => (
                <div
                  key={translator.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">{translator.name}</div>
                      <div className="text-xs text-gray-500">
                        {translator.languages.join(', ')}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {translator.orders_count} замовлень
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delivery Section */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('delivery')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-orange-500" />
              <span className="font-medium">Доставка / Видача</span>
            </div>
            {expandedSections.delivery ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.delivery && (
            <div className="border-t px-4 py-3 space-y-2">
              {deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Truck
                      className={cn(
                        'w-5 h-5',
                        delivery.status === 'delivered' ? 'text-green-500' : 'text-orange-500'
                      )}
                    />
                    <div>
                      <div className="text-sm text-gray-700">
                        {delivery.order_number} →{' '}
                        {delivery.method === 'inpost' ? 'InPost' : 'Samovyviz'}
                        {delivery.tracking_number && `: ${delivery.tracking_number}`}
                        {delivery.address && `: ${delivery.address}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {delivery.status === 'delivered' && delivery.delivered_at
                          ? `Доставлено ${formatDate(delivery.delivered_at)}`
                          : delivery.status === 'in_transit'
                          ? 'В дорозі'
                          : 'Очікується'}
                      </div>
                    </div>
                  </div>
                  {delivery.tracking_number && (
                    <Button variant="ghost" size="sm" asChild>
                      <a
                        href={`https://inpost.pl/sledzenie-przesylek?number=${delivery.tracking_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Internal Notes Section */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('notes')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-yellow-500" />
              <span className="font-medium">Internal Notes ({notes.length})</span>
            </div>
            {expandedSections.notes ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSections.notes && (
            <div className="border-t px-4 py-3 space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                  <div className="text-xs text-yellow-700 mb-1">
                    [{note.author}, {formatDateTime(note.created_at)}]
                  </div>
                  <p className="text-sm text-gray-700">{note.content}</p>
                </div>
              ))}

              <div className="pt-2 border-t">
                <Textarea
                  placeholder="Додати нотатку..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="mb-2"
                  rows={2}
                />
                <Button
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-600"
                  disabled={!newNote.trim()}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Додати нотатку
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

