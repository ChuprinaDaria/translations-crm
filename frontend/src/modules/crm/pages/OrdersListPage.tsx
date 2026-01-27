import { useState, useEffect, useMemo } from "react";
import {
  Package,
  Search,
  FileText,
  MoreVertical,
  Eye,
  Loader2,
  StickyNote,
  Settings,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Truck,
  Mail,
  Phone,
  Edit2,
  Trash2,
} from "lucide-react";
import { SideTabs, SidePanel, type SideTab } from "../../../components/ui";

// Конфігурація табів для Orders List
const ORDERS_LIST_SIDE_TABS: SideTab[] = [
  { id: 'info', icon: FileText, label: 'Інформація', color: 'blue' },
  { id: 'notes', icon: StickyNote, label: 'Нотатки', color: 'green' },
  { id: 'settings', icon: Settings, label: 'Налаштування', color: 'gray' },
];
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { OrderDetailsDialog } from "../components/OrderDetailsDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Card, CardContent } from "../../../components/ui/card";
import { toast } from "sonner";
import { ordersApi } from "../api/orders";
import { type Order } from "../api/clients";
import { cn } from "../../../components/ui/utils";

// Компонент StatCard для статистики
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'amber' | 'emerald' | 'red';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'text-blue-600',
      text: 'text-blue-700',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: 'text-amber-600',
      text: 'text-amber-700',
    },
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: 'text-emerald-600',
      text: 'text-emerald-700',
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-red-600',
      text: 'text-red-700',
    },
  };

  const colors = colorClasses[color];

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md cursor-pointer",
      colors.bg,
      colors.border,
      "border-2"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            "bg-white/50 backdrop-blur-sm",
            colors.icon
          )}>
            {icon}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {label}
            </div>
            <div className={cn("text-2xl font-bold", colors.text)}>
              {value}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Покращений OrderStatusBadge з іконками
interface OrderStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

function OrderStatusBadge({ status, size = 'md' }: OrderStatusBadgeProps) {
  const statusConfig: Record<string, { label: string; icon: string; className: string }> = {
    do_wykonania: {
      label: 'Нове',
      icon: '🆕',
      className: 'bg-blue-100 text-blue-700 border-blue-300',
    },
    do_poswiadczenia: {
      label: 'В роботі',
      icon: '⚙️',
      className: 'bg-amber-100 text-amber-700 border-amber-300',
    },
    do_wydania: {
      label: 'Готово',
      icon: '✅',
      className: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    },
    ustne: {
      label: 'Усний',
      icon: '🎤',
      className: 'bg-purple-100 text-purple-700 border-purple-300',
    },
    closed: {
      label: 'Видано',
      icon: '📦',
      className: 'bg-slate-100 text-slate-700 border-slate-300',
    },
  };

  const config = statusConfig[status] || statusConfig.do_wykonania;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-lg font-semibold border-2',
      'transition-all duration-200 hover:scale-105',
      config.className,
      sizeClasses[size]
    )}>
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}

// Парсер для витягування структурованих даних з опису
const parseOrderDetails = (text: string | null | undefined) => {
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

  // Очищаємо опис від витягнутих даних
  let cleanDescription = text;
  if (priceMatch?.[0]) {
    cleanDescription = cleanDescription.replace(priceMatch[0], '');
  }
  if (langMatch?.[0]) {
    cleanDescription = cleanDescription.replace(langMatch[0], '');
  }
  if (typeMatch?.[0]) {
    cleanDescription = cleanDescription.replace(typeMatch[0], '');
  }
  if (deliveryMatch?.[0]) {
    cleanDescription = cleanDescription.replace(deliveryMatch[0], '');
  }
  if (addressMatch?.[0]) {
    cleanDescription = cleanDescription.replace(addressMatch[0], '');
  }
  if (emailMatch?.[0]) {
    cleanDescription = cleanDescription.replace(emailMatch[0], '');
  }
  if (phoneMatch?.[0]) {
    cleanDescription = cleanDescription.replace(phoneMatch[0], '');
  }
  cleanDescription = cleanDescription.replace(/\s{2,}/g, ' ').trim();

  return {
    price,
    languages,
    type,
    delivery,
    address,
    email,
    phone,
    cleanDescription: cleanDescription || text,
  };
};

