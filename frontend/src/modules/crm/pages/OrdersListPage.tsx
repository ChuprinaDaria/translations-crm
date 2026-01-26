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
import { Card, CardContent } from "../../../components/ui/card";
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  do_wykonania: { label: "Нове", color: "bg-blue-100 text-blue-700" },
  do_poswiadczenia: { label: "В роботі", color: "bg-yellow-100 text-yellow-700" },
  do_wydania: { label: "Готово", color: "bg-green-100 text-green-700" },
  ustne: { label: "Усний переклад", color: "bg-purple-100 text-purple-700" },
  closed: { label: "Видано", color: "bg-gray-100 text-gray-700" },
};

// Парсер для витягування структурованих даних з опису
const parseOrderDetails = (text: string | null | undefined) => {
  if (!text) {
    return {
      price: null,
      languages: null,
      type: null,
      cleanDescription: "",
    };
  }

  // Витягуємо ціну (наприклад: "200 zł", "150₴", "$50", "100€", "Ціна: 200 zł")
  const priceMatch = text.match(/(?:Ціна|Price|Cena):\s*(\d+\s?(?:zł|₴|\$|€|EUR|USD|PLN))|(\d+\s?(?:zł|₴|\$|€|EUR|USD|PLN))/i);
  const price = priceMatch ? (priceMatch[1] || priceMatch[2]) : null;
  
  // Витягуємо мовну пару (наприклад: "UKR → ENG", "Польська → Українська", "Мова: UKR → ENG")
  const langMatch = text.match(/(?:Мова|Language|Język):\s*([А-Яа-яA-Za-z]+\s?→\s?[А-Яа-яA-Za-z]+)|([А-Яа-яA-Za-z]+\s?→\s?[А-Яа-яA-Za-z]+)/i);
  const languages = langMatch ? (langMatch[1] || langMatch[2]) : null;
  
  // Витягуємо тип документа
  const typeMatch = text.match(/(?:Тип документа|Тип|Document type|Rodzaj):\s*([^|,\n]+)/i);

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
  cleanDescription = cleanDescription.replace(/\s{2,}/g, ' ').trim();

  return {
    price,
    languages,
    type: typeMatch ? typeMatch[1].trim() : null,
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
      <main className="flex-1 min-w-0 flex flex-col p-6 overflow-hidden">
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
      <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
        <CardContent className="p-0 flex-1 flex flex-col min-h-0">
          <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-thin">
            <Table className="table-fixed w-full min-w-[900px] border-collapse">
              <TableHeader className="bg-slate-50 sticky top-0 z-10">
                <TableRow className="h-8">
                  <TableHead className="w-[120px] px-1 py-0.5 text-[9px] font-bold border-r uppercase">Nr. Zlecenia</TableHead>
                  <TableHead className="w-[100px] px-1 py-0.5 text-[9px] font-bold border-r uppercase">Клієнт</TableHead>
                  <TableHead className="px-1 py-0.5 text-[9px] font-bold border-r uppercase">Опис (Тип, Мова, Доставка...)</TableHead>
                  <TableHead className="w-[80px] px-1 py-0.5 text-[9px] font-bold border-r uppercase text-center">Ціна</TableHead>
                  <TableHead className="w-[80px] px-1 py-0.5 text-[9px] font-bold border-r uppercase text-center">Статус</TableHead>
                  <TableHead className="w-[110px] px-1 py-0.5 text-[9px] font-bold border-r uppercase">Дедлайн</TableHead>
                  <TableHead className="w-[80px] px-1 py-0.5 text-[9px] font-bold uppercase">Створено</TableHead>
                  <TableHead className="w-[40px] px-1 py-0.5"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500">Немає замовлень</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const deadline = formatDeadline(order.deadline);
                    const status = STATUS_LABELS[order.status] || STATUS_LABELS.do_wykonania;
                    const { price, languages, type, cleanDescription } = parseOrderDetails(order.description);
                    const isOverdue = deadline && deadline.text.includes('Прострочено');
                    
                    return (
                      <TableRow 
                        key={order.id} 
                        className="h-8 cursor-pointer hover:bg-slate-50/50 transition-colors border-b group"
                        onClick={() => handleViewTimeline(order)}
                      >
                        <TableCell className="px-1 py-0.5 text-[10px] font-mono border-r tracking-tighter">
                          {order.order_number}
                        </TableCell>
                        <TableCell className="px-1 py-0.5 text-[10px] border-r truncate font-medium" title={order.client?.full_name || "—"}>
                          {order.client?.full_name || "—"}
                        </TableCell>
                        <TableCell 
                          className="px-1 py-0.5 text-[9px] border-r truncate text-slate-500 cursor-help" 
                          title={order.description || "—"}
                        >
                          <div className="flex flex-wrap gap-1 items-center">
                            {type && (
                              <span className="bg-slate-100 text-[8px] px-1 rounded uppercase font-bold text-slate-600 shrink-0">
                                {type}
                              </span>
                            )}
                            {languages && (
                              <span className="bg-blue-50 text-[8px] px-1 rounded font-semibold text-blue-700 border border-blue-100 shrink-0">
                                {languages}
                              </span>
                            )}
                            <span className="truncate">{cleanDescription || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-1 py-0.5 text-right border-r font-mono font-bold text-green-700 text-[10px]">
                          {price || '—'}
                        </TableCell>
                        <TableCell className="px-1 py-0.5 border-r text-center">
                          <Badge className={cn("text-[8px] h-3.5 px-1 uppercase font-bold border-none", status.color)}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-1 py-0.5 text-[9px] border-r">
                          {deadline ? (
                            <div className="flex flex-col leading-none">
                              <span className={cn(isOverdue ? "text-red-500 font-bold" : deadline.color)}>
                                {deadline.text}
                              </span>
                              {isOverdue && <span className="text-[7px] text-red-400 uppercase">Overdue</span>}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-1 py-0.5 text-[9px] text-slate-400 font-mono">
                          {formatDate(order.created_at)}
                        </TableCell>
                        <TableCell className="px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreVertical className="w-3 h-3" />
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
        </CardContent>
      </Card>

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
            {/* Order Info */}
            {selectedOrder && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Клієнт:</span>
                  <span className="font-medium">{selectedOrder.client?.full_name || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Опис:</span>
                  <span>{selectedOrder.description || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Статус:</span>
                  <Badge className={STATUS_LABELS[selectedOrder.status]?.color || ""}>
                    {STATUS_LABELS[selectedOrder.status]?.label || selectedOrder.status}
                  </Badge>
                </div>
                {selectedOrder.deadline && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Дедлайн:</span>
                    <span>{formatDate(selectedOrder.deadline)}</span>
                  </div>
                )}
              </div>
            )}
            
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
      <aside className="w-[64px] border-l bg-white flex flex-col items-center py-4 shrink-0">
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

