import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Separator } from '../../../components/ui/separator';
import { Progress } from '../../../components/ui/progress';
import { 
  Clock, 
  User, 
  Package,
  MapPin,
  Mail,
  Phone,
  FileText,
  Truck,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  Edit2,
  Download,
  Send,
  Copy,
  ExternalLink
} from 'lucide-react';
import { cn } from '../../../components/ui/utils';
import { TimelineVisualization } from './TimelineVisualization';
import { toast } from 'sonner';
import type { Order } from '../api/clients';
import type { TimelineStep } from '../api/timeline';

interface OrderDetailsDialogProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  timelineSteps: TimelineStep[];
  isLoading: boolean;
}

// Конфігурація статусів
const STATUS_CONFIG = {
  do_wykonania: { 
    label: 'Нове', 
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: Package
  },
  do_poswiadczenia: { 
    label: 'В роботі', 
    color: 'bg-amber-500',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: Clock
  },
  do_wydania: { 
    label: 'Готово', 
    color: 'bg-emerald-500',
    textColor: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: CheckCircle2
  },
  ustne: { 
    label: 'Усний', 
    color: 'bg-purple-500',
    textColor: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    icon: User
  },
  closed: { 
    label: 'Видано', 
    color: 'bg-slate-500',
    textColor: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    icon: CheckCircle2
  },
} as const;