export function OrdersListPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<string | null>(null);
  
  // Order details dialog
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const params: any = { limit: 100 };
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      const data = await ordersApi.getOrders(params);
      setOrders(data);
    } catch (error: any) {
      toast.error(`Помилка завантаження: ${error?.message || "Невідома помилка"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
  };

  // Filter orders with useMemo for performance
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Фільтр за пошуком
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          order.order_number.toLowerCase().includes(query) ||
          order.client?.full_name?.toLowerCase().includes(query) ||
          order.description?.toLowerCase().includes(query);
        
        if (!matchesSearch) return false;
      }

      // Фільтр за статусом
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      // Фільтр за простроченими
      if (showOnlyOverdue) {
        if (!order.deadline) return false;
        const isOverdue = new Date(order.deadline) < new Date() && 
                         order.status !== 'closed' && 
                         order.status !== 'do_wydania';
        if (!isOverdue) return false;
      }

      return true;
    });
  }, [orders, searchQuery, statusFilter, showOnlyOverdue]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDeadline = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) {
      return { text: `Прострочено (${Math.abs(days)} дн.)`, color: "text-red-600" };
    } else if (days === 0) {
      return { text: "Сьогодні", color: "text-orange-600" };
    } else if (days === 1) {
      return { text: "Завтра", color: "text-yellow-600" };
    } else if (days <= 3) {
      return { text: `${days} дн.`, color: "text-yellow-600" };
    }
    return { text: formatDate(dateString), color: "text-gray-600" };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Ліва частина: Основний контент */}
      <main className="flex-1 min-w-0 flex flex-col p-6 overflow-hidden pr-[64px]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 shrink-0">
          <Package className="w-8 h-8 text-[#FF5A00]" />
          <h1 className="text-2xl font-semibold text-gray-900">Список замовлень</h1>
        </div>

        {/* Шапка з статистикою */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
          <StatCard
            icon={<Package className="w-5 h-5" />}
            label="Всього замовлень"
            value={orders.length}
            color="blue"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="В роботі"
            value={orders.filter(o => o.status === 'do_poswiadczenia').length}
            color="amber"
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Готово"
            value={orders.filter(o => o.status === 'do_wydania').length}
            color="emerald"
          />
          <StatCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="Прострочено"
            value={orders.filter(o => {
              if (!o.deadline) return false;
              return new Date(o.deadline) < new Date() && 
                     o.status !== 'closed' && 
                     o.status !== 'do_wydania';
            }).length}
            color="red"
          />
        </div>

        {/* Фільтри та пошук */}
        <Card className="mb-6 shadow-sm shrink-0">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Пошук */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Пошук за номером, клієнтом, описом..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>

              {/* Фільтр за статусом */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px] h-10">
                  <SelectValue placeholder="Всі статуси" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                      Всі статуси
                    </span>
                  </SelectItem>
                  <SelectItem value="do_wykonania">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      Нові
                    </span>
                  </SelectItem>
                  <SelectItem value="do_poswiadczenia">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      В роботі
                    </span>
                  </SelectItem>
                  <SelectItem value="do_wydania">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      Готово
                    </span>
                  </SelectItem>
                  <SelectItem value="ustne">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      Усний переклад
                    </span>
                  </SelectItem>
                  <SelectItem value="closed">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                      Видано
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Швидкий фільтр: тільки прострочені */}
              <Button
                variant="outline"
                className={cn(
                  "h-10",
                  showOnlyOverdue && "bg-red-50 text-red-700 border-red-200"
                )}
                onClick={() => setShowOnlyOverdue(!showOnlyOverdue)}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Прострочені
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Список замовлень */}
        <Card className="shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                  <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                    Номер
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                    Клієнт
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                    Деталі
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider text-right">
                    Ціна
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                    Доставка
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                    Статус
                  </TableHead>
                  <TableHead className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                    Дедлайн
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="w-12 h-12 text-slate-300" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            Немає замовлень
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            {searchQuery ? 'Спробуйте змінити параметри пошуку' : 'Створіть нове замовлення'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const { price, languages, type, delivery, address, email, phone } = 
                      parseOrderDetails(order.description);
                    const deadline = formatDeadline(order.deadline);
                    const isOverdue = order.deadline && 
                                     new Date(order.deadline) < new Date() && 
                                     order.status !== 'closed' && 
                                     order.status !== 'do_wydania';

                    return (
                      <TableRow
                        key={order.id}
                        onClick={() => handleViewOrder(order)}
                        className={cn(
                          "cursor-pointer transition-all duration-200",
                          "hover:bg-slate-50/80 hover:shadow-sm",
                          "border-b border-slate-100",
                          isOverdue && "bg-red-50/30"
                        )}
                      >
                        {/* Номер замовлення */}
                        <TableCell className="font-mono text-sm font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-1.5 h-8 rounded-full",
                              order.status === 'do_wykonania' && "bg-blue-500",
                              order.status === 'do_poswiadczenia' && "bg-amber-500",
                              order.status === 'do_wydania' && "bg-emerald-500",
                              order.status === 'ustne' && "bg-purple-500",
                              order.status === 'closed' && "bg-slate-400"
                            )} />
                            <span>{order.order_number}</span>
                          </div>
                        </TableCell>

                        {/* Клієнт */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                              {(order.client?.full_name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">
                                {order.client?.full_name || '—'}
                              </div>
                              {order.client?.id && (
                                <div className="text-xs text-slate-500 font-mono">
                                  #{order.client.id.slice(-6)}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Деталі */}
                        <TableCell>
                          <div className="space-y-2">
                            {/* Теги */}
                            <div className="flex flex-wrap gap-1.5">
                              {type && (
                                <Badge 
                                  variant="secondary" 
                                  className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs font-bold"
                                >
                                  {type}
                                </Badge>
                              )}
                              {languages && (
                                <Badge 
                                  variant="outline" 
                                  className="text-xs border-slate-300 text-slate-700"
                                >
                                  🌐 {languages}
                                </Badge>
                              )}
                            </div>
                            {/* Контакти (компактно) */}
                            {(email || phone) && (
                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                {email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {email}
                                  </span>
                                )}
                                {phone && (
                                  <span className="flex items-center gap-1 font-mono">
                                    <Phone className="w-3 h-3" />
                                    {phone}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Ціна */}
                        <TableCell className="text-right">
                          {price ? (
                            <div className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                              <span className="text-lg font-bold text-emerald-700">
                                {price}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>

                        {/* Доставка */}
                        <TableCell>
                          {delivery ? (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                <Truck className="w-4 h-4 text-orange-600" />
                              </div>
                              <div className="text-sm">
                                <div className="font-medium text-slate-900">{delivery}</div>
                                {address && (
                                  <div className="text-xs text-slate-500 truncate max-w-[150px]">
                                    {address}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>

                        {/* Статус */}
                        <TableCell>
                          <OrderStatusBadge status={order.status} size="md" />
                        </TableCell>

                        {/* Дедлайн */}
                        <TableCell>
                          {deadline ? (
                            <div className={cn(
                              "inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2",
                              isOverdue 
                                ? "bg-red-50 border-red-200" 
                                : "bg-slate-50 border-slate-200"
                            )}>
                              <Calendar className={cn(
                                "w-4 h-4",
                                isOverdue ? "text-red-600" : "text-slate-500"
                              )} />
                              <div>
                                <div className={cn(
                                  "text-sm font-semibold",
                                  isOverdue ? "text-red-700" : "text-slate-900"
                                )}>
                                  {deadline.text}
                                </div>
                                {isOverdue && (
                                  <div className="text-xs font-bold text-red-600 uppercase">
                                    Прострочено!
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>

                        {/* Дії */}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-9 w-9 rounded-lg hover:bg-slate-100"
                              >
                                <MoreVertical className="w-4 h-4 text-slate-600" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleViewOrder(order)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Переглянути
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Редагувати
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Mail className="w-4 h-4 mr-2" />
                                Надіслати email
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Видалити
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

      {/* Order Details Dialog */}
      <OrderDetailsDialog
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />

      </main>

      {/* Права частина: Бокова панель (тепер вона в потоці!) */}
      <aside className="fixed right-0 top-0 w-[64px] border-l bg-white flex flex-col items-center py-4 h-screen z-[70]">
        <SideTabs
          tabs={ORDERS_LIST_SIDE_TABS}
          activeTab={sidePanelTab}
          onTabChange={setSidePanelTab}
          position="right"
        />
      </aside>

      {/* SidePanel - Бокова панель з контентом */}
      <SidePanel
        open={sidePanelTab !== null}
        onClose={() => setSidePanelTab(null)}
        title={ORDERS_LIST_SIDE_TABS.find(t => t.id === sidePanelTab)?.label}
        width="md"
      >
        {sidePanelTab === 'info' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Інформація про замовлення</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Всього замовлень:</span>
                <span className="ml-2 font-medium text-gray-900">{orders.length}</span>
              </div>
              <div>
                <span className="text-gray-500">Відфільтровано:</span>
                <span className="ml-2 font-medium text-gray-900">{filteredOrders.length}</span>
              </div>
            </div>
          </div>
        )}
        
        {sidePanelTab === 'notes' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Нотатки</h4>
            <p className="text-sm text-gray-500">Функціонал нотаток буде додано пізніше</p>
          </div>
        )}
        
        {sidePanelTab === 'settings' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Налаштування</h4>
            <p className="text-sm text-gray-500">Налаштування списку замовлень</p>
          </div>
        )}
      </SidePanel>
    </div>
  );
}

