import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { cn } from "../../../components/ui/utils";
import { Order, SortableKanbanCard, Translator } from "./KanbanCard";
import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface KanbanColumnProps {
  id: string;
  title: string;
  icon?: LucideIcon;
  orders: Order[];
  onCardClick: (order: Order) => void;
  onClientClick?: (clientId: string) => void;
  onTranslatorChange?: (orderId: string, translatorId: string) => void;
  onSendTranslationRequest?: (orderId: string) => void;
  translators?: Translator[];
}

export function KanbanColumn({ 
  id, 
  title, 
  icon: Icon,
  orders, 
  onCardClick,
  onClientClick,
  onTranslatorChange,
  onSendTranslationRequest,
  translators,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-w-[280px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-gray-600" />}
          {title}
          <span className="ml-2 text-gray-500 font-normal">({orders.length})</span>
        </h3>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1 rounded-b-lg">
        <div
          ref={setNodeRef}
          className={cn(
            "p-3 min-h-full transition-colors duration-200",
            isOver && "bg-orange-50/50"
          )}
        >
          <SortableContext items={orders.map((o) => o.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
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
                      onTranslatorChange={onTranslatorChange}
                      onSendTranslationRequest={onSendTranslationRequest}
                      translators={translators}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Placeholder when dragging over */}
              {isOver && orders.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-24 border-2 border-dashed border-orange-300 rounded-lg bg-orange-50/30"
                />
              )}
            </div>
          </SortableContext>
        </div>
      </ScrollArea>
    </div>
  );
}
