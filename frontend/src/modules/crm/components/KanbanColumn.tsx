import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { cn } from "../../../components/ui/utils";
import { Order, SortableKanbanCard, COLUMN_COLORS, ColumnColorKey } from "./KanbanCard";
import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface KanbanColumnProps {
  id: string;
  title: string;
  icon?: LucideIcon;
  orders: Order[];
  onCardClick: (order: Order) => void;
  onClientClick?: (clientId: string) => void;
  columnColor: ColumnColorKey;
}

export function KanbanColumn({ 
  id, 
  title, 
  icon: Icon,
  orders, 
  onCardClick,
  onClientClick,
  columnColor,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  const colors = COLUMN_COLORS[columnColor];

  return (
    <div 
      className="flex flex-col h-[calc(100vh-8rem)]"
      style={{
        width: '280px',
        minWidth: '280px',
        maxWidth: '280px',
      }}
    >
      {/* Header з кольором колонки */}
      <div 
        className="px-4 py-3 border-b-2 rounded-t-lg"
        style={{
          backgroundColor: colors.bg,
          borderColor: colors.border,
        }}
      >
        <h3 
          className="font-semibold text-sm flex items-center gap-2"
          style={{ color: colors.text }}
        >
          {Icon && <Icon className="w-4 h-4" style={{ color: colors.text }} />}
          {title}
          <span 
            className="ml-auto bg-white/70 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ color: colors.text }}
          >
            {orders.length}
          </span>
        </h3>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1 bg-gray-50/50 rounded-b-lg">
        <div
          ref={setNodeRef}
          className={cn(
            "p-3 min-h-full transition-all duration-200",
            isOver && "ring-2 ring-inset ring-orange-400 bg-orange-50/30"
          )}
        >
          <SortableContext items={orders.map((o) => o.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {orders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                    }}
                  >
                    <SortableKanbanCard 
                      order={order} 
                      onClick={() => onCardClick(order)}
                      onClientClick={onClientClick}
                      columnColor={columnColor}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Placeholder - завжди показуємо при перетягуванні */}
              {isOver && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 80 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-2 border-dashed rounded-lg flex items-center justify-center text-sm"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: `${colors.bg}80`,
                    color: colors.text,
                  }}
                >
                  Відпустіть тут
                </motion.div>
              )}
              
              {/* Порожня колонка */}
              {orders.length === 0 && !isOver && (
                <div className="h-20 flex items-center justify-center text-gray-400 text-sm">
                  Немає замовлень
                </div>
              )}
            </div>
          </SortableContext>
        </div>
      </ScrollArea>
    </div>
  );
}
