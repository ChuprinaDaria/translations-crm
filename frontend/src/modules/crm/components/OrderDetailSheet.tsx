import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { NotesManager, Note } from "../../../components/NotesManager";
import { notesApi, type InternalNote } from "../api/notes";
import { timelineApi, type TimelineStep } from "../api/timeline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Separator } from "../../../components/ui/separator";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Badge } from "../../../components/ui/badge";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Card, CardContent } from "../../../components/ui/card";
import { Order } from "./KanbanCard";
import { 
  Calendar, 
  User, 
  FileText, 
  Copy, 
  Check, 
  Mail, 
  MessageCircle,
  Download,
  Upload,
  DollarSign,
  Clock,
  Edit,
  StickyNote
} from "lucide-react";
import { useI18n } from "../../../lib/i18n";
import { cn } from "../../../components/ui/utils";
import { formatDistanceToNow } from "date-fns";
import { pl, uk, enUS, type Locale } from "date-fns/locale";
import { ProgressTimelineCompact } from './ProgressTimelineCompact';

interface OrderDetailSheetProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (order: Order) => void;
}

interface OrderFormData {
  orderNumber: string;
  clientName: string;
  deadline: string;
  status: Order["status"];
  priority: "high" | "medium" | "low";
  notes?: string;
  totalAmount?: number;
  paymentStatus?: "paid" | "unpaid";
}

const localeMap: Record<string, Locale> = {
  pl,
  uk,
  en: enUS,
};

const TIMELINE_STEPS = [
  { type: 'client_created', label: 'Створено клієнта' },
  { type: 'order_created', label: 'Створено замовлення' },
  { type: 'payment_link_sent', label: 'Надіслано лінк оплати' },
  { type: 'payment_received', label: 'Оплачено' },
  { type: 'translator_assigned', label: 'Призначено перекладача' },
  { type: 'translation_ready', label: 'Переклад готовий' },
  { type: 'issued_sent', label: 'Видано/Відправлено' },
];

