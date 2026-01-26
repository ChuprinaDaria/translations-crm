import React, { useState, useEffect } from "react";
import {
  Package,
  Search,
  Filter,
  Calendar,
  User,
  FileText,
  Clock,
  MoreVertical,
  Eye,
  ChevronRight,
  Loader2,
  StickyNote,
  Settings,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { toast } from "sonner";
import { ordersApi } from "../api/orders";
import { type Order } from "../api/clients";
import { timelineApi, type TimelineStep } from "../api/timeline";
import { TimelineVisualization } from "../components/TimelineVisualization";
import { cn } from "../../../components/ui/utils";

// Soft UI статуси з напівпрозорими фонами
const STATUS_LABELS: Record<string, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
  do_wykonania: { label: "Нове", bgColor: "bg-blue-50", textColor: "text-blue-700", borderColor: "border-blue-100" },
  do_poswiadczenia: { label: "В роботі", bgColor: "bg-amber-50", textColor: "text-amber-700", borderColor: "border-amber-100" },
  do_wydania: { label: "Готово", bgColor: "bg-emerald-50", textColor: "text-emerald-700", borderColor: "border-emerald-100" },
  ustne: { label: "Усний переклад", bgColor: "bg-purple-50", textColor: "text-purple-700", borderColor: "border-purple-100" },
  closed: { label: "Видано", bgColor: "bg-slate-50", textColor: "text-slate-700", borderColor: "border-slate-100" },
};

