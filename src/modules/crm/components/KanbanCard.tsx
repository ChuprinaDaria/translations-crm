import React from "react";
import { Calendar, User } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { cn } from "../../../components/ui/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { useI18n } from "../../../lib/i18n";

export interface Order {
  id: string;
  orderNumber: string;
  clientName: string;
  deadline: Date;
  status: "DO_WYKONANIA" | "DO_POSWIADCZENIA" | "DO_WYDANIA" | "USTNE" | "CLOSED";
  priority?: "high" | "medium" | "low";
  managerName?: string;
  managerAvatar?: string;
  created_at?: Date | string;
}

interface KanbanCardProps {
  order: Order;
  onClick: () => void;
  isDragging?: boolean;
  isOverlay?: boolean;
}

export function KanbanCard({ order, onClick, isDragging = false, isOverlay = false }: KanbanCardProps) {
  const { t } = useI18n();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(order.deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const isToday = deadlineDate.getTime() === today.getTime();
  const isOverdue = deadlineDate.getTime() < today.getTime();

  const getBorderColor = () => {
    if (isOverdue) return "border-red-500";
    if (isToday) return "border-red-400";
    if (order.status === "CLOSED") return "border-green-300";
    if (order.status === "DO_WYDANIA") return "border-blue-300";
    return "border-gray-200";
  };

  const getBackgroundColor = () => {
    // Для прострочених або термінових - рожевий
    if (isOverdue || isToday) {
      return { backgroundColor: 'var(--color-bg-pink)' };
    }
    
    // Для різних статусів використовуємо універсальні кольори фону
    switch (order.status) {
      case "CLOSED":
        return { backgroundColor: 'var(--color-bg-green)' }; // зелений
      case "DO_WYDANIA":
        return { backgroundColor: 'var(--color-bg-blue)' }; // голубий
      case "DO_POSWIADCZENIA":
        return { backgroundColor: 'var(--color-bg-yellow)' }; // жовтий
      case "DO_WYKONANIA":
        return { backgroundColor: 'var(--color-bg-green-light)' }; // світло-зелений
      case "USTNE":
        return { backgroundColor: 'var(--color-bg-purple-light)' }; // світло-фіолетовий
      default:
        return undefined;
    }
  };

  const getStatusColor = () => {
    switch (order.status) {
      case "CLOSED":
        return "text-green-600";
      case "DO_WYDANIA":
        return "text-blue-600";
      case "DO_POSWIADCZENIA":
        return "text-yellow-600";
      case "DO_WYKONANIA":
        return "text-gray-600";
      case "USTNE":
        return "text-purple-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusLabel = () => {
    switch (order.status) {
      case "DO_WYKONANIA":
        return t("kanban.status.doWykonania");
      case "DO_POSWIADCZENIA":
        return t("kanban.status.doPoswiadczenia");
      case "DO_WYDANIA":
        return t("kanban.status.doWydania");
      case "USTNE":
        return t("kanban.status.ustne");
      case "CLOSED":
        return t("kanban.status.closed");
      default:
        return order.status;
    }
  };

  const formatDeadline = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(date);
    deadline.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const days = Math.abs(diffDays);
      const overdueText = days === 1 
        ? t("kanban.deadline.overdueOne")
        : t("kanban.deadline.overdue");
      return overdueText.replace("{{days}}", days.toString());
    }
    if (diffDays === 0) return t("kanban.deadline.today");
    if (diffDays === 1) return t("kanban.deadline.tomorrow");
    
    // Format date based on current language
    const lang = localStorage.getItem("app_language") || "pl";
    const localeMap: Record<string, string> = {
      pl: "pl-PL",
      uk: "uk-UA",
      en: "en-US",
    };
    return deadline.toLocaleDateString(localeMap[lang] || "pl-PL", { day: "numeric", month: "short" });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const cardContent = (
    <Card
      onClick={onClick}
      className={cn(
        "p-4 cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:border-orange-500/50 hover:-translate-y-0.5",
        getBorderColor(),
        isDragging && "opacity-50",
        isOverlay && "rotate-2 shadow-2xl"
      )}
      style={getBackgroundColor()}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm truncate">
              {order.orderNumber}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-600">
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{order.clientName}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {order.priority === "high" && (
              <Badge className="bg-red-100 text-red-700 border-none text-xs px-1.5 py-0.5 shadow-none">
                {t("kanban.priority.high")}
              </Badge>
            )}
            <span className={cn("text-xs font-medium", getStatusColor())}>
              {getStatusLabel()}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span className={cn(isToday || isOverdue ? "text-red-600 font-medium" : "")}>
              {formatDeadline(order.deadline)}
            </span>
          </div>
          {order.managerName && (
            <Avatar className="w-6 h-6">
              <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                {getInitials(order.managerName)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </Card>
  );

  if (isOverlay) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-[280px]"
      >
        {cardContent}
      </motion.div>
    );
  }

  return cardContent;
}

interface SortableKanbanCardProps {
  order: Order;
  onClick: () => void;
}

export function SortableKanbanCard({ order, onClick }: SortableKanbanCardProps) {
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
        <KanbanCard order={order} onClick={onClick} isDragging={isDragging} />
      </motion.div>
    </div>
  );
}
