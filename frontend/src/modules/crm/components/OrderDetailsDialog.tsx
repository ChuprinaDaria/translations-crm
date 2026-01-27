import React, { useState } from 'react';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
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
  ExternalLink,
  Zap,
  Info,
  Contact,
  Globe
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
  const [activeTab, setActiveTab] = useState('overview');

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

  // Швидкі дії
  const quickActions = [
    {
      label: 'Копіювати номер',
      icon: Copy,
      onClick: () => copyToClipboard(order.order_number, 'Номер замовлення'),
    },
    {
      label: 'Копіювати всі контакти',
      icon: Contact,
      onClick: () => {
        const contacts = [
          details.email && `Email: ${details.email}`,
          details.phone && `Телефон: ${details.phone}`,
          details.address && `Адреса: ${details.address}`,
        ].filter(Boolean).join('\n');
        if (contacts) {
          copyToClipboard(contacts, 'Контакти');
        } else {
          toast.info('Немає контактів для копіювання');
        }
      },
    },
    {
      label: 'Відкрити клієнта',
      icon: Eye,
      onClick: () => {
        toast.info('Функція відкриття клієнта буде додана');
      },
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-5xl w-[85vw] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col z-[100]"
      >
        <VisuallyHidden.Root>
          <DialogHeader>
            <DialogTitle>Деталі замовлення {order.order_number}</DialogTitle>
            <DialogDescription>
              Перегляд детальної інформації про замовлення
            </DialogDescription>
          </DialogHeader>
        </VisuallyHidden.Root>

        {/* Шапка з градієнтом та статусом */}
        <div className={cn(
          "relative px-6 py-4 bg-gradient-to-br from-slate-50 to-white border-b shrink-0",
          "before:absolute before:inset-0 before:bg-gradient-to-r",
          statusConfig.color === 'bg-blue-500' && "before:from-blue-500/5 before:to-blue-500/0",
          statusConfig.color === 'bg-amber-500' && "before:from-amber-500/5 before:to-amber-500/0",
          statusConfig.color === 'bg-emerald-500' && "before:from-emerald-500/5 before:to-emerald-500/0",
          statusConfig.color === 'bg-purple-500' && "before:from-purple-500/5 before:to-purple-500/0",
          statusConfig.color === 'bg-slate-500' && "before:from-slate-500/5 before:to-slate-500/0"
        )}>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                statusConfig.bgColor,
                statusConfig.borderColor,
                "border-2 shadow-md transition-transform hover:scale-105"
              )}>
                <StatusIcon className={cn("w-6 h-6", statusConfig.textColor)} />
              </div>
              <div className="min-w-0">
                <div className="text-sm text-slate-500 font-medium mb-1">
                  Замовлення
                </div>
                <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                  {order.order_number}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge 
                    variant="outline"
                    className={cn(
                      "px-3 py-1 text-sm font-semibold border-2",
                      statusConfig.bgColor,
                      statusConfig.textColor,
                      statusConfig.borderColor,
                      "transition-all hover:shadow-md"
                    )}
                  >
                    {statusConfig.label}
                  </Badge>
                  {isOverdue && (
                    <Badge className="px-3 py-1 text-sm font-semibold bg-red-100 text-red-700 border-red-300 border-2">
                      Прострочено
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClose}
              className="h-10 w-10 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Таби та контент */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Таби */}
          <div className="px-6 pt-4 border-b bg-white shrink-0">
            <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-2">
              <TabsTrigger 
                value="overview" 
                className="px-4 py-2.5 text-sm font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 transition-all hover:bg-slate-50"
              >
                <Info className="w-4 h-4 mr-2" />
                Огляд
              </TabsTrigger>
              <TabsTrigger 
                value="details" 
                className="px-4 py-2.5 text-sm font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 transition-all hover:bg-slate-50"
              >
                <FileText className="w-4 h-4 mr-2" />
                Деталі
              </TabsTrigger>
              <TabsTrigger 
                value="contacts" 
                className="px-4 py-2.5 text-sm font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 transition-all hover:bg-slate-50"
              >
                <Contact className="w-4 h-4 mr-2" />
                Контакти
              </TabsTrigger>
              <TabsTrigger 
                value="actions" 
                className="px-4 py-2.5 text-sm font-medium data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900 transition-all hover:bg-slate-50"
              >
                <Zap className="w-4 h-4 mr-2" />
                Швидкі дії
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Основний контент */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6">
              {/* Таб: Огляд */}
              <TabsContent value="overview" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        className="h-8 px-3 text-sm hover:bg-blue-100 transition-colors"
                        onClick={() => toast.info('Функція відкриття клієнта буде додана')}
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        Переглянути
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
                          "text-base font-semibold",
                          isOverdue ? "text-red-600" : "text-slate-900"
                        )}>
                          {formatDate(order.deadline)}
                          {isOverdue && (
                            <span className="ml-2 text-sm text-red-500 font-bold">
                              Прострочено!
                            </span>
                          )}
                        </span>
                      ) : '—'
                    }
                    bgColor={isOverdue ? "bg-red-50" : "bg-emerald-50"}
                  />

                  {/* Тип документу */}
                  <InfoCard
                    icon={<FileText className="w-5 h-5 text-indigo-500" />}
                    label="Тип документу"
                    value={
                      details.type ? (
                        <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 font-semibold text-sm px-3 py-1">
                          {details.type}
                        </Badge>
                      ) : '—'
                    }
                    bgColor="bg-indigo-50"
                  />

                  {/* Мова */}
                  <InfoCard
                    icon={<Globe className="w-5 h-5 text-blue-500" />}
                    label="Мова"
                    value={
                      details.languages ? (
                        <span className="text-base font-semibold text-slate-700">
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

                  {/* Доставка */}
                  {details.delivery && (
                    <InfoCard
                      icon={<Truck className="w-5 h-5 text-orange-500" />}
                      label="Спосіб доставки"
                      value={<span className="text-base font-medium text-slate-900">{details.delivery}</span>}
                      bgColor="bg-orange-50"
                    />
                  )}
                </div>
              </TabsContent>

              {/* Таб: Деталі */}
              <TabsContent value="details" className="mt-0 space-y-4">
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-500" />
                      Детальна інформація
                    </h3>
                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {order.description || 'Немає опису'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="text-sm font-semibold text-blue-700 mb-2">Номер замовлення</div>
                      <div className="text-base font-mono font-bold text-blue-900">{order.order_number}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-8 px-3 text-sm hover:bg-blue-100"
                        onClick={() => copyToClipboard(order.order_number, 'Номер замовлення')}
                      >
                        <Copy className="w-4 h-4 mr-1.5" />
                        Копіювати
                      </Button>
                    </div>

                    {order.deadline && (
                      <div className={cn(
                        "rounded-lg p-4 border",
                        isOverdue ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
                      )}>
                        <div className={cn(
                          "text-sm font-semibold mb-2",
                          isOverdue ? "text-red-700" : "text-emerald-700"
                        )}>
                          Дедлайн
                        </div>
                        <div className={cn(
                          "text-base font-bold",
                          isOverdue ? "text-red-900" : "text-emerald-900"
                        )}>
                          {formatDate(order.deadline)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Таб: Контакти */}
              <TabsContent value="contacts" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Email */}
                  {details.email && (
                    <InfoCard
                      icon={<Mail className="w-5 h-5 text-blue-500" />}
                      label="Email"
                      value={<span className="text-base font-medium text-slate-900">{details.email}</span>}
                      bgColor="bg-blue-50"
                      actions={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 px-3 text-sm hover:bg-blue-100 transition-colors"
                          onClick={() => copyToClipboard(details.email!, 'Email')}
                        >
                          <Copy className="w-4 h-4 mr-1.5" />
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
                      value={<span className="text-base font-medium text-slate-900 font-mono">{details.phone}</span>}
                      bgColor="bg-green-50"
                      actions={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 px-3 text-sm hover:bg-green-100 transition-colors"
                          onClick={() => copyToClipboard(details.phone!, 'Телефон')}
                        >
                          <Copy className="w-4 h-4 mr-1.5" />
                          Копіювати
                        </Button>
                      }
                    />
                  )}

                  {/* Адреса */}
                  {details.address && (
                    <InfoCard
                      icon={<MapPin className="w-5 h-5 text-red-500" />}
                      label="Адреса"
                      value={<span className="text-base font-medium text-slate-900">{details.address}</span>}
                      bgColor="bg-red-50"
                      actions={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 px-3 text-sm hover:bg-red-100 transition-colors"
                          onClick={() => copyToClipboard(details.address!, 'Адресу')}
                        >
                          <Copy className="w-4 h-4 mr-1.5" />
                          Копіювати
                        </Button>
                      }
                    />
                  )}

                  {/* Доставка */}
                  {details.delivery && (
                    <InfoCard
                      icon={<Truck className="w-5 h-5 text-orange-500" />}
                      label="Спосіб доставки"
                      value={<span className="text-base font-medium text-slate-900">{details.delivery}</span>}
                      bgColor="bg-orange-50"
                    />
                  )}
                </div>

                {!details.email && !details.phone && !details.address && (
                  <div className="text-center py-12 text-slate-500">
                    <Contact className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-base">Немає контактної інформації</p>
                  </div>
                )}
              </TabsContent>

              {/* Таб: Швидкі дії */}
              <TabsContent value="actions" className="mt-0">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {quickActions.map((action, index) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={index}
                          onClick={action.onClick}
                          className={cn(
                            "p-4 rounded-lg border-2 border-slate-200 bg-white",
                            "hover:border-orange-300 hover:bg-orange-50",
                            "transition-all duration-200 hover:shadow-md hover:scale-105",
                            "flex flex-col items-center gap-3 text-center"
                          )}
                        >
                          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                            <Icon className="w-6 h-6 text-orange-600" />
                          </div>
                          <span className="text-sm font-semibold text-slate-900">
                            {action.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <h3 className="text-base font-semibold text-slate-900 mb-4">Основні дії</h3>
                    <div className="flex flex-wrap gap-3">
                      <Button 
                        variant="outline" 
                        size="default"
                        className="h-10 px-4 text-sm hover:bg-slate-100 transition-colors"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Редагувати замовлення
                      </Button>
                      <Button 
                        variant="outline" 
                        size="default"
                        className="h-10 px-4 text-sm hover:bg-slate-100 transition-colors"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Завантажити файли
                      </Button>
                      <Button 
                        variant="outline" 
                        size="default"
                        className="h-10 px-4 text-sm hover:bg-slate-100 transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Переглянути клієнта
                      </Button>
                      <Button 
                        size="default"
                        className="h-10 px-4 text-sm bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white transition-all hover:shadow-md"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Надіслати email
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        {/* Футер з діями */}
        <div className="px-6 py-4 bg-slate-50 border-t flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="default"
              className="h-10 px-4 text-sm hover:bg-white transition-colors"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Редагувати
            </Button>
            <Button 
              variant="outline" 
              size="default"
              className="h-10 px-4 text-sm hover:bg-white transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Завантажити
            </Button>
          </div>
          
          <Button 
            size="default"
            className="h-10 px-4 text-sm bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white transition-all hover:shadow-md"
          >
            <Send className="w-4 h-4 mr-2" />
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
      "p-4 rounded-lg border-2 border-slate-200",
      bgColor,
      "transition-all duration-200 hover:shadow-md hover:border-slate-300"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0">{icon}</div>
          <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
            {label}
          </span>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="text-base text-slate-900 break-words">
        {value}
      </div>
    </div>
  );
}
