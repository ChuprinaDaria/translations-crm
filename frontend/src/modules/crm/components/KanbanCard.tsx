import React, { useState } from "react";
import { Clock, Bot, User, FileText, MessageSquare, GripVertical } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { OrderNotesSheet } from "./OrderNotesSheet";
import { cn } from "../../../components/ui/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { useI18n } from "../../../lib/i18n";

// Кольори статусів колонок
export const COLUMN_COLORS = {
  NEW: {
    bg: "#E8F5E9", // світло-зелений
    border: "#81C784",
    text: "#2E7D32",
  },
  PAID: {
    bg: "#FFF3E0", // світло-помаранчевий
    border: "#FFB74D",
    text: "#E65100",
  },
  IN_PROGRESS: {
    bg: "#E3F2FD", // світло-синій
    border: "#64B5F6",
    text: "#1565C0",
  },
  READY: {
    bg: "#F3E5F5", // світло-фіолетовий
    border: "#BA68C8",
    text: "#7B1FA2",
  },
  ISSUED: {
    bg: "#F5F5F5", // світло-сірий
    border: "#BDBDBD",
    text: "#616161",
  },
} as const;

export type ColumnColorKey = keyof typeof COLUMN_COLORS;

export interface Translator {
  id: string;
  name: string;
  rate: number; // Ставка за одиницю (наприклад, за сторінку)
}

export interface Order {
  id: string;
  orderNumber: string;
  clientName: string;
  clientId?: string;
  deadline: Date;
  status:
    | "DO_WYKONANIA"
    | "DO_POSWIADCZENIA"
    | "DO_WYDANIA"
    | "USTNE"
    | "CLOSED"
    | "NEW"
    | "IN_PROGRESS"
    | "READY"
    | "PAID"
    | "ISSUED"
    | "oplacone";
  priority?: "high" | "medium" | "low";
  managerName?: string;
  managerAvatar?: string;
  created_at?: Date | string;
  // Нові поля
  documentType?: string;
  language?: string;
  translation_type?: string;
  payment_method?: string;  // cash, card, transfer, none
  price?: number;
  translatorId?: string;
  translatorName?: string;
  translatorRate?: number;
  translatorDeadline?: Date | string;
  translatorFee?: number;
  notesCount?: number;
  description?: string;
  file_url?: string;
  // Додаткові поля для автоматичної логіки
  transactions?: Array<{ type: string; amount: number }>;
  delivery?: { method: string; delivered_at?: string; tracking_number?: string };
}

interface KanbanCardProps {
  order: Order;
  onClick: () => void;
  onClientClick?: (clientId: string) => void;
  columnColor?: ColumnColorKey; // Колір визначається колонкою
  isDragging?: boolean;
  isOverlay?: boolean;
}

