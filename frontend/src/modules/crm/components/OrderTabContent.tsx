import React, { useState } from 'react';
import {
  Package,
  User,
  Phone,
  Mail,
  Globe,
  FileText,
  CreditCard,
  Truck,
  Clock,
  Calendar,
  CheckCircle2,
  Circle,
  Users,
  StickyNote,
  Plus,
  ExternalLink,
  Download,
  Eye,
  Edit2,
  AlertCircle,
  ArrowRight,
  DollarSign,
  Percent,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Textarea } from '../../../components/ui/textarea';
import { cn } from '../../../components/ui/utils';
import type { Order, TimelineStep, TranslationRequest } from '../api/clients';
import { ProgressTimeline, type TimelineStep as ProgressTimelineStep } from './ProgressTimeline';

// Timeline step definitions
const TIMELINE_STEPS = [
  { key: 'client_created', label: 'Створено клієнта', icon: User },
  { key: 'order_created', label: 'Створено замовлення', icon: Package },
  { key: 'payment_link_sent', label: 'Надіслано лінк оплати', icon: CreditCard },
  { key: 'payment_received', label: 'Оплачено', icon: CheckCircle2 },
  { key: 'translator_assigned', label: 'Призначено перекладача', icon: Users },
  { key: 'translation_ready', label: 'Перекладено', icon: FileText },
  { key: 'issued_sent', label: 'Видано/Відправлено', icon: Truck },
] as const;

interface InternalNote {
  id: string;
  author: string;
  content: string;
  created_at: string;
}

interface Document {
  id: string;
  name: string;
  type: 'original' | 'translated';
  size: number;
  created_at: string;
  uploaded_by?: string;
}

interface PaymentInfo {
  method: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  paid_at?: string;
  transaction_id?: string;
}

interface DeliveryInfo {
  method: 'inpost' | 'pickup';
  tracking_number?: string;
  address?: string;
  status: 'pending' | 'in_transit' | 'delivered';
  created_at?: string;
  delivered_at?: string;
}

interface TranslatorDetails {
  id: number;
  name: string;
  email: string;
  phone: string;
  rate: number;
  deadline?: string;
  status: 'pending' | 'accepted' | 'completed';
  accepted_at?: string;
  completed_at?: string;
}

interface OrderTabContentProps {
  order: Order;
  onEditOrder: () => void;
  onOpenClient?: (clientId: string) => void;
  isLoading?: boolean;
}

