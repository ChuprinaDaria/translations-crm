import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { NotesManager, Note } from "../../../components/NotesManager";
import { notesApi, type InternalNote } from "../api/notes";
import { timelineApi, type TimelineStep } from "../api/timeline";
import { translatorsApi, type Translator, type TranslationRequest } from "../api/translators";
import { ordersApi, type Order as ApiOrder } from "../api/orders";
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
  StickyNote,
  Users
} from "lucide-react";
import { useI18n } from "../../../lib/i18n";
import { cn } from "../../../components/ui/utils";
import { formatDistanceToNow } from "date-fns";
import { pl, uk, enUS, type Locale } from "date-fns/locale";
import { ProgressTimelineCompact } from './ProgressTimelineCompact';
import { toast } from "sonner";

// Interface for translator assignment on order
interface OrderTranslator {
  id: string;
  translatorId: number;
  translatorName: string;
  fee: number;
  deadline?: string;
}

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

// Mini form for adding a translator
function AddTranslatorForm({
  availableTranslators,
  onAdd,
  isLoading,
}: {
  availableTranslators: Translator[];
  onAdd: (translatorId: number, fee: number) => void;
  isLoading: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [fee, setFee] = useState<number>(0);

  const selectedTranslator = availableTranslators.find(t => String(t.id) === selectedId);

  const handleAdd = () => {
    if (!selectedId || fee <= 0) return;
    onAdd(Number(selectedId), fee);
    setSelectedId("");
    setFee(0);
  };

  // Auto-set fee when translator selected
  useEffect(() => {
    if (selectedTranslator && selectedTranslator.languages.length > 0) {
      setFee(selectedTranslator.languages[0].rate_per_page || 0);
    }
  }, [selectedTranslator]);

  if (isLoading) {
    return <div className="text-xs text-gray-500 text-center py-2">Завантаження...</div>;
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-300">
      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger className="flex-1 h-8 text-xs bg-white">
          <SelectValue placeholder="Обрати перекладача..." />
        </SelectTrigger>
        <SelectContent>
          {availableTranslators.length === 0 ? (
            <SelectItem value="none" disabled>Немає доступних перекладачів</SelectItem>
          ) : (
            availableTranslators.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name} {t.languages[0] && `(${t.languages[0].rate_per_page} zł)`}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <Input
        type="number"
        value={fee || ""}
        onChange={(e) => setFee(Number(e.target.value))}
        className="w-20 h-8 text-xs"
        placeholder="Гонорар"
      />
      <span className="text-xs text-gray-500">zł</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-2"
        onClick={handleAdd}
        disabled={!selectedId || fee <= 0}
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}

const TIMELINE_STEPS = [
  { type: 'client_created', label: 'Створено клієнта' },
  { type: 'order_created', label: 'Zlecenie utworzone' },
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
  
  // Translators state
  const [availableTranslators, setAvailableTranslators] = useState<Translator[]>([]);
  const [orderTranslators, setOrderTranslators] = useState<OrderTranslator[]>([]);
  const [isLoadingTranslators, setIsLoadingTranslators] = useState(false);
  
  // Full order data from API (with CSV fields)
  const [fullOrderData, setFullOrderData] = useState<ApiOrder | null>(null);
  const [isLoadingOrderData, setIsLoadingOrderData] = useState(false);
  
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

  // Завантаження timeline, перекладачів та повних даних замовлення при відкритті
  useEffect(() => {
    if (open && order?.id) {
      loadTimeline();
      loadTranslators();
      loadOrderTranslators();
      loadFullOrderData();
    }
  }, [open, order?.id]);
  
  const loadFullOrderData = async () => {
    if (!order?.id) return;
    setIsLoadingOrderData(true);
    try {
      const fullOrder = await ordersApi.getOrder(order.id);
      setFullOrderData(fullOrder);
    } catch (error) {
      console.error('Error loading full order data:', error);
      setFullOrderData(null);
    } finally {
      setIsLoadingOrderData(false);
    }
  };

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

  const loadTranslators = async () => {
    try {
      const translators = await translatorsApi.getTranslators({ status: 'active' });
      setAvailableTranslators(translators);
    } catch (error) {
      console.error('Error loading translators:', error);
    }
  };

  const loadOrderTranslators = async () => {
    if (!order?.id) return;
    setIsLoadingTranslators(true);
    try {
      const requests = await translatorsApi.getOrderTranslationRequests(order.id);
      // Convert accepted requests to order translators
      const acceptedTranslators = requests
        .filter((req: TranslationRequest) => req.status === 'accepted')
        .map((req: TranslationRequest) => ({
          id: String(req.id),
          translatorId: req.translator_id,
          translatorName: req.translator?.name || 'Перекладач',
          fee: req.offered_rate,
          deadline: req.response_at,
        }));
      setOrderTranslators(acceptedTranslators);
    } catch (error) {
      console.error('Error loading order translators:', error);
      setOrderTranslators([]);
    } finally {
      setIsLoadingTranslators(false);
    }
  };

  const handleAddTranslator = async (translatorId: number, fee: number) => {
    if (!order?.id) return;
    if (orderTranslators.length >= 10) {
      toast.error('Maksymalnie 10 tłumaczy na zlecenie');
      return;
    }
    
    const translator = availableTranslators.find(t => t.id === translatorId);
    if (!translator) return;

    try {
      const request = await translatorsApi.createTranslationRequest({
        order_id: order.id,
        translator_id: translatorId,
        sent_via: 'telegram',
        offered_rate: fee,
      });
      
      // Auto-accept the request for immediate assignment
      await translatorsApi.acceptTranslationRequest(request.id);
      
      setOrderTranslators(prev => [...prev, {
        id: String(request.id),
        translatorId: translatorId,
        translatorName: translator.name,
        fee: fee,
      }]);
      
      toast.success(`Перекладач ${translator.name} призначений`);
    } catch (error: any) {
      console.error('Error adding translator:', error);
      toast.error(error?.message || 'Помилка призначення перекладача');
    }
  };

  const handleRemoveTranslator = async (orderTranslatorId: string) => {
    try {
      // Just remove from local state for now
      // TODO: Add API endpoint to remove translator from order
      setOrderTranslators(prev => prev.filter(t => t.id !== orderTranslatorId));
      toast.success('Перекладача видалено');
    } catch (error) {
      console.error('Error removing translator:', error);
      toast.error('Помилка видалення перекладача');
    }
  };

  const handleUpdateTranslatorFee = (orderTranslatorId: string, newFee: number) => {
    setOrderTranslators(prev => prev.map(t => 
      t.id === orderTranslatorId ? { ...t, fee: newFee } : t
    ));
  };

  const totalTranslatorFees = orderTranslators.reduce((sum, t) => sum + t.fee, 0);

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
    <aside className="w-[400px] border-l border-gray-200 bg-white flex flex-col shrink-0 h-full">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              Szczegóły zlecenia
                </h2>
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
              <TabsContent value="details" className="mt-3 space-y-3 pb-4">
                {/* Client Section */}
                <Card className="border-black/5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-blue)' }}>
                  <CardContent className="p-3 rounded-xl">
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
                  <CardContent className="p-3 rounded-xl" style={{ color: 'var(--color-black)', backgroundColor: 'var(--color-bg-purple-light)' }}>
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wider text-gray-700 font-semibold">
                        {t("orderDetails.timeline.title")}
                      </Label>
                      
                      <div className="space-y-2">
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
                  <CardContent className="p-3 rounded-xl">
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

                {/* CSV Fields Section */}
                {fullOrderData && (
                  <Card className="border-black/5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-blue-light)' }}>
                    <CardContent className="p-3 rounded-xl">
                      <div className="space-y-3">
                        <Label className="text-xs uppercase tracking-wider text-gray-700 font-semibold">
                          Додаткова інформація
                        </Label>
                        
                        {/* Ціни нетто/брутто */}
                        {(fullOrderData.price_netto || fullOrderData.price_brutto) && (
                          <div className="grid grid-cols-2 gap-2">
                            {fullOrderData.price_netto && (
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-600">Ціна нетто</Label>
                                <div className="text-sm font-semibold text-gray-900">
                                  {fullOrderData.price_netto.toFixed(2)} zł
                                </div>
                              </div>
                            )}
                            {fullOrderData.price_brutto && (
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-600">Ціна брутто</Label>
                                <div className="text-sm font-semibold text-gray-900">
                                  {fullOrderData.price_brutto.toFixed(2)} zł
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Reference Code & Repertorium Number */}
                        {(fullOrderData.reference_code || fullOrderData.repertorium_number) && (
                          <div className="grid grid-cols-2 gap-2">
                            {fullOrderData.reference_code && (
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-600">Код референційний</Label>
                                <div className="text-sm font-mono text-gray-900">
                                  {fullOrderData.reference_code}
                                </div>
                              </div>
                            )}
                            {fullOrderData.repertorium_number && (
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-600">Номер реперторію</Label>
                                <div className="text-sm font-mono text-gray-900">
                                  {fullOrderData.repertorium_number}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Follow-up Date & Order Source */}
                        <div className="grid grid-cols-2 gap-2">
                          {fullOrderData.follow_up_date && (
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-600">Дата повторного контакту</Label>
                              <div className="text-sm text-gray-900">
                                {new Date(fullOrderData.follow_up_date).toLocaleDateString('pl-PL')}
                              </div>
                            </div>
                          )}
                          {fullOrderData.order_source && (
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-600">Джерело замовлення</Label>
                              <div className="text-sm font-semibold text-gray-900">
                                {fullOrderData.order_source}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Language & Translation Type */}
                        <div className="grid grid-cols-2 gap-2">
                          {fullOrderData.language && (
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-600">Мова</Label>
                              <div className="text-sm text-gray-900">
                                {fullOrderData.language}
                              </div>
                            </div>
                          )}
                          {fullOrderData.translation_type && (
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-600">Тип документа</Label>
                              <div className="text-sm text-gray-900">
                                {fullOrderData.translation_type}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Translators Section */}
                <Card className="border-black/5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-purple-light)' }}>
                  <CardContent className="p-3 rounded-xl">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider text-gray-700 font-semibold flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Перекладачі ({orderTranslators.length}/10)
                        </Label>
                        {totalTranslatorFees > 0 && (
                          <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                            Разом: {totalTranslatorFees} zł
                          </span>
                        )}
                      </div>

                      {/* Current translators */}
                      {orderTranslators.length > 0 && (
                        <div className="space-y-2">
                          {orderTranslators.map((translator) => (
                            <div 
                              key={translator.id} 
                              className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200"
                            >
                              <Avatar className="w-7 h-7">
                                <AvatarFallback className="bg-purple-200 text-purple-800 text-xs">
                                  {translator.translatorName.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {translator.translatorName}
                                </p>
                              </div>
                              <Input
                                type="number"
                                value={translator.fee}
                                onChange={(e) => handleUpdateTranslatorFee(translator.id, Number(e.target.value))}
                                className="w-20 h-7 text-xs text-right"
                                placeholder="0"
                              />
                              <span className="text-xs text-gray-500">zł</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRemoveTranslator(translator.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add new translator */}
                      {orderTranslators.length < 10 && (
                        <AddTranslatorForm
                          availableTranslators={availableTranslators.filter(
                            t => !orderTranslators.some(ot => ot.translatorId === t.id)
                          )}
                          onAdd={handleAddTranslator}
                          isLoading={isLoadingTranslators}
                        />
                      )}

                      {orderTranslators.length === 0 && !isLoadingTranslators && (
                        <p className="text-xs text-gray-500 text-center py-2">
                          Ще немає призначених перекладачів
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Notes Section */}
                {order?.id && (
                <Card className="border-black/5 rounded-xl" style={{ backgroundColor: 'var(--color-bg-yellow)' }}>
                    <CardContent className="p-3 rounded-xl">
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wider text-gray-700 font-semibold">
                          Нотатки
                      </Label>
                            <NotesManager
                              entityId={order.id}
                              entityName={order.orderNumber}
                              iconSize="sm"
                              onLoad={async () => {
                                try {
                                  const internalNotes = await notesApi.getNotes('order', order.id);
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
                                  const createdNote = await notesApi.createNote({
                                    entity_type: 'order',
                                    entity_id: order.id,
                                    text: note.text,
                                  });
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
                              Додати нотатку
                                </Button>
                              }
                            />
                    </div>
                  </CardContent>
                </Card>
                )}
              </TabsContent>

              {/* Tab: Files */}
              <TabsContent value="files" className="mt-4 space-y-4 pb-4">
                <div className="space-y-4">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("orderDetails.files.title")}
                  </Label>
                  
                  {/* Parse files from description and file_url */}
                  {(() => {
                    const parseFilesFromDescription = (description: string | null | undefined): Array<{ name: string; url: string }> => {
                      if (!description) return [];
                      
                      const files: Array<{ name: string; url: string }> = [];
                      const filePattern = /Файл:\s*([^\n(]+)\s*\(([^)]+)\)/g;
                      let match;
                      
                      while ((match = filePattern.exec(description)) !== null) {
                        files.push({
                          name: match[1].trim(),
                          url: match[2].trim(),
                        });
                      }
                      
                      return files;
                    };

                    const filesFromDescription = parseFilesFromDescription(order?.description);
                    const allFiles: Array<{ name: string; url: string }> = [];
                    
                    // Add file from file_url if exists
                    if (order?.file_url) {
                      const fileName = order.file_url.split('/').pop() || 'Файл';
                      const isInDescription = filesFromDescription.some(f => f.url === order.file_url);
                      if (!isInDescription) {
                        allFiles.push({ name: fileName, url: order.file_url });
                      }
                    }
                    
                    // Add files from description
                    allFiles.push(...filesFromDescription);

                    const getImageUrl = (imagePath?: string | null): string | undefined => {
                      if (!imagePath) return undefined;
                      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                        return imagePath;
                      }
                      if (imagePath.startsWith('/api/v1')) {
                        return imagePath;
                      }
                      return `/api/v1/${imagePath}`;
                    };

                    if (allFiles.length === 0) {
                      return (
                        <Card className="border-2 border-dashed border-gray-300">
                    <CardContent className="p-8 text-center">
                            <FileText className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                            <p className="text-sm text-gray-600">
                              Немає файлів
                            </p>
                    </CardContent>
                  </Card>
                      );
                    }

                    return (
                  <div className="space-y-2">
                        {allFiles.map((file, index) => {
                          const fileUrl = getImageUrl(file.url);
                          return (
                            <Card key={index}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <FileText className="h-5 w-5 text-red-600 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium truncate">{file.name}</p>
                                      <p className="text-xs text-gray-500">Plik zlecenia</p>
                              </div>
                            </div>
                                  {fileUrl && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <Button variant="ghost" size="sm" asChild>
                                        <a href={fileUrl} download={file.name} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                                        </a>
                            </Button>
                                    </div>
                                  )}
                          </div>
                        </CardContent>
                      </Card>
                          );
                        })}
                    </div>
                    );
                  })()}
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
