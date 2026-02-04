import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { 
  Kanban, 
  Loader2, 
  Inbox, 
  RefreshCw, 
  CheckCircle2, 
  Wallet, 
  Package,
  FileText,
  StickyNote,
  Truck,
  Users
} from "lucide-react";
import { cn } from "../../../components/ui/utils";
import { SideTabs, SidePanel, type SideTab } from "../../../components/ui";
import { KanbanColumn } from "../components/KanbanColumn";
import { KanbanCard, Order, Translator, ColumnColorKey } from "../components/KanbanCard";
import { SendTranslationRequestDialog } from "../components/SendTranslationRequestDialog";
import { OrderNotesSheet } from "../components/OrderNotesSheet";
import { InternalNotes } from "../components/InternalNotes";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useI18n } from "../../../lib/i18n";
import { ordersApi, translatorsApi } from "../api";

// Конфігурація табів для сторінки Замовлень
const ORDER_SIDE_TABS: SideTab[] = [
  { id: 'details', icon: FileText, label: 'Деталі замовлення', color: 'blue' },
  { id: 'notes', icon: StickyNote, label: 'Нотатки', color: 'green' },
  { id: 'translator', icon: Users, label: 'Перекладач', color: 'amber' },
  { id: 'delivery', icon: Truck, label: 'Доставка', color: 'orange' },
];

// Will be loaded from API

type ColumnId = "NEW" | "IN_PROGRESS" | "READY" | "PAID" | "ISSUED";

// Map frontend column to backend status format
const statusMap: Record<ColumnId, string> = {
  NEW: "do_wykonania",
  PAID: "oplacone", // Оплачено (можна ставити вручну для готівки)
  IN_PROGRESS: "do_poswiadczenia",
  READY: "do_wydania",
  ISSUED: "closed",
};

// Map backend status to frontend column
function mapStatusToColumn(status: string, order?: any): ColumnId {
  // Автоматична логіка: якщо є транзакція income → PAID
  if (order?.transactions?.some((t: any) => t.type === "income")) {
    // Перевіряємо чи не видано (ISSUED має пріоритет)
    if (status === "CLOSED" || status === "closed") {
      return "ISSUED";
    }
    // Якщо доставка InPost і delivered_at встановлено → ISSUED
    if (order?.delivery?.method === "inpost" && order?.delivery?.delivered_at) {
      return "ISSUED";
    }
    return "PAID";
  }

  switch (status) {
    case "NEW":
      return "NEW";
    case "PAID":
    case "oplacone":
      return "PAID";
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "READY":
      return "READY";
    case "ISSUED":
      return "ISSUED";
    case "DO_WYKONANIA":
    case "do_wykonania":
      return "NEW";
    case "DO_POSWIADCZENIA":
    case "do_poswiadczenia":
      return "IN_PROGRESS";
    case "DO_WYDANIA":
    case "do_wydania":
      return "READY";
    case "USTNE":
    case "ustne":
      return "IN_PROGRESS"; // Усні замовлення також в роботі
    case "CLOSED":
    case "closed":
      return "ISSUED";
    default:
      return "NEW";
  }
}