export function OrderTabContent({
  order,
  onEditOrder,
  onOpenClient,
  isLoading = false,
}: OrderTabContentProps) {
  const [newNote, setNewNote] = useState('');

  // Mock data - in real app would be loaded from API
  const [documents] = useState<Document[]>([
    { id: '1', name: 'TRC_original_dnk.pdf', type: 'original', size: 1.8 * 1024 * 1024, created_at: '2026-01-02', uploaded_by: 'Клієнт' },
    { id: '2', name: 'TRC_translated_dnk.pdf', type: 'translated', size: 2.3 * 1024 * 1024, created_at: '2026-01-04', uploaded_by: 'Олена Kowalska' },
  ]);

  const [payment] = useState<PaymentInfo>({
    method: 'Przelew24',
    amount: 200,
    status: 'completed',
    paid_at: '2026-01-02T10:15:00',
    transaction_id: 'P24_XYZ123456',
  });

  const [delivery] = useState<DeliveryInfo>({
    method: 'inpost',
    tracking_number: 'XYZ123456789',
    status: 'delivered',
    created_at: '2026-01-05T10:00:00',
    delivered_at: '2026-01-16T14:30:00',
  });

  const [translator] = useState<TranslatorDetails>({
    id: 1,
    name: 'Олена Kowalska',
    email: 'olena@example.com',
    phone: '+48 987 654 321',
    rate: 60,
    deadline: '2026-01-04T18:00:00',
    status: 'completed',
    accepted_at: '2026-01-02T11:30:00',
    completed_at: '2026-01-04T16:00:00',
  });

  const [notes] = useState<InternalNote[]>([
    { id: '1', author: 'Оля', content: 'Клієнт просив терміново', created_at: '2026-01-02T09:30:00' },
    { id: '2', author: 'Марта', content: 'Олена взяла в роботу', created_at: '2026-01-02T11:45:00' },
    { id: '3', author: 'Оля', content: 'Переклад готовий, якість ок', created_at: '2026-01-04T16:15:00' },
  ]);

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

  // Build timeline from order data
  const getTimelineData = () => {
    const steps = order.timeline_steps || [];
    
    return TIMELINE_STEPS.map((stepDef) => {
      const step = steps.find((s) => s.step_type === stepDef.key);
      
      let details: string | null = null;
      let subDetails: string | null = null;

      // Add specific details based on step type
      switch (stepDef.key) {
        case 'client_created':
          if (step?.completed) {
            details = `Менеджер: ${step.completed_by_id || 'Оля'}`;
          }
          break;
        case 'order_created':
          if (step?.completed) {
            details = `Менеджер: ${step.completed_by_id || 'Оля'}`;
          }
          break;
        case 'payment_link_sent':
          if (step?.completed) {
            const meta = step.metadata ? JSON.parse(step.metadata) : null;
            details = `${payment.method}: ${formatAmount(payment.amount)}`;
          }
          break;
        case 'payment_received':
          if (step?.completed) {
            details = `${payment.method}: ${formatAmount(payment.amount)} (успішно)`;
          }
          break;
        case 'translator_assigned':
          if (step?.completed) {
            details = `${translator.name} (${formatAmount(translator.rate)})`;
            if (translator.accepted_at) {
              subDetails = `Прийнято: ${formatDateTime(translator.accepted_at)}`;
            }
          }
          break;
        case 'translation_ready':
          if (step?.completed) {
            details = translator.name;
            if (translator.completed_at && translator.deadline) {
              const completed = new Date(translator.completed_at);
              const deadline = new Date(translator.deadline);
              subDetails = completed <= deadline ? 'Завершено вчасно ✅' : 'Завершено із запізненням';
            }
          }
          break;
        case 'issued_sent':
          if (step?.completed) {
            if (delivery.method === 'inpost') {
              details = `InPost: ${delivery.tracking_number}`;
            } else {
              details = `Samovyviz: ${delivery.address}`;
            }
            if (delivery.delivered_at) {
              subDetails = `Доставлено: ${formatDate(delivery.delivered_at)} ✅`;
            }
          }
          break;
      }

      return {
        ...stepDef,
        completed: step?.completed || false,
        completedAt: step?.completed_at,
        details,
        subDetails,
      };
    });
  };

  const timeline = getTimelineData();
  const completedSteps = timeline.filter((s) => s.completed).length;
  const totalPrice = order.transactions?.reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum, 0) || payment.amount;
  const translatorFee = translator.rate;
  const profit = totalPrice - translatorFee;
  const profitPercent = totalPrice > 0 ? Math.round((profit / totalPrice) * 100) : 0;

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
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center shadow-sm border border-orange-200">
              <Package className="w-8 h-8 text-[#FF5A00]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Замовлення {order.order_number}
              </h2>
              <div className="flex items-center flex-wrap gap-3 text-sm text-gray-500 mt-2">
                <Badge
                  className={cn(
                    'px-3 py-1 border',
                    order.status === 'closed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    order.status === 'do_wydania' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                    'bg-amber-100 text-amber-700 border-amber-200'
                  )}
                >
                  {order.status}
                </Badge>
                <span className="flex items-center gap-1.5 text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {formatDate(order.created_at)}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onEditOrder} className="shrink-0">
            <Edit2 className="w-4 h-4 mr-2" />
            Редагувати
          </Button>
        </div>

        {/* Progress Timeline */}
        <div className="bg-gradient-to-br from-gray-50 to-white border rounded-xl p-6">
          <ProgressTimeline 
            steps={timeline.map((step, i) => ({
              step: i + 1,
              label: step.label,
              completed: step.completed,
              timestamp: step.completedAt ? formatDateTime(step.completedAt) : undefined,
              details: step.details || undefined,
            }))}
            completedSteps={completedSteps}
          />
        </div>

        {/* Order Details */}
        <div className="bg-white border rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-5">
            <FileText className="w-5 h-5 text-blue-500" />
            Деталі замовлення
          </h3>
          
          <div className="space-y-5">
            {/* Client info */}
              {order.client && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Клієнт</h4>
                <div className="space-y-2.5">
                  <div
                    className={cn(
                      'flex items-center gap-3',
                      onOpenClient && 'cursor-pointer hover:text-blue-600 group'
                    )}
                    onClick={() => order.client?.id && onOpenClient?.(order.client.id)}
                  >
                    <User className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                    <span className="text-gray-800 font-medium">{order.client.full_name}</span>
                    {onOpenClient && <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />}
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">{order.client.phone}</span>
                  </div>
                  {order.client.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-700">{order.client.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">Джерело: <span className="font-medium">{order.client.source}</span></span>
                  </div>
                </div>
              </div>
              )}

            {/* Order info */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Інформація про замовлення</h4>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                  <span className="text-gray-700 leading-relaxed">
                  {order.description || 'TRC (Присяжний переклад)'}
                </span>
              </div>
              {order.deadline && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-700">
                      Дедлайн: <span className="font-medium">{formatDateTime(order.deadline)}</span>
                      {new Date(order.deadline) > new Date() 
                        ? <span className="ml-2 text-emerald-500">✅</span> 
                        : <span className="ml-2 text-amber-500">⚠️</span>}
                  </span>
                </div>
              )}
              </div>
            </div>
          </div>

          {/* Financial summary */}
          <div className="mt-6 pt-5 border-t border-gray-200">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Фінанси</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="text-xs text-blue-600 mb-2 font-medium">Ціна для клієнта</div>
                <div className="text-xl font-bold text-blue-700">
                {formatAmount(totalPrice)}
              </div>
            </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-100">
                <div className="text-xs text-purple-600 mb-2 font-medium">Гонорар перекладача</div>
                <div className="text-xl font-bold text-purple-700">
                {formatAmount(translatorFee)}
                </div>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="text-xs text-emerald-600 mb-2 font-medium">Прибуток</div>
                <div className="text-xl font-bold text-emerald-700">
                  {formatAmount(profit)} <span className="text-sm font-semibold">({profitPercent}%)</span>
            </div>
              </div>
            </div>
          </div>
        </div>

        {/* Translator Section */}
        <div className="bg-white border rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-5">
            <Users className="w-5 h-5 text-purple-500" />
            Перекладач
          </h3>
          
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-lg text-gray-900">{translator.name}</div>
              
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-700">{translator.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-700">{translator.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <DollarSign className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-gray-700">Гонорар: <span className="font-semibold text-purple-600">{formatAmount(translator.rate)}</span></span>
                </div>
                {translator.deadline && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-gray-700">Дедлайн: <span className="font-medium">{formatDateTime(translator.deadline)}</span></span>
                  </div>
                )}
              </div>
              
              {/* Status */}
              <div className="mt-4">
                <Badge
                  className={cn(
                    'px-3 py-1 text-sm',
                    translator.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                    translator.status === 'accepted' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                    'bg-yellow-100 text-yellow-700 border border-yellow-200'
                  )}
                >
                  {translator.status === 'completed' ? '✓ Завершено вчасно' :
                   translator.status === 'accepted' ? '→ Прийнято' : '⏳ Очікує'}
                </Badge>
              </div>

              {/* Request history */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Історія запитів:</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="text-gray-400">•</span>
                    <span>[02.01 11:00] Відправлено запит (Email)</span>
                  </div>
                  {translator.accepted_at && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <span className="text-emerald-400">•</span>
                      <span>[{formatDateTime(translator.accepted_at)}] ✅ Прийнято</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Section */}
        <div className="bg-white border rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-5">
            <CreditCard className="w-5 h-5 text-emerald-500" />
            Оплата
          </h3>
          
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Метод</div>
              <div className="font-semibold text-gray-900">{payment.method}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Сума</div>
              <div className="font-bold text-lg text-emerald-600">{formatAmount(payment.amount)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Статус</div>
              <Badge className={cn(
                'px-3 py-1',
                payment.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                payment.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                'bg-red-100 text-red-700 border border-red-200'
              )}>
                {payment.status === 'completed' ? '✅ Оплачено' :
                 payment.status === 'pending' ? '⏳ Очікує' : '✗ Помилка'}
              </Badge>
            </div>
            {payment.paid_at && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Дата оплати</div>
                <div className="font-medium text-gray-900">{formatDateTime(payment.paid_at)}</div>
              </div>
            )}
          </div>
          
          {payment.transaction_id && (
            <div className="mt-5 pt-4 border-t border-gray-200">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Transaction ID</div>
              <div className="font-mono text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{payment.transaction_id}</div>
            </div>
          )}
          
          <Button variant="outline" size="sm" className="mt-5">
            <Eye className="w-4 h-4 mr-2" />
            Переглянути чек
          </Button>
        </div>

        {/* Delivery Section */}
        <div className="bg-white border rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-5">
            <Truck className="w-5 h-5 text-orange-500" />
            Доставка
          </h3>
          
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Спосіб</div>
              <div className="font-semibold text-gray-900">
                {delivery.method === 'inpost' ? 'InPost (Paczkomat)' : 'Самовивіз'}
              </div>
            </div>
            {delivery.tracking_number && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tracking</div>
                <div className="font-mono text-sm text-gray-900">{delivery.tracking_number}</div>
              </div>
            )}
            {delivery.created_at && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Створено</div>
                <div className="font-medium text-gray-900">{formatDateTime(delivery.created_at)}</div>
              </div>
            )}
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Статус</div>
              <Badge className={cn(
                'px-3 py-1',
                delivery.status === 'delivered' ? 'bg-green-100 text-green-700 border border-green-200' :
                delivery.status === 'in_transit' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                'bg-yellow-100 text-yellow-700 border border-yellow-200'
              )}>
                {delivery.status === 'delivered' 
                  ? `✓ Доставлено ${delivery.delivered_at ? formatDate(delivery.delivered_at) : ''}` 
                  : delivery.status === 'in_transit' ? '📦 В дорозі' : '⏳ Очікується'}
              </Badge>
            </div>
          </div>
          
          {delivery.tracking_number && (
            <Button variant="outline" size="sm" className="mt-5" asChild>
              <a
                href={`https://inpost.pl/sledzenie-przesylek?number=${delivery.tracking_number}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Відстежити посилку
              </a>
            </Button>
          )}
        </div>

        {/* Documents Section */}
        <div className="bg-white border rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-5">
            <FileText className="w-5 h-5 text-blue-500" />
            Документи
            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {documents.length}
            </span>
          </h3>
          
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border",
                  doc.type === 'original' 
                    ? 'bg-gray-50 border-gray-200' 
                    : 'bg-blue-50/50 border-blue-200'
                )}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                    doc.type === 'original' ? 'bg-gray-200' : 'bg-blue-200'
                  )}>
                  <FileText className={cn(
                    'w-5 h-5',
                      doc.type === 'original' ? 'text-gray-600' : 'text-blue-600'
                  )} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{doc.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatDate(doc.created_at)} · {formatFileSize(doc.size)}
                    </div>
                    {doc.uploaded_by && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {doc.type === 'original' ? '📄 Оригінал від' : '📝 Переклад від'} {doc.uploaded_by}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Button variant="outline" size="sm" className="h-8">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Internal Notes Section */}
        <div className="bg-white border rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-5">
            <StickyNote className="w-5 h-5 text-amber-500" />
            Внутрішні нотатки
            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {notes.length}
            </span>
          </h3>
          
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="p-4 bg-amber-50/70 rounded-xl border border-amber-200">
                <div className="flex items-center gap-2 text-xs text-amber-700 mb-2">
                  <span className="font-semibold">{note.author}</span>
                  <span className="text-amber-500">•</span>
                  <span>{formatDateTime(note.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{note.content}</p>
              </div>
            ))}

            <div className="pt-4 border-t border-gray-200">
              <Textarea
                placeholder="Написати нотатку..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="mb-3 resize-none"
                rows={3}
              />
              <Button
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-white"
                disabled={!newNote.trim()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Додати нотатку
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