// Компонент для м'якого бейджа статусу
const OrderStatusBadge = ({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) => {
  const statusConfig = STATUS_LABELS[status] || STATUS_LABELS.do_wykonania;
  const sizeClasses = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";
  
  return (
    <span className={cn(
      "inline-flex items-center rounded border font-semibold uppercase tracking-wide",
      statusConfig.bgColor,
      statusConfig.textColor,
      statusConfig.borderColor,
      sizeClasses
    )}>
      {statusConfig.label}
    </span>
  );
};

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
  const [sidePanelTab, setSidePanelTab] = useState<string | null>(null);
  
  // Timeline dialog
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

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

  const handleViewTimeline = async (order: Order) => {
    setSelectedOrder(order);
    setIsLoadingTimeline(true);
    try {
      const steps = await timelineApi.getTimeline(order.id);
      setTimelineSteps(steps);
    } catch (error: any) {
      toast.error(`Помилка завантаження timeline: ${error?.message || "Невідома помилка"}`);
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.client?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4 shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Пошук по номеру, клієнту або опису..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всі статуси</SelectItem>
            <SelectItem value="do_wykonania">Нове</SelectItem>
            <SelectItem value="do_poswiadczenia">В роботі</SelectItem>
            <SelectItem value="do_wydania">Готово</SelectItem>
            <SelectItem value="ustne">Усний переклад</SelectItem>
            <SelectItem value="closed">Видано</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-thin">
          <Table className="table-fixed w-full min-w-[1200px] border-separate border-spacing-0">
            <TableHeader className="bg-slate-50/50 sticky top-0 z-10">
              <TableRow className="h-10 hover:bg-transparent border-b border-slate-200">
                <TableHead className="w-[120px] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-r border-b border-slate-200">Nr. Zlecenia</TableHead>
                <TableHead className="w-[130px] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-r border-b border-slate-200">Клієнт</TableHead>
                <TableHead className="min-w-[200px] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-r border-b border-slate-200">Опис (Тип/Мова)</TableHead>
                <TableHead className="w-[80px] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-r border-b border-slate-200 text-right">Ціна</TableHead>
                <TableHead className="w-[100px] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-r border-b border-slate-200 text-center">Доставка</TableHead>
                <TableHead className="w-[120px] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-r border-b border-slate-200">Адреса</TableHead>
                <TableHead className="w-[110px] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-r border-b border-slate-200">Контакт</TableHead>
                <TableHead className="w-[100px] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-r border-b border-slate-200 text-center">Статус</TableHead>
                <TableHead className="w-[120px] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-r border-b border-slate-200">Дедлайн</TableHead>
                <TableHead className="w-[100px] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">Створено</TableHead>
                <TableHead className="w-[40px] px-0 border-b border-slate-200"></TableHead>
              </TableRow>
            </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12">
                      <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500">Немає замовлень</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const deadline = formatDeadline(order.deadline);
                    const { price, languages, type, delivery, address, email, phone, cleanDescription } = parseOrderDetails(order.description);
                    const isOverdue = deadline && deadline.text.includes('Прострочено');
                    
                    return (
                      <TableRow 
                        key={order.id} 
                        className="h-11 cursor-pointer hover:bg-slate-50/80 transition-colors group border-b border-slate-100"
                        onClick={() => handleViewTimeline(order)}
                      >
                        <TableCell className="px-3 text-[11px] font-mono font-medium border-r border-slate-100 text-slate-900">
                          {order.order_number}
                        </TableCell>
                        <TableCell className="px-3 text-[11px] border-r border-slate-100">
                          <div className="flex flex-col truncate">
                            <span className="font-semibold text-slate-900 truncate" title={order.client?.full_name || "—"}>
                              {order.client?.full_name || "—"}
                            </span>
                            {order.client?.id && (
                              <span className="text-[9px] text-slate-400">ID: {order.client.id.slice(0, 8)}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 border-r border-slate-100">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {type && (
                              <span className="bg-indigo-50 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded border border-indigo-100 font-bold uppercase whitespace-nowrap shrink-0">
                                {type}
                              </span>
                            )}
                            {languages && (
                              <>
                                <span className="text-slate-400 text-[10px]">|</span>
                                <span className="bg-blue-50 text-blue-700 text-[9px] px-1.5 py-0.5 rounded border border-blue-100 font-semibold whitespace-nowrap shrink-0">
                                  {languages}
                                </span>
                              </>
                            )}
                            {cleanDescription && (
                              <>
                                <span className="text-slate-400 text-[10px]">|</span>
                                <span className="text-[10px] text-slate-600 truncate max-w-[200px]" title={order.description || "—"}>
                                  {cleanDescription}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-3 text-[11px] text-right font-bold text-emerald-700 border-r border-slate-100">
                          {price || '—'}
                        </TableCell>
                        <TableCell className="px-3 text-center border-r border-slate-100">
                          {delivery ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              {delivery}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 text-[10px] border-r border-slate-100 truncate text-slate-500" title={address || "—"}>
                          {address || '—'}
                        </TableCell>
                        <TableCell className="px-3 text-[10px] border-r border-slate-100">
                          {(email || phone) ? (
                            <div className="flex flex-col leading-tight gap-0.5">
                              {email && <span className="truncate text-[9px] text-slate-600" title={email}>{email}</span>}
                              {phone && <span className="font-mono text-slate-400 text-[9px]">{phone}</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 border-r border-slate-100 text-center">
                          <OrderStatusBadge status={order.status} size="sm" />
                        </TableCell>
                        <TableCell className="px-3 border-r border-slate-100">
                          {deadline ? (
                            <div className="flex flex-col leading-tight">
                              <span className={cn(
                                "text-[10px] font-medium",
                                isOverdue ? "text-red-600" : deadline.color
                              )}>
                                {deadline.text}
                              </span>
                              {isOverdue && (
                                <span className="text-[8px] font-bold text-red-500 uppercase">Прострочено</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 text-[10px] text-slate-400 font-mono border-slate-100">
                          {formatDate(order.created_at)}
                        </TableCell>
                        <TableCell className="px-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="w-4 h-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewTimeline(order)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Переглянути Timeline
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
        </div>

      {/* Timeline Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Timeline zlecenia: Nr. {selectedOrder?.order_number}
            </DialogTitle>
            <DialogDescription>
              Przegląd etapów realizacji zlecenia
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {/* Order Info - Структурована сітка */}
            {selectedOrder && (() => {
              const { price, languages, type, delivery, address, email, phone } = parseOrderDetails(selectedOrder.description);
              const deadline = formatDeadline(selectedOrder.deadline);
              
              return (
                <div className="mb-6 space-y-4">
                  {/* Прогрес-бар */}
                  {timelineSteps.length > 0 && (() => {
                    const completedCount = timelineSteps.filter(s => s.completed).length;
                    const progressPercent = Math.round((completedCount / 7) * 100);
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-slate-700">Прогрес: {completedCount} / 7</span>
                          <span className="font-semibold text-green-600">{progressPercent}%</span>
                        </div>
                        <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Ряд 1: Клієнт | Номер замовлення | Статус */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Клієнт</span>
                      <p className="text-[11px] font-semibold text-slate-900 truncate" title={selectedOrder.client?.full_name || "—"}>
                        {selectedOrder.client?.full_name || "—"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Номер</span>
                      <p className="text-[11px] font-mono font-medium text-slate-700 truncate" title={selectedOrder.order_number}>
                        {selectedOrder.order_number}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Статус</span>
                      <div>
                        <OrderStatusBadge status={selectedOrder.status} size="sm" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Ряд 2: Тип/Мова | Дедлайн | Ціна */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Тип / Мова</span>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {type && (
                          <span className="bg-indigo-50 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded border border-indigo-100 font-bold uppercase whitespace-nowrap">
                            {type}
                          </span>
                        )}
                        {languages && (
                          <span className="bg-blue-50 text-blue-700 text-[9px] px-1.5 py-0.5 rounded border border-blue-100 font-semibold whitespace-nowrap">
                            {languages}
                          </span>
                        )}
                        {!type && !languages && (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Дедлайн</span>
                      {deadline ? (
                        <p className={cn(
                          "text-[11px] font-medium",
                          deadline.text.includes('Прострочено') ? "text-red-600" : deadline.color
                        )}>
                          {deadline.text}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400">—</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wide">Ціна</span>
                      <p className="text-[11px] font-mono font-bold text-emerald-700">
                        {price || '—'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Додаткова інформація (якщо є) */}
                  {(delivery || address || email || phone) && (
                    <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-3">
                      {delivery && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Доставка</span>
                          <p className="text-[11px] text-slate-600">{delivery}</p>
                        </div>
                      )}
                      {address && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Адреса</span>
                          <p className="text-[11px] text-slate-600 truncate" title={address}>{address}</p>
                        </div>
                      )}
                      {email && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Email</span>
                          <p className="text-[11px] text-slate-600 truncate" title={email}>{email}</p>
                        </div>
                      )}
                      {phone && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Телефон</span>
                          <p className="text-[11px] font-mono text-slate-600">{phone}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            
            {/* Timeline */}
            {isLoadingTimeline ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : timelineSteps.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Немає етапів timeline</p>
                <p className="text-sm mt-1">Етапи будуть додаватися автоматично</p>
              </div>
            ) : (
              <TimelineVisualization steps={timelineSteps} />
            )}
          </div>
        </DialogContent>
      </Dialog>

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