// Функція парсингу деталей (використовуємо ту саму логіку, що і в OrdersListPage)
function parseOrderDetails(text: string | null | undefined) {
  if (!text) {
    return {
      price: null,
      languages: null,
      type: null,
      delivery: null,
      address: null,
      email: null,
      phone: null,
      cleanDescription: "",
    };
  }

  // Витягуємо ціну (наприклад: "200 zł", "150₴", "$50", "100€", "Ціна: 200 zł")
  const priceMatch = text.match(/(?:Ціна|Price|Cena):\s*(\d+\s?(?:zł|₴|\$|€|EUR|USD|PLN))|(\d+\s?(?:zł|₴|\$|€|EUR|USD|PLN))/i);
  const price = priceMatch ? (priceMatch[1] || priceMatch[2]) : null;
  
  // Витягуємо одну мову (не пару) - наприклад: "Англійська", "Португальська", "Мова: Англійська"
  // Шукаємо мову після "Мова:" або просто назву мови
  const langMatch = text.match(/(?:Мова|Language|Język):\s*([А-Яа-яA-Za-zіїєґІЇЄҐ]+(?:ська|ський|ське|ські)?)/i);
  let languages = langMatch ? langMatch[1].trim() : null;
  
  // Якщо не знайдено через "Мова:", шукаємо просто назви мов
  if (!languages) {
    const commonLanguages = ['Англійська', 'Португальська', 'Німецька', 'Французька', 'Іспанська', 'Італійська', 'Польська', 'Українська', 'Російська', 'English', 'Portuguese', 'German', 'French', 'Spanish', 'Italian', 'Polish', 'Ukrainian', 'Russian'];
    for (const lang of commonLanguages) {
      if (text.includes(lang)) {
        languages = lang;
        break;
      }
    }
  }
  
  // Витягуємо тип документа
  let typeMatch = text.match(/(?:Тип документа|Тип|Document type|Rodzaj):\s*([^|,\n]+)/i);
  let type = typeMatch ? typeMatch[1].trim() : null;
  
  // Якщо тип містить "UMOWA", не додаємо "ДОГОВІР"
  if (type && /umowa/i.test(type)) {
    // Видаляємо "ДОГОВІР" або "Договір" з типу, якщо воно там є
    type = type.replace(/\s*-\s*ДОГОВІР|\s*-\s*Договір|\s*-\s*договір/gi, '').trim();
  }
  
  // Витягуємо доставку
  const deliveryMatch = text.match(/(?:Доставка|Delivery|Dostawa):\s?([^|,\n]+)/i);
  const delivery = deliveryMatch ? deliveryMatch[1].trim() : null;
  
  // Витягуємо адресу
  const addressMatch = text.match(/(?:Адреса|Address|Adres):\s?([^|,\n]+)/i);
  const address = addressMatch ? addressMatch[1].trim() : null;
  
  // Витягуємо email
  const emailMatch = text.match(/(?:Email|E-mail):\s?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  const email = emailMatch ? emailMatch[1] : null;
  
  // Витягуємо телефон
  const phoneMatch = text.match(/(?:Телефон|Phone|Telefon):\s?([+\d\s\-()]{7,15})/i);
  const phone = phoneMatch ? phoneMatch[1].trim() : null;

  return {
    price,
    languages,
    type,
    delivery,
    address,
    email,
    phone,
  };
}

export function OrderDetailsDialog({
  order,
  isOpen,
  onClose,
  timelineSteps,
  isLoading,
}: OrderDetailsDialogProps) {
  if (!order) return null;

  const statusConfig = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.do_wykonania;
  const StatusIcon = statusConfig.icon;
  const details = parseOrderDetails(order.description);
  
  // Перевірка дедлайну
  const isOverdue = order.deadline && new Date(order.deadline) < new Date() 
    && order.status !== 'closed' 
    && order.status !== 'do_wydania';
  
  // Форматування дати
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  // Прогрес
  const completedSteps = timelineSteps.filter(s => s.completed).length;
  const totalSteps = 7;
  const progress = Math.round((completedSteps / totalSteps) * 100);

  // Копіювання тексту
  const copyToClipboard = async (text: string, label: string = 'Текст') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} скопійовано в буфер обміну`);
    } catch (error) {
      toast.error('Не вдалося скопіювати');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
        {/* Шапка з градієнтом та статусом */}
        <div className={cn(
          "relative px-4 sm:px-8 py-6 bg-gradient-to-br from-slate-50 to-white border-b",
          "before:absolute before:inset-0 before:bg-gradient-to-r",
          statusConfig.color === 'bg-blue-500' && "before:from-blue-500/5 before:to-blue-500/0",
          statusConfig.color === 'bg-amber-500' && "before:from-amber-500/5 before:to-amber-500/0",
          statusConfig.color === 'bg-emerald-500' && "before:from-emerald-500/5 before:to-emerald-500/0",
          statusConfig.color === 'bg-purple-500' && "before:from-purple-500/5 before:to-purple-500/0",
          statusConfig.color === 'bg-slate-500' && "before:from-slate-500/5 before:to-slate-500/0"
        )}>
          <div className="relative">
            {/* Верхня частина: номер + статус */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  statusConfig.bgColor,
                  statusConfig.borderColor,
                  "border-2 shadow-sm"
                )}>
                  <StatusIcon className={cn("w-6 h-6", statusConfig.textColor)} />
                </div>
                <div>
                  <div className="text-sm text-slate-500 font-medium mb-1">
                    Замовлення
                  </div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                    {order.order_number}
                  </div>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Статус та прогрес */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <Badge 
                variant="outline"
                className={cn(
                  "px-3 py-1.5 text-sm font-semibold border-2",
                  statusConfig.bgColor,
                  statusConfig.textColor,
                  statusConfig.borderColor
                )}
              >
                {statusConfig.label}
              </Badge>
              
              <div className="flex-1 flex items-center gap-3 w-full sm:w-auto">
                <Progress 
                  value={progress} 
                  className="h-2 flex-1"
                />
                <span className="text-sm font-semibold text-slate-600 min-w-[4rem] text-right">
                  {completedSteps}/{totalSteps} етапів
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Основний контент */}
        <ScrollArea className="max-h-[calc(85vh-180px)]">
          <div className="px-4 sm:px-8 py-6 space-y-6">
            
            {/* Блок: Основна інформація */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <div className="w-1 h-4 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full" />
                Основна інформація
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Клієнт */}
                <InfoCard
                  icon={<User className="w-5 h-5 text-blue-500" />}
                  label="Клієнт"
                  value={order.client?.full_name || '—'}
                  bgColor="bg-blue-50"
                  actions={
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-7 text-xs"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Профіль
                    </Button>
                  }
                />

                {/* Дедлайн */}
                <InfoCard
                  icon={
                    isOverdue ? (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Calendar className="w-5 h-5 text-emerald-500" />
                    )
                  }
                  label="Дедлайн"
                  value={
                    order.deadline ? (
                      <span className={cn(
                        "font-semibold",
                        isOverdue ? "text-red-600" : "text-slate-900"
                      )}>
                        {formatDate(order.deadline)}
                        {isOverdue && (
                          <span className="ml-2 text-xs text-red-500 font-bold uppercase">
                            Прострочено!
                          </span>
                        )}
                      </span>
                    ) : '—'
                  }
                  bgColor={isOverdue ? "bg-red-50" : "bg-emerald-50"}
                />
              </div>
            </section>

            {/* Блок: Деталі замовлення */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full" />
                Деталі замовлення
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Тип документу */}
                <InfoCard
                  icon={<FileText className="w-5 h-5 text-indigo-500" />}
                  label="Тип документу"
                  value={
                    details.type ? (
                      <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 font-bold">
                        {details.type}
                      </Badge>
                    ) : '—'
                  }
                  bgColor="bg-indigo-50"
                />

                {/* Мова */}
                <InfoCard
                  icon={<span className="text-xl">🌐</span>}
                  label="Мова"
                  value={
                    details.languages ? (
                      <span className="text-sm font-semibold text-slate-700">
                        {details.languages}
                      </span>
                    ) : '—'
                  }
                  bgColor="bg-blue-50"
                />

                {/* Ціна */}
                <InfoCard
                  icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
                  label="Вартість"
                  value={
                    details.price ? (
                      <span className="text-lg font-bold text-emerald-600">
                        {details.price}
                      </span>
                    ) : '—'
                  }
                  bgColor="bg-emerald-50"
                />
              </div>
            </section>

            {/* Блок: Доставка та контакти */}
            {(details.delivery || details.address || details.email || details.phone) && (
              <section>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <div className="w-1 h-4 bg-gradient-to-b from-teal-500 to-teal-600 rounded-full" />
                  Доставка та контакти
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Доставка */}
                  {details.delivery && (
                    <InfoCard
                      icon={<Truck className="w-5 h-5 text-orange-500" />}
                      label="Спосіб доставки"
                      value={details.delivery}
                      bgColor="bg-orange-50"
                      actions={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-7 text-xs"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Відстежити
                        </Button>
                      }
                    />
                  )}

                  {/* Адреса */}
                  {details.address && (
                    <InfoCard
                      icon={<MapPin className="w-5 h-5 text-red-500" />}
                      label="Адреса"
                      value={details.address}
                      bgColor="bg-red-50"
                      actions={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => copyToClipboard(details.address!, 'Адресу')}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Копіювати
                        </Button>
                      }
                    />
                  )}

                  {/* Email */}
                  {details.email && (
                    <InfoCard
                      icon={<Mail className="w-5 h-5 text-blue-500" />}
                      label="Email"
                      value={details.email}
                      bgColor="bg-blue-50"
                      actions={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => copyToClipboard(details.email!, 'Email')}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Копіювати
                        </Button>
                      }
                    />
                  )}

                  {/* Телефон */}
                  {details.phone && (
                    <InfoCard
                      icon={<Phone className="w-5 h-5 text-green-500" />}
                      label="Телефон"
                      value={details.phone}
                      bgColor="bg-green-50"
                      actions={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => copyToClipboard(details.phone!, 'Телефон')}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Копіювати
                        </Button>
                      }
                    />
                  )}
                </div>
              </section>
            )}

            <Separator />

            {/* Timeline */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <div className="w-1 h-4 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full" />
                Етапи виконання
              </h3>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : timelineSteps.length === 0 ? (
                <EmptyState />
              ) : (
                <TimelineVisualization steps={timelineSteps} />
              )}
            </section>
          </div>
        </ScrollArea>

        {/* Футер з діями */}
        <div className="px-4 sm:px-8 py-4 bg-slate-50 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" className="h-9">
              <Edit2 className="w-4 h-4 mr-2" />
              Редагувати
            </Button>
            <Button variant="outline" size="sm" className="h-9">
              <Download className="w-4 h-4 mr-2" />
              Завантажити
            </Button>
          </div>
          
          <Button 
            size="sm" 
            className="h-9 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 w-full sm:w-auto"
          >
            <Send className="w-4 h-4 mr-2" />
            Надіслати клієнту
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Компонент картки інформації
interface InfoCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  bgColor?: string;
  actions?: React.ReactNode;
}

function InfoCard({ icon, label, value, bgColor = "bg-slate-50", actions }: InfoCardProps) {
  return (
    <div className={cn(
      "p-4 rounded-xl border border-slate-200",
      bgColor,
      "transition-all duration-200 hover:shadow-sm"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {label}
          </span>
        </div>
        {actions}
      </div>
      <div className="text-sm text-slate-900">
        {value}
      </div>
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <Clock className="w-8 h-8 text-slate-400" />
      </div>
      <h4 className="text-base font-semibold text-slate-900 mb-1">
        Немає етапів timeline
      </h4>
      <p className="text-sm text-slate-500">
        Етапи будуть додаватися автоматично при виконанні дій
      </p>
    </div>
  );
}

