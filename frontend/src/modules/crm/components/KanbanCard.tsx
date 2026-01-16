import React, { useState } from "react";
import { Calendar, User, FileText, DollarSign, MessageSquare, ChevronDown } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { NotesManager, Note } from "../../../components/NotesManager";
import { notesApi, type InternalNote } from "../api/notes";
import { cn } from "../../../components/ui/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { useI18n } from "../../../lib/i18n";

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
  status: "DO_WYKONANIA" | "DO_POSWIADCZENIA" | "DO_WYDANIA" | "USTNE" | "CLOSED";
  priority?: "high" | "medium" | "low";
  managerName?: string;
  managerAvatar?: string;
  created_at?: Date | string;
  // Нові поля
  documentType?: string;
  language?: string;
  price?: number;
  translatorId?: string;
  translatorName?: string;
  translatorRate?: number;
  translatorDeadline?: Date | string;
  translatorFee?: number;
  notesCount?: number;
}

interface KanbanCardProps {
  order: Order;
  onClick: () => void;
  onClientClick?: (clientId: string) => void;
  onTranslatorChange?: (orderId: string, translatorId: string) => void;
  translators?: Translator[];
  isDragging?: boolean;
  isOverlay?: boolean;
}

export function KanbanCard({ 
  order, 
  onClick, 
  onClientClick,
  onTranslatorChange,
  onSendTranslationRequest,
  translators = [],
  isDragging = false, 
  isOverlay = false 
}: KanbanCardProps) {
  const { t } = useI18n();
  const [isTranslatorOpen, setIsTranslatorOpen] = useState(false);
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

  const formatDeadline = (date: Date | string) => {
    const deadline = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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
    return deadline.toLocaleDateString(localeMap[lang] || "pl-PL", { 
      day: "2-digit", 
      month: "2-digit", 
      year: "numeric" 
    });
  };

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

  const handleClientClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.clientId && onClientClick) {
      onClientClick(order.clientId);
    }
  };

  const handleTranslatorChange = (value: string) => {
    if (value === 'send-request') {
      if (onSendTranslationRequest) {
        onSendTranslationRequest(order.id);
      }
      setIsTranslatorOpen(false);
      return;
    }
    
    if (onTranslatorChange) {
      onTranslatorChange(order.id, value);
    }
    setIsTranslatorOpen(false);
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
      className={cn(
        "p-4 transition-all duration-200",
        "hover:shadow-lg hover:border-orange-500/50 hover:-translate-y-0.5",
        getBorderColor(),
        isDragging && "opacity-50",
        isOverlay && "rotate-2 shadow-2xl"
      )}
      style={getBackgroundColor()}
    >
      <div className="space-y-3">
        {/* Header: Order Number */}
        <div className="flex items-start justify-between gap-2">
          <h3 
            onClick={onClick}
            className="font-semibold text-gray-900 text-sm truncate cursor-pointer hover:text-[#FF5A00] transition-colors"
          >
            {order.orderNumber}
          </h3>
          {order.priority === "high" && (
            <Badge className="bg-red-100 text-red-700 border-none text-xs px-1.5 py-0.5 shadow-none">
              {t("kanban.priority.high")}
            </Badge>
          )}
        </div>

        <div className="border-t border-gray-200 pt-2 space-y-2.5">
          {/* 1. Що це (Тип документа / Опис) */}
          {order.documentType && (
            <div className="flex items-center gap-1.5 text-xs text-gray-700">
              <FileText className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
              <span className="font-medium">
                {order.documentType}
                {order.language && ` (${order.language})`}
              </span>
            </div>
          )}

          {/* 2. На коли це (Дедлайн для клієнта) */}
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
            <span className={cn(
              "font-medium",
              isToday || isOverdue ? "text-red-600" : "text-gray-700"
            )}>
              На коли: {formatDate(order.deadline)}
            </span>
          </div>

          {/* 3. Скільки коштує (Ціна для клієнта) */}
          {order.price !== undefined && (
            <div className="flex items-center gap-1.5 text-xs text-gray-700">
              <DollarSign className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
              <span className="font-medium">Ціна: {order.price} zł</span>
            </div>
          )}

          {/* 4. Хто зробить (Перекладач) */}
          <div className="space-y-1.5 pt-1 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-700">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                <span className="font-medium">Хто зробить:</span>
              </div>
              {!order.translatorId && onSendTranslationRequest && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendTranslationRequest(order.id);
                  }}
                >
                  Запит
                </Button>
              )}
            </div>
            {order.translatorId ? (
              <div className="pl-5 space-y-1 text-xs">
                <div className="flex items-center gap-1 text-gray-700">
                  <span className="font-medium">{order.translatorName}</span>
                </div>
                {/* 5. На коли зробить (Дедлайн перекладача) */}
                {order.translatorDeadline && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    <span>На коли: {formatDate(order.translatorDeadline)}</span>
                  </div>
                )}
                {/* 6. Скільки ми заплатимо перекладачу (Гонорар) */}
                {order.translatorFee !== undefined && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <DollarSign className="w-3 h-3 text-gray-400" />
                    <span>Гонорар: {order.translatorFee} zł</span>
                  </div>
                )}
              </div>
            ) : (
              <Select
                value=""
                onValueChange={handleTranslatorChange}
                onOpenChange={setIsTranslatorOpen}
              >
                <SelectTrigger 
                  className="h-7 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SelectValue placeholder="Вибрати або відправити запит" />
                </SelectTrigger>
                <SelectContent onClick={(e) => e.stopPropagation()}>
                  {onSendTranslationRequest && (
                    <SelectItem value="send-request">
                      Відправити запит перекладачу
                    </SelectItem>
                  )}
                  {translators.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Немає перекладачів
                    </SelectItem>
                  ) : (
                    translators.map((translator) => (
                      <SelectItem key={translator.id} value={translator.id}>
                        {translator.name} ({translator.rate} zł)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Client Name (додаткова інформація) */}
          <div 
            onClick={handleClientClick}
            className={cn(
              "flex items-center gap-1.5 text-xs cursor-pointer hover:text-[#FF5A00] transition-colors pt-1 border-t border-gray-100",
              order.clientId && onClientClick ? "" : "cursor-default"
            )}
          >
            <User className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
            <span className="truncate">{order.clientName}</span>
          </div>

          {/* Notes Count / Button */}
          <div className="pt-1 border-t border-gray-200">
            <NotesManager
              entityId={order.id}
              entityName={order.orderNumber}
              iconSize="sm"
              onLoad={async () => {
                try {
                  const internalNotes = await notesApi.getNotes('order', order.id);
                  // Конвертуємо InternalNote в Note формат
                  return internalNotes.map((note: InternalNote) => ({
                    id: note.id.toString(),
                    text: note.text,
                    created_by: note.author_name,
                    created_at: note.created_at,
                  }));
                } catch (error) {
                  console.error('Error loading notes:', error);
                  return [];
                }
              }}
              onAddNote={async (note: Note) => {
                try {
                  // Додаємо нову нотатку через API і повертаємо з правильним ID
                  const createdNote = await notesApi.createNote({
                    entity_type: 'order',
                    entity_id: order.id,
                    text: note.text,
                  });
                  // Повертаємо нотатку в форматі Note з правильним ID
                  return {
                    id: createdNote.id.toString(),
                    text: createdNote.text,
                    created_by: createdNote.author_name,
                    created_at: createdNote.created_at,
                  };
                } catch (error) {
                  console.error('Error adding note:', error);
                  throw error;
                }
              }}
              onRemoveNote={async (noteId: string) => {
                try {
                  // Видаляємо нотатку через API
                  const noteIdNum = parseInt(noteId);
                  if (!isNaN(noteIdNum)) {
                    await notesApi.deleteNote(noteIdNum);
                  }
                } catch (error) {
                  console.error('Error removing note:', error);
                  throw error;
                }
              }}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#FF5A00] transition-colors w-full justify-start h-auto py-1 px-0"
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
                  <span>
                    {order.notesCount !== undefined && order.notesCount > 0
                      ? `${order.notesCount} нотатки`
                      : 'Додати нотатку'}
                  </span>
                </Button>
              }
            />
          </div>
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
  onTranslatorChange?: (orderId: string, translatorId: string) => void;
  onSendTranslationRequest?: (orderId: string) => void;
  translators?: Translator[];
}

export function SortableKanbanCard({ 
  order, 
  onClick,
  onClientClick,
  onTranslatorChange,
  onSendTranslationRequest,
  translators,
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
          onTranslatorChange={onTranslatorChange}
          onSendTranslationRequest={onSendTranslationRequest}
          translators={translators}
          isDragging={isDragging} 
        />
      </motion.div>
    </div>
  );
}
