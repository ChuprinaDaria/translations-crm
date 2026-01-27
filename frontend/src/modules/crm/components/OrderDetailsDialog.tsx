import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { ScrollArea } from '../../../components/ui/scroll-area';
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
import { toast } from 'sonner';
import type { Order } from '../api/clients';

interface OrderDetailsDialogProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
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
      <DialogContent 
        className="w-full max-w-[calc(100vw-1rem)] sm:w-[30vw] sm:max-w-[30vw] h-full sm:h-screen max-h-screen p-0 gap-0 overflow-hidden flex flex-col !fixed !top-0 !right-0 !left-auto !bottom-0 !translate-x-0 !translate-y-0 rounded-none sm:rounded-l-xl border-l border-t-0 border-r-0 border-b-0 z-[100]"
        aria-labelledby="order-dialog-title"
        aria-describedby="order-dialog-description"
      >
        <DialogHeader className="sr-only">
          <DialogTitle id="order-dialog-title">Деталі замовлення {order.order_number}</DialogTitle>
          <DialogDescription id="order-dialog-description">
            Перегляд детальної інформації про замовлення
          </DialogDescription>
        </DialogHeader>
        {/* Шапка з градієнтом та статусом */}
        <div className={cn(
          "relative px-3 sm:px-4 py-3 bg-gradient-to-br from-slate-50 to-white border-b shrink-0",
          "before:absolute before:inset-0 before:bg-gradient-to-r",
          statusConfig.color === 'bg-blue-500' && "before:from-blue-500/5 before:to-blue-500/0",
          statusConfig.color === 'bg-amber-500' && "before:from-amber-500/5 before:to-amber-500/0",
          statusConfig.color === 'bg-emerald-500' && "before:from-emerald-500/5 before:to-emerald-500/0",
          statusConfig.color === 'bg-purple-500' && "before:from-purple-500/5 before:to-purple-500/0",
          statusConfig.color === 'bg-slate-500' && "before:from-slate-500/5 before:to-slate-500/0"
        )}>
          <div className="relative">
            {/* Верхня частина: номер + статус */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  statusConfig.bgColor,
                  statusConfig.borderColor,
                  "border-2 shadow-sm"
                )}>
                  <StatusIcon className={cn("w-4 h-4", statusConfig.textColor)} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-500 font-medium mb-0.5">
                    Замовлення
                  </div>
                  <div className="text-lg font-bold text-slate-900 font-mono tracking-tight truncate">
                    {order.order_number}
                  </div>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onClose}
                className="h-7 w-7 rounded-full hover:bg-slate-100 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Статус */}
            <div className="flex items-center">
              <Badge 
                variant="outline"
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-semibold border",
                  statusConfig.bgColor,
                  statusConfig.textColor,
                  statusConfig.borderColor
                )}
              >
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Основний контент */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-3 sm:px-4 py-3 space-y-3">
            
            {/* Блок: Основна інформація */}
            <section>
              <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <div className="w-0.5 h-2.5 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full" />
                Основна інформація
              </h3>
              
              <div className="grid grid-cols-1 gap-2">
                {/* Клієнт */}
                <InfoCard
                  icon={<User className="w-4 h-4 text-blue-500" />}
                  label="Клієнт"
                  value={order.client?.full_name || '—'}
                  bgColor="bg-blue-50"
                  actions={
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 text-xs px-2"
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                  }
                />

                {/* Дедлайн */}
                <InfoCard
                  icon={
                    isOverdue ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <Calendar className="w-4 h-4 text-emerald-500" />
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
              <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <div className="w-0.5 h-2.5 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full" />
                Деталі замовлення
              </h3>
              
              <div className="grid grid-cols-1 gap-2">
                {/* Тип документу */}
                <InfoCard
                  icon={<FileText className="w-4 h-4 text-indigo-500" />}
                  label="Тип документу"
                  value={
                    details.type ? (
                      <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 font-bold text-[10px] px-1.5 py-0.5">
                        {details.type}
                      </Badge>
                    ) : '—'
                  }
                  bgColor="bg-indigo-50"
                />

                {/* Мова */}
                <InfoCard
                  icon={<span className="text-base">🌐</span>}
                  label="Мова"
                  value={
                    details.languages ? (
                      <span className="text-xs font-semibold text-slate-700">
                        {details.languages}
                      </span>
                    ) : '—'
                  }
                  bgColor="bg-blue-50"
                />

                {/* Ціна */}
                <InfoCard
                  icon={<DollarSign className="w-4 h-4 text-emerald-500" />}
                  label="Вартість"
                  value={
                    details.price ? (
                      <span className="text-sm font-bold text-emerald-600">
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
                <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <div className="w-0.5 h-2.5 bg-gradient-to-b from-teal-500 to-teal-600 rounded-full" />
                  Доставка та контакти
                </h3>
                
                <div className="grid grid-cols-1 gap-2">
                  {/* Доставка */}
                  {details.delivery && (
                    <InfoCard
                      icon={<Truck className="w-4 h-4 text-orange-500" />}
                      label="Спосіб доставки"
                      value={details.delivery}
                      bgColor="bg-orange-50"
                      actions={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-6 text-xs px-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      }
                    />
                  )}

                  {/* Адреса */}
                  {details.address && (
                    <InfoCard
                      icon={<MapPin className="w-4 h-4 text-red-500" />}
                      label="Адреса"
                      value={details.address}
                      bgColor="bg-red-50"
                      actions={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => copyToClipboard(details.address!, 'Адресу')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      }
                    />
                  )}

                  {/* Email */}
                  {details.email && (
                    <InfoCard
                      icon={<Mail className="w-4 h-4 text-blue-500" />}
                      label="Email"
                      value={details.email}
                      bgColor="bg-blue-50"
                      actions={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => copyToClipboard(details.email!, 'Email')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      }
                    />
                  )}

                  {/* Телефон */}
                  {details.phone && (
                    <InfoCard
                      icon={<Phone className="w-4 h-4 text-green-500" />}
                      label="Телефон"
                      value={details.phone}
                      bgColor="bg-green-50"
                      actions={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => copyToClipboard(details.phone!, 'Телефон')}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      }
                    />
                  )}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>

        {/* Футер з діями */}
        <div className="px-3 sm:px-4 py-2 bg-slate-50 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          <div className="flex flex-col sm:flex-row gap-1.5 flex-1">
            <Button variant="outline" size="sm" className="h-7 text-[10px] px-2">
              <Edit2 className="w-3 h-3 mr-1" />
              Редагувати
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[10px] px-2">
              <Download className="w-3 h-3 mr-1" />
              Завантажити
            </Button>
          </div>
          
          <Button 
            size="sm" 
            className="h-7 text-[10px] px-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 w-full sm:w-auto"
          >
            <Send className="w-3 h-3 mr-1" />
            Надіслати
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
      "p-2 rounded-lg border border-slate-200",
      bgColor,
      "transition-all duration-200 hover:shadow-sm"
    )}>
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="shrink-0">{icon}</div>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider truncate">
            {label}
          </span>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="text-[11px] text-slate-900 break-words">
        {value}
      </div>
    </div>
  );
}


