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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  do_wykonania: { label: "Нове", color: "bg-blue-100 text-blue-700" },
  do_poswiadczenia: { label: "В роботі", color: "bg-yellow-100 text-yellow-700" },
  do_wydania: { label: "Готово", color: "bg-green-100 text-green-700" },
  ustne: { label: "Усний переклад", color: "bg-purple-100 text-purple-700" },
  closed: { label: "Видано", color: "bg-gray-100 text-gray-700" },
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
    <div className="space-y-4 h-full flex flex-col">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
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
      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr. Zlecenia</TableHead>
                  <TableHead>Клієнт</TableHead>
                  <TableHead>Опис</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дедлайн</TableHead>
                  <TableHead>Створено</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500">Немає замовлень</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const deadline = formatDeadline(order.deadline);
                    const status = STATUS_LABELS[order.status] || STATUS_LABELS.do_wykonania;
                    
                    return (
                      <TableRow 
                        key={order.id} 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleViewTimeline(order)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{order.order_number}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span>{order.client?.full_name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-600 truncate max-w-[200px] inline-block">
                            {order.description || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {deadline ? (
                            <div className="flex items-center gap-1">
                              <Clock className={`w-4 h-4 ${deadline.color}`} />
                              <span className={deadline.color}>{deadline.text}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-500">{formatDate(order.created_at)}</span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
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

      {/* SideTabs - Vertical colored tabs on the right */}
      <SideTabs
        tabs={ORDERS_LIST_SIDE_TABS}
        activeTab={sidePanelTab}
        onTabChange={setSidePanelTab}
        position="right"
      />

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