export function BoardPage() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [activeOverColumn, setActiveOverColumn] = useState<ColumnColorKey | null>(null);
  const [isUpdating, setIsUpdating] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sidePanelTab, setSidePanelTab] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  
  // Translators list loaded from API
  const [translators, setTranslators] = useState<Translator[]>([]);

  // Load orders and translators on mount
  useEffect(() => {
    loadData();
  }, []);

  // Listen for order updates to refresh the board
  // Але не перезавантажуємо, якщо замовлення вже оновлене локально (drag-and-drop)
  useEffect(() => {
    const handleOrderUpdate = async (event: CustomEvent) => {
      const { orderId, skipReload } = event.detail;
      // Якщо skipReload = true, не перезавантажуємо (це drag-and-drop оновлення)
      if (skipReload) {
        return;
      }
      // Reload data to get updated order information
      await loadData();
    };

    const handleTranslatorsUpdate = async (event: CustomEvent) => {
      const { orderId, skipReload } = event.detail;
      // Якщо skipReload = true, не перезавантажуємо
      if (skipReload) {
        return;
      }
      // Reload data to get updated translator assignments
      await loadData();
    };

    window.addEventListener('orderUpdated', handleOrderUpdate as EventListener);
    window.addEventListener('orderTranslatorsUpdated', handleTranslatorsUpdate as EventListener);
    
    return () => {
      window.removeEventListener('orderUpdated', handleOrderUpdate as EventListener);
      window.removeEventListener('orderTranslatorsUpdated', handleTranslatorsUpdate as EventListener);
    };
  }, []);

  // Listen for navigation to specific order
  useEffect(() => {
    const handleNavigateOrder = (event: CustomEvent) => {
      const { orderId } = event.detail;
      if (orderId) {
        setPendingOrderId(orderId);
        // If not loading, try to find immediately
        if (!isLoading && orders.length > 0) {
          const order = orders.find(o => o.id === orderId);
          if (order) {
            setSelectedOrder(order);
            setSidePanelTab('details');
            setPendingOrderId(null);
          } else {
            // Reload if not found
            loadData();
          }
        } else if (!isLoading) {
          // If not loading but no orders, load data
          loadData();
        }
      }
    };

    window.addEventListener('navigate:order', handleNavigateOrder as EventListener);
    
    return () => {
      window.removeEventListener('navigate:order', handleNavigateOrder as EventListener);
    };
  }, [orders, isLoading]);

  // Select pending order after orders are loaded
  useEffect(() => {
    if (pendingOrderId && !isLoading && orders.length > 0) {
      const order = orders.find(o => o.id === pendingOrderId);
      if (order) {
        setSelectedOrder(order);
        setSidePanelTab('details');
        setPendingOrderId(null);
      }
    }
  }, [pendingOrderId, orders, isLoading]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ordersData, translatorsData] = await Promise.all([
        ordersApi.getOrders({ limit: 100 }),
        translatorsApi.getTranslators({ status: "active" }),
      ]);

      // Map API orders to display format
      const mappedOrders = ordersData.map((order) => {
        // Знайти прийнятий запит перекладача
        const acceptedRequest = order.translation_requests?.find(
          (req: any) => req.status === "accepted"
        );
        
        // Отримати ціну з транзакцій (якщо є)
        const clientPrice = order.transactions?.find(
          (t: any) => t.type === "income"
        )?.amount;

        // Автоматична зміна статусу на основі транзакцій та доставки
        let autoStatus = order.status.toUpperCase();
        
        // Якщо є транзакція income → PAID (якщо ще не ISSUED)
        if (order.transactions?.some((t: any) => t.type === "income")) {
          // Перевіряємо доставку InPost
          const delivery = (order as any).delivery || (order as any).deliveries?.[0];
          if (delivery?.method === "inpost" && delivery?.delivered_at) {
            autoStatus = "ISSUED";
          } else if (autoStatus !== "CLOSED" && autoStatus !== "ISSUED") {
            autoStatus = "PAID";
          }
        }

        return {
          id: order.id,
          orderNumber: order.order_number,
          clientName: order.client?.full_name || "Невідомий клієнт",
          clientId: order.client_id,
          deadline: order.deadline
            ? new Date(order.deadline)
            : new Date(order.created_at ?? Date.now()),
          status: autoStatus as any,
          managerName: "Менеджер", // TODO: Get from order.manager
          description: order.description,
          file_url: order.file_url,
          // Тип документа та мова з БД
          documentType: (order as any).translation_type || order.description?.split(" ")[0] || "Документ",
          language: (order as any).language,
          translation_type: (order as any).translation_type,
          payment_method: (order as any).payment_method,
          // Ціна для клієнта
          price: clientPrice,
          // Перекладач (якщо є прийнятий запит)
          translatorId: acceptedRequest ? String(acceptedRequest.translator_id) : undefined,
          translatorName: acceptedRequest?.translator?.name,
          translatorRate: acceptedRequest?.offered_rate,
          translatorFee: acceptedRequest?.offered_rate, // Можна розрахувати на основі обсягу
          translatorDeadline: acceptedRequest?.response_at ? new Date(acceptedRequest.response_at) : undefined,
          // Зберігаємо оригінальні дані для автоматичної логіки
          transactions: order.transactions,
          delivery: (order as any).delivery || (order as any).deliveries?.[0],
        } as Order;
      });

      // Map API translators to display format
      const mappedTranslators = translatorsData.map((translator) => ({
        id: String(translator.id),
        name: translator.name,
        rate: translator.languages[0]?.rate_per_page || 0,
      }));

      setOrders(mappedOrders);
      setTranslators(mappedTranslators);

      // Автоматична зміна статусу для замовлень з транзакціями або доставкою
      const statusUpdates: Promise<void>[] = [];
      for (const order of mappedOrders) {
        const apiOrder = ordersData.find(o => o.id === order.id);
        if (apiOrder) {
          statusUpdates.push(checkAndUpdateOrderStatus(order, apiOrder));
        }
      }
      // Виконуємо всі оновлення паралельно
      await Promise.allSettled(statusUpdates);
    } catch (error: any) {
      toast.error(`Помилка завантаження даних: ${error?.message || "Невідома помилка"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Функція для перевірки та автоматичного оновлення статусу замовлення
  const checkAndUpdateOrderStatus = async (order: Order, apiOrder: any): Promise<void> => {
    const hasIncomeTransaction = apiOrder.transactions?.some((t: any) => t.type === "income");
    const delivery = apiOrder.delivery || apiOrder.deliveries?.[0];
    const isInPostDelivered = delivery?.method === "inpost" && delivery?.delivered_at;
    const currentStatus = order.status;

    let newStatus: string | null = null;

    // Логіка автоматичної зміни статусу
    if (isInPostDelivered && currentStatus !== "ISSUED" && currentStatus !== "CLOSED") {
      // InPost доставлено → ISSUED
      newStatus = "closed";
    } else if (hasIncomeTransaction && currentStatus !== "PAID" && currentStatus !== "oplacone" && currentStatus !== "ISSUED" && currentStatus !== "CLOSED") {
      // Є оплата → PAID (якщо не видано)
      newStatus = "oplacone";
    }

    if (newStatus) {
      try {
        await ordersApi.updateOrder(order.id, { status: newStatus as any });
        // Оновлюємо локальний стан без перезавантаження всіх даних
        setOrders((prevOrders) =>
          prevOrders.map((o) =>
            o.id === order.id
              ? { ...o, status: newStatus === "closed" ? "ISSUED" : "PAID" as any }
              : o
          )
        );
      } catch (error: any) {
        console.error(`Помилка автоматичного оновлення статусу для замовлення ${order.id}:`, error);
      }
    }
  };

  // Create columns with translations and icons - новий порядок: 1) NEW, 2) PAID, 3) IN_PROGRESS, 4) READY, 5) ISSUED
  const columns = [
    { id: "NEW" as ColumnId, title: t("kanban.columns.new"), icon: Inbox },
    { id: "PAID" as ColumnId, title: t("kanban.columns.paid"), icon: Wallet },
    { id: "IN_PROGRESS" as ColumnId, title: t("kanban.columns.inProgress"), icon: RefreshCw },
    { id: "READY" as ColumnId, title: t("kanban.columns.ready"), icon: CheckCircle2 },
    { id: "ISSUED" as ColumnId, title: t("kanban.columns.issued"), icon: Package },
  ] as const;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getOrdersByStatus = useCallback(
    (columnId: ColumnId) => {
      return orders.filter((order) => {
        // Перевіряємо автоматичну логіку з урахуванням транзакцій та доставки
        const actualStatus = mapStatusToColumn(order.status, order);
        return actualStatus === columnId;
      });
    },
    [orders]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const order = orders.find((o) => o.id === event.active.id);
    if (order) {
      setActiveOrder(order);
      // Встановлюємо початкову колонку
      const currentColumn = mapStatusToColumn(order.status, order);
      setActiveOverColumn(currentColumn);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over && columns.some((col) => col.id === over.id)) {
      setActiveOverColumn(over.id as ColumnColorKey);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrder(null);
    setActiveOverColumn(null);

    if (!over) {
      // Якщо не скинули на колонку, просто виходимо
      return;
    }

    const orderId = active.id as string;
    const newStatus = over.id as ColumnId;

    // Check if dropping on a valid column
    const isValidColumn = columns.some((col) => col.id === newStatus);
    if (!isValidColumn) {
      console.log('Invalid column:', newStatus, 'Valid columns:', columns.map(c => c.id));
      return;
    }

    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      console.log('Order not found:', orderId);
      return;
    }

    // Don't update if status hasn't changed
    const currentColumn = mapStatusToColumn(order.status, order);
    if (currentColumn === newStatus) {
      console.log('Status unchanged:', currentColumn);
      return;
    }

    const backendStatus = statusMap[newStatus];

    // Якщо перетягнули в колонку PAID, автоматично встановлюємо payment_method = "cash"
    const updateData: any = { status: backendStatus as any };
    if (newStatus === "PAID") {
      updateData.payment_method = "cash";
    }

    // Optimistic UI: Immediately update local state
    const previousOrder = { ...order };
    const optimisticOrder = { 
      ...order, 
      status: newStatus,
      payment_method: newStatus === "PAID" ? "cash" : order.payment_method
    };

    setOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === orderId ? optimisticOrder : o))
    );

    setIsUpdating((prev) => new Set(prev).add(orderId));

    try {
      // Send API request in background
      const updatedOrder = await ordersApi.updateOrder(orderId, updateData);
      
      // Оновлюємо локальний стан з даними з API (на випадок, якщо бекенд змінив щось)
      setOrders((prevOrders) =>
        prevOrders.map((o) => {
          if (o.id === orderId) {
            // Визначаємо правильний статус з backend відповіді
            const orderStatusFromApi = (updatedOrder as any).status || backendStatus;
            const mappedStatus = mapStatusToColumn(orderStatusFromApi, updatedOrder);
            
            return {
              ...o,
              status: mappedStatus,
              payment_method: newStatus === "PAID" ? "cash" : ((updatedOrder as any).payment_method || o.payment_method),
              // Оновлюємо інші поля з API
              ...(updatedOrder as any),
            };
          }
          return o;
        })
      );
      
      // Якщо змінився payment_method на cash, сповіщаємо FinancePage про необхідність оновлення
      if (newStatus === "PAID") {
        window.dispatchEvent(new CustomEvent('orderPaymentMethodChanged', {
          detail: { orderId, paymentMethod: 'cash' }
        }));
      }
      
      // Сповіщаємо про оновлення замовлення для синхронізації з карткою клієнта
      // skipReload = true, щоб не перезавантажувати BoardPage (ми вже оновили локально)
      const orderClientId = order.clientId || (order as any).client_id;
      if (orderClientId) {
        window.dispatchEvent(new CustomEvent('orderUpdated', {
          detail: { orderId, clientId: orderClientId, skipReload: true }
        }));
      }
      
      // Success - state already updated optimistically
      // Optional: Play subtle sound or haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50); // Short haptic feedback
      }
    } catch (error: any) {
      // Rollback on error
      setOrders((prevOrders) =>
        prevOrders.map((o) => (o.id === orderId ? previousOrder : o))
      );

      toast.error(
        `Не вдалося оновити статус замовлення: ${error?.message || "Невідома помилка"}`
      );
    } finally {
      setIsUpdating((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const handleCardClick = (order: Order) => {
    // Встановлюємо вибране замовлення та відкриваємо панель з табом details
    setSelectedOrder(order);
    setSidePanelTab('details');
  };

  const handleSaveOrder = (updatedOrder: Order) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
    );
  };

  const handleClientClick = (clientId: string) => {
    // TODO: Відкрити картку клієнта
    toast.info(`Відкрити картку клієнта: ${clientId}`);
  };

  const [sendTranslationRequestDialogOpen, setSendTranslationRequestDialogOpen] = useState(false);
  const [selectedOrderForRequest, setSelectedOrderForRequest] = useState<Order | null>(null);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Ліва частина: Основний контент */}
      <main className="flex-1 min-w-0 flex flex-col p-6 overflow-y-auto pr-[64px]">
        <div className="flex items-center gap-3 mb-6">
          <Kanban className="w-8 h-8 text-[#FF5A00]" />
          <h1 className="text-2xl font-semibold text-gray-900">{t("kanban.title")}</h1>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Main Kanban Area */}
        <div className={cn(
          "flex-1 transition-all duration-300",
        )}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex-1 flex gap-4 overflow-x-auto pb-4 h-full">
              {columns.map((column) => {
                const columnOrders = getOrdersByStatus(column.id);
                return (
                  <motion.div
                    key={column.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <KanbanColumn
                      id={column.id}
                      title={column.title}
                      icon={column.icon}
                      orders={columnOrders}
                      onCardClick={handleCardClick}
                      onClientClick={handleClientClick}
                      columnColor={column.id}
                    />
                  </motion.div>
                );
              })}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeOrder ? (
                <motion.div
                  initial={{ scale: 0.9, rotate: -2 }}
                  animate={{ scale: 1, rotate: 2 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  style={{ cursor: "grabbing" }}
                >
                  <KanbanCard 
                    order={activeOrder} 
                    onClick={() => {}} 
                    isOverlay 
                    columnColor={activeOverColumn || "NEW"}
                  />
                </motion.div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

      </div>

      {/* Send Translation Request Dialog */}
      {selectedOrderForRequest && (
        <SendTranslationRequestDialog
          open={sendTranslationRequestDialogOpen}
          onOpenChange={setSendTranslationRequestDialogOpen}
          orderId={selectedOrderForRequest.id}
          orderNumber={selectedOrderForRequest.orderNumber || selectedOrderForRequest.id}
          documentType={selectedOrderForRequest.documentType}
          language={selectedOrderForRequest.language}
          deadline={selectedOrderForRequest.deadline}
          onSuccess={async () => {
            // Reload orders to get updated translator info
            // TODO: Implement order reload
            toast.success('Запит на переклад відправлено');
          }}
        />
      )}

      </main>

      {/* Права частина: Бокова панель (від header до footer) */}
      {selectedOrder && (
        <aside className="fixed right-0 top-16 bottom-0 w-[64px] border-l-2 border-gray-300 bg-white flex flex-col items-center pt-2 pb-4 z-30">
          <SideTabs
            tabs={ORDER_SIDE_TABS}
            activeTab={sidePanelTab}
            onTabChange={setSidePanelTab}
            position="right"
          />
        </aside>
      )}

      {/* SidePanel - Бокова панель з контентом */}
      {selectedOrder && (
        <SidePanel
          open={sidePanelTab !== null}
          onClose={() => {
            setSidePanelTab(null);
            setSelectedOrder(null);
          }}
          title={ORDER_SIDE_TABS.find(t => t.id === sidePanelTab)?.label}
          width="md"
        >
          {sidePanelTab === 'details' && selectedOrder && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Основна інформація</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Номер замовлення:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedOrder.orderNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Клієнт:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedOrder.clientName}</span>
                  </div>
                  {selectedOrder.deadline && (
                    <div>
                      <span className="text-gray-500">Термін:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {new Date(selectedOrder.deadline).toLocaleDateString('uk-UA')}
                      </span>
                    </div>
                  )}
                  {selectedOrder.price && (
                    <div>
                      <span className="text-gray-500">Ціна:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(selectedOrder.price)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {selectedOrder.description && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Опис</h4>
                  <p className="text-sm text-gray-700">{selectedOrder.description}</p>
                </div>
              )}
            </div>
          )}
          
          {sidePanelTab === 'notes' && selectedOrder && (
            <InternalNotes
              entityType="order"
              entityId={selectedOrder.id}
              orderNumber={selectedOrder.orderNumber}
            />
          )}
          
          {sidePanelTab === 'translator' && selectedOrder && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Перекладач</h4>
              {selectedOrder.translatorName ? (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Ім'я:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedOrder.translatorName}</span>
                  </div>
                  {selectedOrder.translatorRate && (
                    <div>
                      <span className="text-gray-500">Ставка:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(selectedOrder.translatorRate)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Перекладач не призначено</p>
              )}
            </div>
          )}
          
          {sidePanelTab === 'delivery' && selectedOrder && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Доставка</h4>
              {selectedOrder.delivery ? (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Метод:</span>
                    <span className="ml-2 font-medium text-gray-900">{selectedOrder.delivery.method || 'Не вказано'}</span>
                  </div>
                  {selectedOrder.delivery.tracking_number && (
                    <div>
                      <span className="text-gray-500">Номер відстеження:</span>
                      <span className="ml-2 font-medium text-gray-900">{selectedOrder.delivery.tracking_number}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Інформація про доставку відсутня</p>
              )}
            </div>
          )}
        </SidePanel>
      )}
    </div>
  );
}
