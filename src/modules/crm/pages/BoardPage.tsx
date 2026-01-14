import { useState, useCallback } from "react";
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
import { Kanban } from "lucide-react";
import { KanbanColumn } from "../components/KanbanColumn";
import { KanbanCard, Order } from "../components/KanbanCard";
import { OrderDetailSheet } from "../components/OrderDetailSheet";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api/client";
import { motion } from "framer-motion";
import { useI18n } from "../../../lib/i18n";

// Mock data - will be replaced with API call
const initialOrders: Order[] = [
  {
    id: "1",
    orderNumber: "N/01/02/01/26/dnk",
    clientName: "Олександр Петренко",
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    status: "DO_WYKONANIA",
    priority: "high",
    managerName: "Олена Іванова",
  },
  {
    id: "2",
    orderNumber: "N/02/02/01/26/eng",
    clientName: "Марія Коваленко",
    deadline: new Date(),
    status: "DO_WYKONANIA",
    priority: "high",
    managerName: "Петро Петренко",
  },
  {
    id: "3",
    orderNumber: "N/03/02/01/26/fra",
    clientName: "Володимир Сидоренко",
    deadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: "DO_POSWIADCZENIA",
    priority: "medium",
    managerName: "Анна Сидоренко",
  },
  {
    id: "4",
    orderNumber: "N/04/02/01/26/esp",
    clientName: "Анна Мельник",
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: "DO_POSWIADCZENIA",
    priority: "low",
    managerName: "Олена Іванова",
  },
  {
    id: "5",
    orderNumber: "N/05/02/01/26/deu",
    clientName: "Іван Шевченко",
    deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    status: "DO_WYDANIA",
    priority: "medium",
    managerName: "Петро Петренко",
  },
  {
    id: "6",
    orderNumber: "N/06/02/01/26/ita",
    clientName: "Оксана Бондаренко",
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    status: "USTNE",
    priority: "low",
    managerName: "Анна Сидоренко",
  },
  {
    id: "7",
    orderNumber: "N/07/02/01/26/rus",
    clientName: "Дмитро Ткаченко",
    deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    status: "CLOSED",
    priority: "medium",
    managerName: "Олена Іванова",
  },
];

type ColumnId = "DO_WYKONANIA" | "DO_POSWIADCZENIA" | "DO_WYDANIA" | "USTNE" | "CLOSED";

// API function to update order status
async function updateOrderStatus(orderId: string, newStatus: ColumnId): Promise<Order> {
  // Map frontend status to backend format
  const statusMap: Record<ColumnId, string> = {
    DO_WYKONANIA: "do_wykonania",
    DO_POSWIADCZENIA: "do_poswiadczenia",
    DO_WYDANIA: "do_wydania",
    USTNE: "ustne",
    CLOSED: "closed",
  };

  return apiFetch<Order>(`/crm/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: statusMap[newStatus] }),
  });
}

export function BoardPage() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState<Set<string>>(new Set());

  // Create columns with translations
  const columns = [
    { id: "DO_WYKONANIA", title: t("kanban.columns.doWykonania") },
    { id: "DO_POSWIADCZENIA", title: t("kanban.columns.doPoswiadczenia") },
    { id: "DO_WYDANIA", title: t("kanban.columns.doWydania") },
    { id: "USTNE", title: t("kanban.columns.ustne") },
    { id: "CLOSED", title: t("kanban.columns.closed") },
  ] as const;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getOrdersByStatus = useCallback(
    (status: ColumnId) => {
      return orders.filter((order) => order.status === status);
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
    if (order.status === newStatus) return;

    // Optimistic UI: Immediately update local state
    const previousOrder = { ...order };
    const optimisticOrder = { ...order, status: newStatus };

    setOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === orderId ? optimisticOrder : o))
    );

    setIsUpdating((prev) => new Set(prev).add(orderId));

    try {
      // Send API request in background
      await updateOrderStatus(orderId, newStatus);
      
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

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <Kanban className="w-6 h-6 text-gray-600" />
        <h1 className="text-xl font-semibold text-gray-900">{t("kanban.title")}</h1>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
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
                  orders={columnOrders}
                  onCardClick={handleCardClick}
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

      <OrderDetailSheet
        order={selectedOrder}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onSave={handleSaveOrder}
      />
    </div>
  );
}