export function KanbanCard({ 
  order, 
  onClick, 
  onClientClick,
  columnColor = "NEW",
  isDragging = false, 
  isOverlay = false 
}: KanbanCardProps) {
  const { t } = useI18n();
  const [mouseDownPosition, setMouseDownPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  
  // Обчислення дедлайну
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(order.deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isUrgent = diffDays <= 3 && diffDays >= 0; // менше 3 днів
  const isOverdue = diffDays < 0;

  // Колір визначається колонкою
  const colors = COLUMN_COLORS[columnColor];

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '';
      const lang = localStorage.getItem("app_language") || "pl";
      const localeMap: Record<string, string> = {
        pl: "pl-PL",
        uk: "uk-UA",
        en: "en-US",
      };
      return d.toLocaleDateString(localeMap[lang] || "pl-PL", { 
        day: "2-digit", 
        month: "2-digit", 
        year: "numeric" 
      });
    } catch {
      return '';
    }
  };

  const getDeadlineText = () => {
    if (isOverdue) {
      const days = Math.abs(diffDays);
      return days === 1 ? t("kanban.deadline.overdueOne") || `Прострочено на ${days} день` : (t("kanban.deadline.overdue") || `Прострочено на ${days} днів`).replace("{{days}}", days.toString());
    }
    if (diffDays === 0) return t("kanban.deadline.today") || "Сьогодні";
    if (diffDays === 1) return t("kanban.deadline.tomorrow") || "Завтра";
    return formatDate(order.deadline);
  };

  const handleClientClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.clientId && onClientClick) {
      onClientClick(order.clientId);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Не викликати onClick якщо був drag
    if (isDraggingCard) {
      setIsDraggingCard(false);
      return;
    }
    
    const target = e.target as HTMLElement;
    if (target.closest('button, select, [role="button"], [role="combobox"], [role="dialog"]')) {
      return;
    }
    
    if (mouseDownPosition) {
      const deltaX = Math.abs(e.clientX - mouseDownPosition.x);
      const deltaY = Math.abs(e.clientY - mouseDownPosition.y);
      if (deltaX > 5 || deltaY > 5) {
        return;
      }
    }
    
    onClick();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Не встановлювати позицію якщо клік по кнопці або інтерактивному елементу
    const target = e.target as HTMLElement;
    if (target.closest('button, select, [role="button"], [role="combobox"], [role="dialog"]')) {
      return;
    }
    setMouseDownPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mouseDownPosition) {
      const deltaX = Math.abs(e.clientX - mouseDownPosition.x);
      const deltaY = Math.abs(e.clientY - mouseDownPosition.y);
      if (deltaX > 5 || deltaY > 5) {
        setIsDraggingCard(true);
      }
    }
  };

  const handleMouseUp = () => {
    setTimeout(() => {
      setMouseDownPosition(null);
      setIsDraggingCard(false);
    }, 100);
  };

  const cardContent = (
    <Card
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleCardClick}
      className={cn(
        "p-3 transition-all duration-200 border-2 relative",
        "hover:shadow-lg hover:-translate-y-0.5",
        isDragging && "opacity-50",
        isOverlay && "rotate-2 shadow-2xl scale-105"
      )}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
    >
      {/* Drag handle - видимий при hover */}
      <div 
        className={cn(
          "absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center",
          "opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing",
          "text-gray-400 hover:text-gray-600"
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </div>
      
      <div className="space-y-2 group">
        {/* 1. НАЙВАЖЛИВІШЕ: Номер замовлення - великий, жирний */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-base text-gray-900 leading-tight">
            Nr. {order.orderNumber}
          </h3>
          {order.priority === "high" && (
            <Badge className="bg-red-100 text-red-700 border-none text-xs px-1.5 py-0.5 shadow-none shrink-0">
              !
            </Badge>
          )}
        </div>

        {/* 2. ДУЖЕ ВАЖЛИВЕ: Дедлайн - виділений, з іконкою */}
        <div 
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium rounded px-2 py-1 -mx-1",
            (isOverdue || isUrgent) 
              ? "bg-red-100 text-red-700" 
              : "text-gray-700"
          )}
        >
          <Clock className={cn(
            "w-4 h-4 shrink-0",
            (isOverdue || isUrgent) ? "text-red-600" : "text-gray-500"
          )} />
          <span>На коли: {getDeadlineText()}</span>
        </div>

        {/* 3. ВАЖЛИВЕ: Статус створення та виконавець */}
        <div className="space-y-1 text-xs text-gray-500">
          {/* Автоматично/Вручну */}
          <div className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 shrink-0" />
            <span>Автоматично</span>
          </div>
          
          {/* Менеджер */}
          {order.managerName && (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>@{order.managerName.replace(/\s+/g, '_')}</span>
            </div>
          )}
        </div>

        {/* 4. ДРУГОРЯДНЕ: Кнопки Деталі та Нотатки - дрібні, сірі */}
        <div 
          className="pt-2 border-t border-gray-200/50 flex gap-2"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <OrderNotesSheet
            order={order}
            defaultTab="details"
            trigger={
              <Button
                variant="ghost"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors h-6 px-2"
              >
                <FileText className="w-3 h-3" />
                <span>Деталі</span>
              </Button>
            }
          />
          <OrderNotesSheet
            order={order}
            defaultTab="notes"
            trigger={
              <Button
                variant="ghost"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors h-6 px-2"
              >
                <MessageSquare className="w-3 h-3" />
                <span>
                  {order.notesCount !== undefined && order.notesCount > 0
                    ? `Нотатки (${order.notesCount})`
                    : 'Нотатки'}
                </span>
              </Button>
            }
          />
        </div>
      </div>
    </Card>
  );

  return (
    <>
      {isOverlay ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-[280px]"
        >
          {cardContent}
        </motion.div>
      ) : (
        cardContent
      )}
    </>
  );
}

interface SortableKanbanCardProps {
  order: Order;
  onClick: () => void;
  onClientClick?: (clientId: string) => void;
  columnColor?: ColumnColorKey;
}

export function SortableKanbanCard({ 
  order, 
  onClick,
  onClientClick,
  columnColor = "NEW",
}: SortableKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: order.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <motion.div
        layout
        initial={false}
        animate={{
          scale: isDragging ? 0.95 : 1,
          opacity: isDragging ? 0.5 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
      >
        <KanbanCard 
          order={order} 
          onClick={onClick}
          onClientClick={onClientClick}
          columnColor={columnColor}
          isDragging={isDragging} 
        />
      </motion.div>
    </div>
  );
}
