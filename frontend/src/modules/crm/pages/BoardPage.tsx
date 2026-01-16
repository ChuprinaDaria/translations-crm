import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
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
  Package 
} from "lucide-react";
import { cn } from "../../../components/ui/utils";
import { KanbanColumn } from "../components/KanbanColumn";
import { KanbanCard, Order, Translator } from "../components/KanbanCard";
import { OrderDetailSheet } from "../components/OrderDetailSheet";
import { SendTranslationRequestDialog } from "../components/SendTranslationRequestDialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useI18n } from "../../../lib/i18n";
import { ordersApi, translatorsApi } from "../api";

// Will be loaded from API

type ColumnId = "NEW" | "IN_PROGRESS" | "READY" | "PAID" | "ISSUED";

// Map frontend column to backend status format
const statusMap: Record<ColumnId, string> = {
  NEW: "do_wykonania",
  IN_PROGRESS: "do_poswiadczenia",
  READY: "do_wydania",
  PAID: "do_wydania", // Використовуємо do_wydania для оплачених, можна додати payment_status
  ISSUED: "closed",
};

// Map backend status to frontend column
function mapStatusToColumn(status: string): ColumnId {
  switch (status) {
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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  
  // Translators list loaded from API
  const [translators, setTranslators] = useState<Translator[]>([]);

  // Load orders and translators on mount
  useEffect(() => {
    loadData();
  }, []);

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

        return {
          id: order.id,
          orderNumber: order.order_number,
          clientName: order.client?.full_name || "Невідомий клієнт",
          clientId: order.client_id,
          deadline: order.deadline ? new Date(order.deadline) : undefined,
          status: order.status.toUpperCase() as any,
          managerName: "Менеджер", // TODO: Get from order.manager
          description: order.description,
          // Тип документа - можна витягти з description або додати окреме поле
          documentType: order.description?.split(" ")[0] || "Документ",
          // Ціна для клієнта
          price: clientPrice,
          // Перекладач (якщо є прийнятий запит)
          translatorId: acceptedRequest ? String(acceptedRequest.translator_id) : undefined,
          translatorName: acceptedRequest?.translator?.name,
          translatorRate: acceptedRequest?.offered_rate,
          translatorFee: acceptedRequest?.offered_rate, // Можна розрахувати на основі обсягу
          translatorDeadline: acceptedRequest?.response_at ? new Date(acceptedRequest.response_at) : undefined,
        };
      });

      // Map API translators to display format
      const mappedTranslators = translatorsData.map((translator) => ({
        id: String(translator.id),
        name: translator.name,
        rate: translator.languages[0]?.rate_per_page || 0,
      }));

      setOrders(mappedOrders);
      setTranslators(mappedTranslators);
    } catch (error: any) {
      toast.error(`Помилка завантаження даних: ${error?.message || "Невідома помилка"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Create columns with translations and icons
  const columns = [
    { id: "NEW" as ColumnId, title: t("kanban.columns.new"), icon: Inbox },
    { id: "IN_PROGRESS" as ColumnId, title: t("kanban.columns.inProgress"), icon: RefreshCw },
    { id: "READY" as ColumnId, title: t("kanban.columns.ready"), icon: CheckCircle2 },
    { id: "PAID" as ColumnId, title: t("kanban.columns.paid"), icon: Wallet },
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
      return orders.filter((order) => mapStatusToColumn(order.status) === columnId);
    },
    [orders]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const order = orders.find((o) => o.id === event.active.id);
    if (order) {
      setActiveOrder(order);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrder(null);

    if (!over) return;

    const orderId = active.id as string;
    const newStatus = over.id as ColumnId;

    // Check if dropping on a valid column
    if (!columns.some((col) => col.id === newStatus)) return;

    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // Don't update if status hasn't changed
    const currentColumn = mapStatusToColumn(order.status);
    if (currentColumn === newStatus) return;

    // Optimistic UI: Immediately update local state
    const previousOrder = { ...order };
    const optimisticOrder = { ...order, status: newStatus };

    setOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === orderId ? optimisticOrder : o))
    );

    setIsUpdating((prev) => new Set(prev).add(orderId));

    try {
      // Send API request in background
      await ordersApi.updateOrder(orderId, { status: statusMap[newStatus] as any });
      
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
    setSelectedOrder(order);
    setIsSheetOpen(true);
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

  const handleSendTranslationRequest = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setSelectedOrderForRequest(order);
      setSendTranslationRequestDialogOpen(true);
    }
  };

  const handleTranslatorChange = async (orderId: string, translatorId: string) => {
    try {
      const translator = translators.find(t => t.id === translatorId);
      if (!translator) return;

      // TODO: Викликати API для оновлення перекладача
      // await apiFetch(`/crm/orders/${orderId}`, {
      //   method: "PATCH",
      //   body: JSON.stringify({ 
      //     translator_id: translatorId,
      //     translator_fee: translator.rate 
      //   }),
      // });

      // TODO: Викликати API для автоматизації Timeline (етап 5)
      // await timelineApi.markTranslatorAssigned(orderId, translatorId);

      // Оновлюємо локальний стан
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId
            ? {
                ...order,
                translatorId: translatorId,
                translatorName: translator.name,
                translatorRate: translator.rate,
                translatorFee: translator.rate, // Можна розрахувати на основі обсягу
              }
            : order
        )
      );

      toast.success(`Перекладача змінено на ${translator.name}`);
    } catch (error: any) {
      toast.error(`Помилка оновлення перекладача: ${error?.message || "Невідома помилка"}`);
    }
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col relative">
      <div className="flex items-center gap-3 mb-4">
        <Kanban className="w-6 h-6 text-gray-600" />
        <h1 className="text-xl font-semibold text-gray-900">{t("kanban.title")}</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Kanban Area */}
        <div className={cn(
          "flex-1 transition-all duration-300",
          isSheetOpen && "mr-96"
        )}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
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
                      onTranslatorChange={handleTranslatorChange}
                      onSendTranslationRequest={handleSendTranslationRequest}
                      translators={translators}
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
                  <KanbanCard order={activeOrder} onClick={() => {}} isOverlay />
                </motion.div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Right Sidebar - Order Details */}
        {isSheetOpen && (
          <OrderDetailSheet
            order={selectedOrder}
            open={isSheetOpen}
            onOpenChange={setIsSheetOpen}
            onSave={handleSaveOrder}
          />
        )}
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
    </div>
  );
}