export function OrderDetailSheet({
  order,
  open,
  onOpenChange,
  onSave,
}: OrderDetailSheetProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OrderFormData>({
    defaultValues: order
      ? {
          orderNumber: order.orderNumber,
          clientName: order.clientName,
          deadline: order.deadline.toISOString().split("T")[0],
          status: order.status,
          priority: order.priority || "medium",
          totalAmount: 0,
          paymentStatus: "unpaid",
        }
      : undefined,
  });

  const onSubmit = (data: OrderFormData) => {
    if (!order) return;
    const updatedOrder: Order = {
      ...order,
      orderNumber: data.orderNumber,
      clientName: data.clientName,
      deadline: new Date(data.deadline),
      status: data.status,
      priority: data.priority,
    };
    onSave(updatedOrder);
    onOpenChange(false);
  };

  const handleCopyOrderNumber = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: Order["status"]) => {
    const statusMap: Record<Order["status"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      DO_WYKONANIA: { label: t("kanban.status.doWykonania"), variant: "outline" },
      DO_POSWIADCZENIA: { label: t("kanban.status.doPoswiadczenia"), variant: "secondary" },
      DO_WYDANIA: { label: t("kanban.status.doWydania"), variant: "default" },
      USTNE: { label: t("kanban.status.ustne"), variant: "secondary" },
      CLOSED: { label: t("kanban.status.closed"), variant: "default" },
    };
    const statusInfo = statusMap[status] || statusMap.DO_WYKONANIA;
    return (
      <Badge variant={statusInfo.variant} className="text-xs">
        {statusInfo.label}
      </Badge>
    );
  };

  const getRelativeDate = (date: Date) => {
    const lang = localStorage.getItem("app_language") || "pl";
    const locale = localeMap[lang] || pl;
    return formatDistanceToNow(date, { addSuffix: true, locale });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isDeadlineClose = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(date);
    deadline.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 1 && diffDays >= 0;
  };

  const isDeadlineOverdue = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(date);
    deadline.setHours(0, 0, 0, 0);
    return deadline.getTime() < today.getTime();
  };

  // Перевірка, яка кнопка активна на основі вибраної дати
  const getActivePreset = () => {
    const deadline = watch("deadline");
    if (!deadline) return null;
    
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(0, 0, 0, 0);
    
    if (deadlineDate.getTime() === today.getTime()) return "today";
    if (deadlineDate.getTime() === tomorrow.getTime()) return "tomorrow";
    if (deadlineDate.getTime() === nextWeek.getTime()) return "nextWeek";
    return null;
  };

  const activePreset = getActivePreset();

  // Завантаження timeline при відкритті
  useEffect(() => {
    if (open && order?.id) {
      loadTimeline();
    }
  }, [open, order?.id]);

  const loadTimeline = async () => {
    if (!order?.id) return;
    setIsLoadingTimeline(true);
    try {
      const steps = await timelineApi.getTimeline(order.id);
      setTimelineSteps(steps);
    } catch (error) {
      console.error('Error loading timeline:', error);
      setTimelineSteps([]);
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  // Визначаємо завершені етапи
  const completedStepTypes = new Set(
    timelineSteps.filter(step => step.completed).map(step => step.step_type)
  );

  const getCompletedStepsCount = () => {
    let count = 0;
    for (const step of TIMELINE_STEPS) {
      if (completedStepTypes.has(step.type as any)) {
        count++;
      } else {
        break;
      }
    }
    return count;
  };

  const completedSteps = getCompletedStepsCount();
  const totalSteps = TIMELINE_STEPS.length;

  if (!order || !open) return null;

  const currentLang = localStorage.getItem("app_language") || "pl";
  const dateLocale = localeMap[currentLang] || pl;

  return (
    <aside className="w-96 border-l border-gray-200 bg-white flex flex-col shrink-0 h-full">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-lg font-bold font-mono text-gray-900 truncate">
                  {order.orderNumber}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleCopyOrderNumber}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                {t("orderDetails.created")} {order.created_at 
                  ? getRelativeDate(new Date(order.created_at))
                  : getRelativeDate(new Date())
                }
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {getStatusBadge(order.status)}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4 text-gray-400" />
              </Button>
            </div>
          </div>
        </div>

          {/* Scrollable Body with Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 pt-3 flex-shrink-0">
            <TabsList className="grid w-full grid-cols-3 h-9">
              <TabsTrigger value="details" className="text-xs">{t("orderDetails.tabs.details")}</TabsTrigger>
              <TabsTrigger value="files" className="text-xs">{t("orderDetails.tabs.files")}</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">{t("orderDetails.tabs.history")}</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 px-4 min-h-0">
            <form onSubmit={handleSubmit(onSubmit)} id="order-form">
              {/* Tab: Details */}
              <TabsContent value="details" className="mt-4 space-y-4 pb-4">
                {/* Client Section */}
                <Card className="border-black/5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-blue)' }}>
                  <CardContent className="p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-xs uppercase tracking-wider text-gray-700 font-semibold">
                        {t("orderDetails.client.title")}
                      </Label>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2 hover:bg-blue-100/60 text-gray-700">
                        <Edit className="h-3 w-3 mr-1 text-blue-600" />
                        {t("orderDetails.client.edit")}
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-blue-200 text-blue-800 text-xs">
                          {getInitials(order.clientName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {order.clientName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs hover:bg-blue-100/60 text-gray-700">
                            <Mail className="h-3 w-3 mr-1 text-blue-600" />
                            Email
                          </Button>
                          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs hover:bg-blue-100/60 text-gray-700">
                            <MessageCircle className="h-3 w-3 mr-1 text-blue-600" />
                            Telegram
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline Section */}
                <Card className="rounded-xl border-black/5" style={{ backgroundColor: 'var(--color-bg-pink)' }}>
                  <CardContent className="p-5 rounded-xl" style={{ color: 'var(--color-black)', backgroundColor: 'var(--color-bg-purple-light)' }}>
                    {(isDeadlineClose(order.deadline) || isDeadlineOverdue(order.deadline)) && (
                      <p className={cn(
                        "text-xs mb-4 px-3 py-2 rounded-lg",
                        isDeadlineOverdue(order.deadline) ? "text-red-600 bg-red-50" : "text-orange-600 bg-orange-50"
                      )}>
                        {isDeadlineOverdue(order.deadline) 
                          ? t("orderDetails.timeline.overdue")
                          : t("orderDetails.timeline.close")
                        }
                      </p>
                    )}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                      <Label className="text-xs uppercase tracking-wider text-gray-700 font-semibold">
                        {t("orderDetails.timeline.title")}
                      </Label>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                          {completedSteps}/{totalSteps} ({Math.round((completedSteps / totalSteps) * 100)}%)
                            </span>
                        </div>
                        
                      {/* Progress Timeline - компактна версія для бокової панелі */}
                      <ProgressTimelineCompact 
                        steps={TIMELINE_STEPS.map((step, index) => ({
                          step: index + 1,
                          completed: completedStepTypes.has(step.type as any),
                        }))}
                        completedSteps={completedSteps}
                      />
                      
                      <div className="space-y-2 mt-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="deadline" className="text-xs font-normal text-gray-700">
                            {t("orderDetails.timeline.deadline")}
                          </Label>
                          <div className="relative">
                            <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-500" />
                            <Input
                              id="deadline"
                              type="date"
                              {...register("deadline", { required: true })}
                              className={cn(
                                "pl-9 h-9 bg-white text-sm rounded-lg",
                                isDeadlineClose(order.deadline) && "border-orange-400",
                                isDeadlineOverdue(order.deadline) && "border-red-400"
                              )}
                            />
                          </div>
                          <div className="flex gap-1.5 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2 rounded-lg border transition-colors"
                              style={activePreset === "today" ? {
                                borderColor: 'rgb(229, 231, 235)',
                                backgroundColor: 'rgba(220, 183, 225, 1)',
                                color: 'var(--color-black)'
                              } : {
                                borderColor: 'rgb(229, 231, 235)',
                                backgroundColor: 'transparent',
                                color: 'var(--color-black)'
                              }}
                              onMouseEnter={(e) => {
                                if (activePreset !== "today") {
                                  e.currentTarget.style.backgroundColor = 'rgba(220, 183, 225, 0.3)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (activePreset !== "today") {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                              onClick={() => {
                                const today = new Date();
                                setValue("deadline", today.toISOString().split("T")[0]);
                              }}
                            >
                              {t("orderDetails.timeline.presets.today")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2 rounded-lg border transition-colors"
                              style={activePreset === "tomorrow" ? {
                                borderColor: 'rgb(229, 231, 235)',
                                backgroundColor: 'rgba(220, 183, 225, 1)',
                                color: 'var(--color-black)'
                              } : {
                                borderColor: 'rgb(229, 231, 235)',
                                backgroundColor: 'transparent',
                                color: 'var(--color-black)'
                              }}
                              onMouseEnter={(e) => {
                                if (activePreset !== "tomorrow") {
                                  e.currentTarget.style.backgroundColor = 'rgba(220, 183, 225, 0.3)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (activePreset !== "tomorrow") {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                              onClick={() => {
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                setValue("deadline", tomorrow.toISOString().split("T")[0]);
                              }}
                            >
                              {t("orderDetails.timeline.presets.tomorrow")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2 rounded-lg border transition-colors"
                              style={activePreset === "nextWeek" ? {
                                borderColor: 'rgb(229, 231, 235)',
                                backgroundColor: 'rgba(220, 183, 225, 1)',
                                color: 'var(--color-black)'
                              } : {
                                borderColor: 'rgb(229, 231, 235)',
                                backgroundColor: 'transparent',
                                color: 'var(--color-black)'
                              }}
                              onMouseEnter={(e) => {
                                if (activePreset !== "nextWeek") {
                                  e.currentTarget.style.backgroundColor = 'rgba(220, 183, 225, 0.3)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (activePreset !== "nextWeek") {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                              onClick={() => {
                                const nextWeek = new Date();
                                nextWeek.setDate(nextWeek.getDate() + 7);
                                setValue("deadline", nextWeek.toISOString().split("T")[0]);
                              }}
                            >
                              {t("orderDetails.timeline.presets.nextWeek")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Micro-View */}
                <Card className="border-black/5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-green-light)' }}>
                  <CardContent className="p-4 rounded-xl">
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wider text-gray-700 font-semibold">
                        {t("orderDetails.financial.title")}
                      </Label>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Card className={cn(
                          "border transition-colors rounded-lg",
                          watch("totalAmount") && Number(watch("totalAmount")) > 0 
                            ? "border-emerald-300 bg-emerald-100/50" 
                            : "border-gray-200 bg-white"
                        )}>
                          <CardContent className="p-3 rounded-lg">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <DollarSign className={cn(
                                "h-3.5 w-3.5",
                                watch("totalAmount") && Number(watch("totalAmount")) > 0
                                  ? "text-emerald-600"
                                  : "text-gray-400"
                              )} />
                              <Label className="text-xs text-muted-foreground">
                                {t("orderDetails.financial.totalAmount")}
                              </Label>
                            </div>
                            <Input
                              type="number"
                              {...register("totalAmount")}
                              className={cn(
                                "h-8 bg-white font-semibold text-sm rounded-lg",
                                watch("totalAmount") && Number(watch("totalAmount")) > 0
                                  ? "text-emerald-700"
                                  : ""
                              )}
                              placeholder="0.00"
                            />
                          </CardContent>
                        </Card>

                        <Card className={cn(
                          "border transition-colors rounded-lg",
                          watch("paymentStatus") === "paid"
                            ? "border-emerald-300 bg-emerald-100/50"
                            : watch("paymentStatus") === "unpaid"
                            ? "border-red-200 bg-red-50/50"
                            : "border-gray-200 bg-white"
                        )}>
                          <CardContent 
                            className="p-3 rounded-lg"
                            style={watch("paymentStatus") === "paid" ? { 
                              backgroundColor: 'var(--color-bg-green)', 
                              color: 'var(--color-black)' 
                            } : watch("paymentStatus") === "unpaid" ? { 
                              backgroundColor: 'var(--color-bg-pink-light)', 
                              color: 'var(--color-black)' 
                            } : undefined}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Clock className={cn(
                                "h-3.5 w-3.5",
                                watch("paymentStatus") === "paid"
                                  ? "text-emerald-600"
                                  : watch("paymentStatus") === "unpaid"
                                  ? "text-red-600"
                                  : "text-gray-400"
                              )} />
                              <Label className="text-xs text-muted-foreground">
                                {t("orderDetails.financial.paymentStatus")}
                              </Label>
                            </div>
                            <Select
                              value={watch("paymentStatus")}
                              onValueChange={(value) => setValue("paymentStatus", value as "paid" | "unpaid")}
                            >
                              <SelectTrigger className={cn(
                                "h-8 bg-white text-sm rounded-lg",
                                watch("paymentStatus") === "paid"
                                  ? "text-emerald-700 border-emerald-300"
                                  : watch("paymentStatus") === "unpaid"
                                  ? "text-red-700 border-red-300"
                                  : ""
                              )}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="paid" className="text-emerald-700">
                                  {t("orderDetails.financial.paid")}
                                </SelectItem>
                                <SelectItem value="unpaid" className="text-red-700">
                                  {t("orderDetails.financial.unpaid")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </CardContent>
                        </Card>
                      </div>

                      {watch("paymentStatus") === "unpaid" && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-8 text-xs border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setValue("paymentStatus", "paid")}
                        >
                          {t("orderDetails.financial.markAsPaid")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Order Details */}
                <Card className="border-black/5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-yellow)' }}>
                  <CardContent className="p-4 rounded-xl">
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wider text-gray-700 font-semibold">
                        {t("orderDetails.orderInfo.title")}
                      </Label>

                      <div className="space-y-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="orderNumber" className="text-xs font-normal text-gray-700">
                            {t("orderDetails.orderInfo.orderNumber")}
                          </Label>
                          <Input
                            id="orderNumber"
                            {...register("orderNumber", { required: true })}
                            className="h-9 bg-white font-mono text-sm rounded-lg"
                            placeholder="N/01/02/01/26/dnk"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="status" className="text-xs font-normal text-gray-700">
                              {t("orderDetails.orderInfo.status")}
                            </Label>
                            <Select
                              value={watch("status")}
                              onValueChange={(value) => setValue("status", value as Order["status"])}
                            >
                              <SelectTrigger className="h-9 bg-white text-sm rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DO_WYKONANIA">{t("kanban.status.doWykonania")}</SelectItem>
                                <SelectItem value="DO_POSWIADCZENIA">{t("kanban.status.doPoswiadczenia")}</SelectItem>
                                <SelectItem value="DO_WYDANIA">{t("kanban.status.doWydania")}</SelectItem>
                                <SelectItem value="USTNE">{t("kanban.status.ustne")}</SelectItem>
                                <SelectItem value="CLOSED">{t("kanban.status.closed")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="priority" className="text-xs font-normal text-gray-700">
                              {t("orderDetails.orderInfo.priority")}
                            </Label>
                            <Select
                              value={watch("priority")}
                              onValueChange={(value) => setValue("priority", value as "high" | "medium" | "low")}
                            >
                              <SelectTrigger className="h-9 bg-white text-sm rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">{t("orderDetails.orderInfo.priorityHigh")}</SelectItem>
                                <SelectItem value="medium">{t("orderDetails.orderInfo.priorityMedium")}</SelectItem>
                                <SelectItem value="low">{t("orderDetails.orderInfo.priorityLow")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="notes" className="text-xs font-normal text-gray-700">
                            {t("orderDetails.orderInfo.notes")}
                          </Label>
                          {order?.id && (
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
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-9 justify-start text-sm"
                                >
                                  <StickyNote className="w-4 h-4 mr-2" />
                                  {t("orderDetails.orderInfo.notes")}
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Files */}
              <TabsContent value="files" className="mt-4 space-y-4 pb-4">
                <div className="space-y-4">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("orderDetails.files.title")}
                  </Label>
                  
                  {/* Dropzone */}
                  <Card className="border-2 border-dashed border-gray-300 hover:border-orange-400 transition-colors">
                    <CardContent className="p-8 text-center">
                      <Upload className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                      <p className="text-sm text-gray-600 mb-1">
                        {t("orderDetails.files.dropzone.title")}
                      </p>
                      <p className="text-xs text-gray-500 mb-4">
                        {t("orderDetails.files.dropzone.subtitle")}
                      </p>
                      <Button type="button" variant="outline" size="sm">
                        {t("orderDetails.files.dropzone.button")}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* File List */}
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      {t("orderDetails.files.attached")}
                    </Label>
                    <div className="space-y-2">
                      {/* Mock files - will be replaced with real data */}
                      <Card>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-red-600" />
                              <div>
                                <p className="text-sm font-medium">document.pdf</p>
                                <p className="text-xs text-gray-500">2.4 MB</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab: History/Chat */}
              <TabsContent value="history" className="mt-4 space-y-4 pb-4">
                <div className="space-y-4">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("orderDetails.history.title")}
                  </Label>
                  
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-gray-500 text-center py-8">
                        {t("orderDetails.history.empty")}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </form>
          </ScrollArea>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              {t("orderDetails.actions.cancel")}
            </Button>
            <Button
              type="submit"
              form="order-form"
              className="flex-1 bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            >
              {t("orderDetails.actions.save")}
            </Button>
          </div>
        </Tabs>
      </div>
    </aside>
  );
}
