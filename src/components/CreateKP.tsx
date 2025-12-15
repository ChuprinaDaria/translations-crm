import React, { useState, useEffect } from "react";
import { Plus, Search, X, Send, FileText, ChevronRight, Loader2, Clipboard, Edit, Pencil, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  itemsApi,
  categoriesApi,
  subcategoriesApi,
  kpApi,
  templatesApi,
  menusApi,
  clientsApi,
  benefitsApi,
  questionnairesApi,
  checklistsApi,
  getImageUrl,
  type Item,
  type Category,
  type Subcategory,
  type Template as ApiTemplate,
  type Menu,
  type Client,
  type Benefit,
  type ClientQuestionnaire,
  type Checklist,
} from "../lib/api";
import { InfoTooltip } from "./InfoTooltip";

interface Dish {
  id: number;
  name: string;
  description: string;
  weight: number | string; // Може бути число або рядок типу "150/75"
  unit: string;
  price: number;
  photo_url: string;
  category: string;
  subcategory: string;
}

interface AdditionalItem {
  id: number;
  name: string;
  quantity: number;
  unitPrice: number;
  subcategoryId?: number; // Для обладнання - підкатегорія для розрахунку знижок
}

// Формат заходу в UI (локальний стан)
interface UIEventFormat {
  id: number; // локальний ID (індекс)
  name: string;
  eventTime: string;
  peopleCount: string;
  // Група формату (для візуальної структури КП): доставка боксів / кейтерінг / інше
  group?: "" | "delivery-boxes" | "catering" | "other";
  // Страви, вибрані для цього формату
  selectedDishes: number[];
}

// Формати для доставки боксів
const BOX_FORMAT_OPTIONS: string[] = [
  "Доставка боксів",
];

// Формати для кейтерингу
const CATERING_FORMAT_OPTIONS: string[] = [
  "Доставка готових страв",
  "Доставка обідів",
  "Кава-брейк",
  "Фуршет",
  "Банкет",
  "Комплексне обслуговування",
  "Доставка з накриттям (фуршет/банкет)",
  "Бар кейтерінг",
  "Су-від",
  "Оренда обладнання/персоналу",
];

// Популярні формати заходів для підказок у випадаючому списку (застарілий, використовується для сумісності)
const EVENT_FORMAT_OPTIONS: string[] = [
  ...BOX_FORMAT_OPTIONS,
  ...CATERING_FORMAT_OPTIONS,
];

// Компонент для редагування полів у прев'ю
interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onEdit: () => void;
  stepNumber: number;
  type?: "text" | "date" | "tel" | "number";
}

function EditableField({ label, value, onChange, onEdit, stepNumber, type = "text" }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-1">
        <p className="text-gray-500 text-xs">{label}</p>
        <div className="flex items-center gap-2">
          <Input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSave();
              } else if (e.key === "Escape") {
                handleCancel();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleSave}
            className="h-8 w-8 p-0"
          >
            <Check className="w-4 h-4 text-green-600" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 group relative">
      <div className="flex items-center gap-2">
        <p className="text-gray-500 text-xs">{label}</p>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
          title="Редагувати"
        >
          <Pencil className="w-3 h-3 text-gray-400" />
        </button>
      </div>
      <p className="text-gray-900 font-medium">{value === "-" ? "-" : value}</p>
      {value !== "-" && (
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-blue-600 hover:text-blue-800 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Повернутись до кроку {stepNumber}
        </button>
      )}
    </div>
  );
}

interface CreateKPProps {
  kpId?: number | null;
  onClose?: () => void;
}

export function CreateKP({ kpId, onClose }: CreateKPProps = {}) {
  const [step, setStep] = useState(1);
  const [selectedDishes, setSelectedDishes] = useState<number[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [createdKPId, setCreatedKPId] = useState<number | null>(null);
  const [eventGroup, setEventGroup] = useState<"" | "delivery-boxes" | "catering" | "other">("");
  const [eventFormat, setEventFormat] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [coordinatorName, setCoordinatorName] = useState("");
  const [coordinatorPhone, setCoordinatorPhone] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [sendTelegram, setSendTelegram] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState("");
  const [dishQuantities, setDishQuantities] = useState<Record<number, number>>({});
  const [equipmentItems, setEquipmentItems] = useState<AdditionalItem[]>([]);
  const [serviceItems, setServiceItems] = useState<AdditionalItem[]>([]);
  const [transportEquipmentTotal, setTransportEquipmentTotal] = useState<string>("");
  const [transportPersonnelTotal, setTransportPersonnelTotal] = useState<string>("");
  const [equipmentLossOrBreakagePrice, setEquipmentLossOrBreakagePrice] = useState<string>("");
  // Кілька форматів заходу (Welcome drink, Фуршет тощо)
  const [eventFormats, setEventFormats] = useState<UIEventFormat[]>([]);
  // Кастомні страви (додані вручну) - мають негативні ID
  const [customDishes, setCustomDishes] = useState<Dish[]>([]);
  // Змінені ваги та ціни страв (ключ - dish.id, значення - {weight?, price?})
  const [dishOverrides, setDishOverrides] = useState<Record<number, { weight?: number; price?: number }>>({});
  // Лічильник для генерації унікальних негативних ID для кастомних страв
  const [customDishIdCounter, setCustomDishIdCounter] = useState(-1);
  // Активний формат заходу для вибору страв (null = загальний вибір)
  const [activeFormatId, setActiveFormatId] = useState<number | null>(null);
  
  // State for dishes from API
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clientSelectionMode, setClientSelectionMode] = useState<"existing" | "new">("new");
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<number | null>(null); // Deprecated, для сумісності
  const [selectedCashbackId, setSelectedCashbackId] = useState<number | null>(null);
  const [useCashback, setUseCashback] = useState(false);
  // Окремі знижки для кожної категорії
  const [discountMenuId, setDiscountMenuId] = useState<number | null>(null);
  const [discountEquipmentId, setDiscountEquipmentId] = useState<number | null>(null);
  const [discountServiceId, setDiscountServiceId] = useState<number | null>(null);
  // Знижки по підкатегоріях обладнання: {subcategory_id: benefit_id}
  const [discountEquipmentSubcategories, setDiscountEquipmentSubcategories] = useState<Record<number, number>>({});
  // Deprecated: для сумісності
  const [discountIncludeMenu, setDiscountIncludeMenu] = useState(true);
  const [discountIncludeEquipment, setDiscountIncludeEquipment] = useState(false);
  const [discountIncludeService, setDiscountIncludeService] = useState(false);

  // Помилки валідації для кроку 1
  const [step1Errors, setStep1Errors] = useState<{
    clientName?: string;
    eventDate?: string;
    selectedClient?: string;
    eventGroup?: string;
  }>({});

  // Анкети клієнта для автозаповнення КП (legacy)
  const [clientQuestionnaires, setClientQuestionnaires] = useState<ClientQuestionnaire[]>([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<number | null>(null);
  const [questionnaireAutofill, setQuestionnaireAutofill] = useState<
    Record<string, { questionnaireId: number; questionnaireDate?: string }>
  >({});
  
  // Чеклісти клієнта для автозаповнення КП (нова система)
  const [clientChecklists, setClientChecklists] = useState<Checklist[]>([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState<number | null>(null);
  const [checklistAutofill, setChecklistAutofill] = useState<
    Record<string, { checklistId: number; checklistDate?: string }>
  >({});

  // Функція для валідації кроку 1 (без показу помилок)
  const isStep1Valid = (): boolean => {
    if (clientSelectionMode === "existing" && !selectedClientId) {
      return false;
    }
    // Обов'язкові поля: ім'я клієнта + дата події + тип (Бокс/Кейтеринг)
    return !!(clientName && eventDate && eventGroup);
  };

  const applyQuestionnaireToKP = (q: ClientQuestionnaire | null) => {
    if (!q) {
      setQuestionnaireAutofill({});
      setSelectedQuestionnaireId(null);
      return;
    }

    const sourceDate =
      q.event_date ||
      q.created_at ||
      undefined;

    const autofill: Record<string, { questionnaireId: number; questionnaireDate?: string }> = {};

    // Дата заходу
    if (q.event_date) {
      // Конвертуємо дату з формату YYYY-MM-DD або ISO в формат для input[type="date"]
      try {
        const date = new Date(q.event_date);
        if (!isNaN(date.getTime())) {
          const formattedDate = date.toISOString().split('T')[0];
          setEventDate(formattedDate);
          autofill.eventDate = { questionnaireId: q.id, questionnaireDate: sourceDate };
        }
      } catch (e) {
        console.error("Помилка форматування дати:", e);
      }
    }

    // Кількість гостей (якщо є в анкеті)
    // Примітка: guest_count не зберігається в моделі анкети, тому не переносимо

    // Формат заходу
    if (q.event_type) {
      setEventFormat(q.event_type);
      autofill.eventFormat = { questionnaireId: q.id, questionnaireDate: sourceDate };
    }

    // Локація
    if (q.location) {
      setEventLocation(q.location);
      autofill.eventLocation = { questionnaireId: q.id, questionnaireDate: sourceDate };
    }

    // Координатор на локації (пріоритет on_site_contact, якщо немає - contact_person)
    if (q.on_site_contact) {
      setCoordinatorName(q.on_site_contact);
      autofill.coordinatorName = { questionnaireId: q.id, questionnaireDate: sourceDate };
    } else if (q.contact_person) {
      setCoordinatorName(q.contact_person);
      autofill.coordinatorName = { questionnaireId: q.id, questionnaireDate: sourceDate };
    }

    // Телефон координатора (пріоритет on_site_phone, якщо немає - contact_phone)
    if (q.on_site_phone) {
      setCoordinatorPhone(q.on_site_phone);
      autofill.coordinatorPhone = { questionnaireId: q.id, questionnaireDate: sourceDate };
    } else if (q.contact_phone) {
      setCoordinatorPhone(q.contact_phone);
      autofill.coordinatorPhone = { questionnaireId: q.id, questionnaireDate: sourceDate };
    }

    // Час заходу (якщо є arrival_time, додаємо його до event_time)
    let timeString = "";
    if (q.event_start_time && q.event_end_time) {
      timeString = `${q.event_start_time}–${q.event_end_time}`;
    } else if (q.event_start_time) {
      timeString = q.event_start_time;
    }
    if (q.arrival_time) {
      if (timeString) {
        timeString = `Заїзд: ${q.arrival_time} | ${timeString}`;
      } else {
        timeString = `Заїзд: ${q.arrival_time}`;
      }
    }
    if (timeString) {
      setEventTime(timeString);
      autofill.eventTime = { questionnaireId: q.id, questionnaireDate: sourceDate };
    }

    // Створюємо формати заходу з таймінгами з анкети
    const formats: UIEventFormat[] = [];
    
    // Якщо є event_type та таймінги, створюємо формат
    if (q.event_type) {
      let timing = "";
      if (q.event_start_time && q.event_end_time) {
        timing = `${q.event_start_time}–${q.event_end_time}`;
      } else if (q.service_type_timing) {
        timing = q.service_type_timing;
      } else if (q.event_start_time) {
        timing = q.event_start_time;
      }
      
      formats.push({
        id: 0,
        name: q.event_type,
        eventTime: timing,
        peopleCount: guestCount || "",
        selectedDishes: [],
      });
    }
    
    // Якщо є additional_services_timing, можна створити додатковий формат
    if (q.additional_services_timing && q.additional_services_timing.trim() !== "") {
      formats.push({
        id: formats.length,
        name: "Додатковий сервіс",
        eventTime: q.additional_services_timing,
        peopleCount: guestCount || "",
        selectedDishes: [],
      });
    }
    
    if (formats.length > 0) {
      setEventFormats(formats);
      autofill.eventFormats = { questionnaireId: q.id, questionnaireDate: sourceDate };
    }

    setSelectedQuestionnaireId(q.id);
    setQuestionnaireAutofill(autofill);
  };

  const loadClientQuestionnaires = async (clientId: number) => {
    try {
      const data = await questionnairesApi.getClientQuestionnaires(clientId);
      const questionnaires = data.questionnaires || [];
      setClientQuestionnaires(questionnaires);

      // НЕ автоматично застосовуємо анкету - пріоритет чеклістам
      setSelectedQuestionnaireId(null);
      setQuestionnaireAutofill({});
    } catch (error) {
      console.error("Помилка завантаження анкет клієнта:", error);
      setClientQuestionnaires([]);
      setSelectedQuestionnaireId(null);
      setQuestionnaireAutofill({});
    }
  };

  // Застосування чекліста до КП
  const applyChecklistToKP = (checklist: Checklist | null) => {
    if (!checklist) {
      setChecklistAutofill({});
      setSelectedChecklistId(null);
      return;
    }

    const sourceDate = checklist.event_date || checklist.created_at || undefined;
    const autofill: Record<string, { checklistId: number; checklistDate?: string }> = {};

    // Дата заходу
    if (checklist.event_date) {
      try {
        const date = new Date(checklist.event_date);
        if (!isNaN(date.getTime())) {
          const formattedDate = date.toISOString().split('T')[0];
          setEventDate(formattedDate);
          autofill.eventDate = { checklistId: checklist.id, checklistDate: sourceDate };
        }
      } catch (e) {
        console.error("Помилка форматування дати:", e);
      }
    }

    // Тип послуги (eventGroup)
    if (checklist.checklist_type) {
      const group = checklist.checklist_type === "box" ? "delivery-boxes" : "catering";
      setEventGroup(group);
      autofill.eventGroup = { checklistId: checklist.id, checklistDate: sourceDate };
    }

    // Формат заходу
    if (checklist.event_format) {
      setEventFormat(checklist.event_format);
      autofill.eventFormat = { checklistId: checklist.id, checklistDate: sourceDate };
    }

    // Кількість гостей
    if (checklist.guest_count) {
      setGuestCount(checklist.guest_count.toString());
      autofill.guestCount = { checklistId: checklist.id, checklistDate: sourceDate };
    }

    // Локація
    if (checklist.location_address) {
      let location = checklist.location_address;
      if (checklist.location_floor) {
        location += `, поверх ${checklist.location_floor}`;
      }
      if (checklist.location_elevator) {
        location += ` (є ліфт)`;
      }
      setEventLocation(location);
      autofill.eventLocation = { checklistId: checklist.id, checklistDate: sourceDate };
    }

    // Контактна особа
    if (checklist.contact_name) {
      setCoordinatorName(checklist.contact_name);
      autofill.coordinatorName = { checklistId: checklist.id, checklistDate: sourceDate };
    }

    // Телефон контакту
    if (checklist.contact_phone) {
      setCoordinatorPhone(checklist.contact_phone);
      autofill.coordinatorPhone = { checklistId: checklist.id, checklistDate: sourceDate };
    }

    // Email
    if (checklist.contact_email) {
      setClientEmail(checklist.contact_email);
      autofill.clientEmail = { checklistId: checklist.id, checklistDate: sourceDate };
    }

    // Ім'я клієнта
    if (checklist.contact_name) {
      setClientName(checklist.contact_name);
      autofill.clientName = { checklistId: checklist.id, checklistDate: sourceDate };
    }

    // Час заходу
    if (checklist.delivery_time) {
      setEventTime(checklist.delivery_time);
      autofill.eventTime = { checklistId: checklist.id, checklistDate: sourceDate };
    }

    // Створюємо формат заходу з чекліста
    const formats: UIEventFormat[] = [];
    if (checklist.event_format) {
      formats.push({
        id: 0,
        name: checklist.event_format,
        eventTime: checklist.delivery_time || "",
        peopleCount: checklist.guest_count?.toString() || "",
        group: checklist.checklist_type === "box" ? "delivery-boxes" : "catering",
        selectedDishes: [],
      });
    }
    if (formats.length > 0) {
      setEventFormats(formats);
      autofill.eventFormats = { checklistId: checklist.id, checklistDate: sourceDate };
    }

    setSelectedChecklistId(checklist.id);
    setChecklistAutofill(autofill);
    
    // Очищаємо дані з анкети якщо обрали чекліст
    setSelectedQuestionnaireId(null);
    setQuestionnaireAutofill({});
  };

  // Завантаження чеклістів клієнта
  const loadClientChecklists = async (clientId: number) => {
    try {
      const data = await checklistsApi.getClientChecklists(clientId);
      const checklists = data.checklists || [];
      setClientChecklists(checklists);

      // Автоматично застосовуємо найновіший чекліст
      if (checklists.length > 0) {
        applyChecklistToKP(checklists[0]);
      } else {
        setSelectedChecklistId(null);
        setChecklistAutofill({});
      }
    } catch (error) {
      console.error("Помилка завантаження чеклістів клієнта:", error);
      setClientChecklists([]);
      setSelectedChecklistId(null);
      setChecklistAutofill({});
    }
  };

  // Очищення даних чекліста
  const clearChecklistData = () => {
    setSelectedChecklistId(null);
    setChecklistAutofill({});
    // Очищаємо поля, які були заповнені з чекліста
    setEventDate("");
    setEventFormat("");
    setEventLocation("");
    setCoordinatorName("");
    setCoordinatorPhone("");
    setEventTime("");
    setGuestCount("");
    setEventFormats([]);
  };

  // Функція для валідації кроку 1 з показом помилок
  const validateStep1 = (): boolean => {
    const errors: {
      clientName?: string;
      eventDate?: string;
      selectedClient?: string;
      eventGroup?: string;
    } = {};

    if (clientSelectionMode === "existing" && !selectedClientId) {
      errors.selectedClient = "Оберіть клієнта зі списку";
    }

    if (!clientName.trim()) {
      errors.clientName = "Ім'я клієнта є обов'язковим полем";
    }

    if (!eventDate) {
      errors.eventDate = "Дата події є обов'язковим полем";
    }

    if (!eventGroup) {
      errors.eventGroup = "Оберіть тип: Бокс або Кейтеринг";
    }

    setStep1Errors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error("Будь ласка, заповніть обов'язкові поля на кроці 1");
      return false;
    }

    return true;
  };

  // Функція для валідації кроку 2
  const validateStep2 = (): boolean => {
    if (selectedDishes.length === 0 && customDishes.length === 0) {
      toast.error("Будь ласка, оберіть хоча б одну страву або додайте позицію вручну");
      return false;
    }
    // Перевіряємо, що всі кастомні страви мають назву
    const invalidCustomDishes = customDishes.filter((d) => !d.name || d.name.trim() === "");
    if (invalidCustomDishes.length > 0) {
      toast.error("Будь ласка, заповніть назви всіх доданих вручну позицій");
      return false;
    }
    return true;
  };

  // Функція для переходу на крок з валідацією
  const goToStep = (targetStep: number) => {
    // Дозволяємо повертатися назад без валідації
    if (targetStep < step) {
      setStep(targetStep);
      saveFormDataToLocalStorage();
      return;
    }

    // Валідація перед переходом вперед
    if (step === 1 && !validateStep1()) {
      return;
    }
    if (step === 2 && targetStep > 2 && !validateStep2()) {
      return;
    }

    setStep(targetStep);
    saveFormDataToLocalStorage();
  };

  // Збереження даних форми в localStorage
  const saveFormDataToLocalStorage = () => {
    const formData = {
      clientName,
      eventGroup,
      eventFormat,
      eventDate,
      eventTime,
      guestCount,
      eventLocation,
      clientEmail,
      clientPhone,
      coordinatorName,
      coordinatorPhone,
      sendEmail,
      emailMessage,
      sendTelegram,
      telegramMessage,
      selectedDishes,
      dishQuantities,
      equipmentItems,
      serviceItems,
      transportEquipmentTotal,
      transportPersonnelTotal,
      equipmentLossOrBreakagePrice,
      selectedTemplateId,
      selectedDiscountId,
      selectedCashbackId,
      useCashback,
      discountIncludeMenu,
      discountIncludeEquipment,
      discountIncludeService,
        eventFormats,
        customDishes,
        dishOverrides,
        customDishIdCounter,
        activeFormatId,
      };
      localStorage.setItem('kp_form_data', JSON.stringify(formData));
    };

  // Завантаження даних форми з localStorage
  const loadFormDataFromLocalStorage = () => {
    const savedData = localStorage.getItem('kp_form_data');
    if (savedData) {
      try {
        const formData = JSON.parse(savedData);
        setClientName(formData.clientName || "");
        setEventGroup(formData.eventGroup || "");
        setEventFormat(formData.eventFormat || "");
        setEventDate(formData.eventDate || "");
        setEventTime(formData.eventTime || "");
        setGuestCount(formData.guestCount || "");
        setEventLocation(formData.eventLocation || "");
        setClientEmail(formData.clientEmail || "");
        setClientPhone(formData.clientPhone || "");
        setCoordinatorName(formData.coordinatorName || "");
        setCoordinatorPhone(formData.coordinatorPhone || "");
        setSendEmail(formData.sendEmail || false);
        setEmailMessage(formData.emailMessage || "");
        setSendTelegram(formData.sendTelegram || false);
        setTelegramMessage(formData.telegramMessage || "");
        setSelectedDishes(formData.selectedDishes || []);
        setDishQuantities(formData.dishQuantities || {});
        setEquipmentItems(formData.equipmentItems || []);
        setServiceItems(formData.serviceItems || []);
        setTransportEquipmentTotal(formData.transportEquipmentTotal || "");
        setTransportPersonnelTotal(formData.transportPersonnelTotal || "");
        setEquipmentLossOrBreakagePrice(formData.equipmentLossOrBreakagePrice || "");
        setSelectedTemplateId(formData.selectedTemplateId || null);
        setSelectedDiscountId(formData.selectedDiscountId || null);
        setSelectedCashbackId(formData.selectedCashbackId || null);
        setUseCashback(formData.useCashback || false);
        setDiscountIncludeMenu(formData.discountIncludeMenu !== undefined ? formData.discountIncludeMenu : true);
        setDiscountIncludeEquipment(formData.discountIncludeEquipment || false);
        setDiscountIncludeService(formData.discountIncludeService || false);
        setEventFormats((formData.eventFormats || []).map((f: any) => ({
          ...f,
          selectedDishes: f.selectedDishes || [],
        })));
        setCustomDishes(formData.customDishes || []);
        setDishOverrides(formData.dishOverrides || {});
        setCustomDishIdCounter(formData.customDishIdCounter || -1);
        setActiveFormatId(formData.activeFormatId || null);
      } catch (error) {
        console.error("Помилка завантаження даних з localStorage:", error);
      }
    }
  };

  // Завантаження даних при ініціалізації
  useEffect(() => {
    loadFormDataFromLocalStorage();
  }, []);

  // Cleanup PDF preview URL при розмонтуванні
  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  // Автоматичне збереження даних при зміні полів форми
  useEffect(() => {
    const timer = setTimeout(() => {
      saveFormDataToLocalStorage();
    }, 500); // Debounce на 500мс
    return () => clearTimeout(timer);
  }, [
    clientName,
    eventGroup,
    eventFormat,
    eventDate,
    eventTime,
    guestCount,
    eventLocation,
    clientEmail,
    clientPhone,
    coordinatorName,
    coordinatorPhone,
    sendEmail,
    emailMessage,
    sendTelegram,
    telegramMessage,
    selectedDishes,
    dishQuantities,
    equipmentItems,
    serviceItems,
    transportEquipmentTotal,
    transportPersonnelTotal,
    selectedTemplateId,
    selectedDiscountId,
    selectedCashbackId,
    useCashback,
    discountIncludeMenu,
    discountIncludeEquipment,
    discountIncludeService,
    eventFormats,
    customDishes,
    dishOverrides,
    customDishIdCounter,
    activeFormatId,
  ]);

  // Load dishes from API
  useEffect(() => {
    const loadDishes = async () => {
      setLoading(true);
      try {
        const [itemsData, categoriesData, subcategoriesData] = await Promise.all([
          itemsApi.getItems(0, 1000),
          categoriesApi.getCategories(),
          subcategoriesApi.getSubcategories(),
        ]);
        
        // Filter only active dishes and map to our Dish interface
        const activeDishes: Dish[] = itemsData
          .filter(item => item.active)
          .map(item => ({
            id: item.id,
            name: item.name,
            description: item.description || "",
            weight: item.weight || 0,
            unit: item.unit || "",
            price: item.price,
            photo_url: item.photo_url || "",
            category: item.subcategory?.category?.name || "Інше",
            subcategory: item.subcategory?.name || "",
          }));
        
        setDishes(activeDishes);
        setCategories(categoriesData);
        setSubcategories(subcategoriesData);
        toast.success("Страви завантажено");
      } catch (error: any) {
        toast.error("Помилка завантаження страв");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    
    loadDishes();
  }, []);

  // Load clients from API
  useEffect(() => {
    const loadClients = async () => {
      try {
        const clientsData = await clientsApi.getClients();
        // Бекенд може повертати як { total, clients: [...] }, так і просто масив клієнтів.
        const list = Array.isArray(clientsData) ? clientsData : (clientsData as any).clients || [];
        setClients(list);
      } catch (error: any) {
        console.error("Помилка завантаження клієнтів:", error);
      }
    };
    
    loadClients();
  }, []);

  // Load benefits from API
  useEffect(() => {
    const loadBenefits = async () => {
      try {
        const benefitsData = await benefitsApi.getBenefits(undefined, true);
        setBenefits(benefitsData);
      } catch (error: any) {
        console.error("Помилка завантаження бенфітів:", error);
      }
    };
    
    loadBenefits();
  }, []);

  // Load KP data for editing
  useEffect(() => {
    if (!kpId) return;

    const loadKPData = async () => {
      try {
        setLoading(true);
        const kp = await kpApi.getKP(kpId);
        
        // Заповнюємо всі поля з даних КП
        setClientName(kp.client_name || kp.title || "");
        setEventGroup((kp.event_group as "" | "delivery-boxes" | "catering" | "other") || "");
        setEventFormat(kp.event_format || "");
        setEventDate(kp.event_date ? new Date(kp.event_date).toISOString().split("T")[0] : "");
        setEventTime(kp.event_time || "");
        setGuestCount(kp.people_count?.toString() || "");
        setEventLocation(kp.event_location || "");
        setClientEmail(kp.client_email || "");
        setClientPhone(kp.client_phone || "");
        setCoordinatorName(kp.coordinator_name || "");
        setCoordinatorPhone(kp.coordinator_phone || "");
        setTransportTotal(kp.transport_total?.toString() || "");
        setSelectedTemplateId(kp.template_id || null);
        setSelectedDiscountId(kp.discount_id || null); // Deprecated
        setSelectedCashbackId(kp.cashback_id || null);
        setUseCashback(kp.use_cashback || false);
        setDiscountIncludeMenu(kp.discount_include_menu !== undefined ? kp.discount_include_menu : true); // Deprecated
        setDiscountIncludeEquipment(kp.discount_include_equipment || false); // Deprecated
        setDiscountIncludeService(kp.discount_include_service || false); // Deprecated
        // Нові окремі знижки
        setDiscountMenuId((kp as any).discount_menu_id || null);
        setDiscountEquipmentId((kp as any).discount_equipment_id || null);
        setDiscountServiceId((kp as any).discount_service_id || null);
        setDiscountEquipmentSubcategories((kp as any).discount_equipment_subcategories || {});

        // Завантажуємо страви
        if (kp.items && kp.items.length > 0) {
          const dishIds = kp.items.map(item => item.item_id);
          setSelectedDishes(dishIds);
          
          const quantities: Record<number, number> = {};
          kp.items.forEach(item => {
            quantities[item.item_id] = item.quantity;
          });
          setDishQuantities(quantities);
        }

        // Завантажуємо обладнання та обслуговування (якщо є в API)
        // Поки що залишаємо порожніми, оскільки в моделі KP немає цих полів як масивів

        toast.success("Дані КП завантажено для редагування");
      } catch (error: any) {
        console.error("Помилка завантаження КП:", error);
        toast.error("Не вдалося завантажити дані КП для редагування");
      } finally {
        setLoading(false);
      }
    };

    loadKPData();
  }, [kpId]);

  // Load templates and menus from API
  useEffect(() => {
    const loadTemplatesAndMenus = async () => {
      setTemplatesLoading(true);
      try {
        const [templatesData, menusData] = await Promise.all([
          templatesApi.getTemplates(),
          menusApi.getMenus(),
        ]);

        setTemplates(templatesData);
        setMenus(menusData);

        // Автовибір шаблону:
        // 1) якщо є шаблон за замовчуванням (is_default === true) – беремо його
        // 2) інакше беремо перший у списку
        if (templatesData.length > 0) {
          const defaultTemplate =
            templatesData.find((t) => t.is_default) || templatesData[0];
          setSelectedTemplateId(defaultTemplate.id);
        }
      } catch (error: any) {
        console.error("Error loading templates or menus", error);
        toast.error("Помилка завантаження шаблонів або меню");
      } finally {
        setTemplatesLoading(false);
      }
    };

    loadTemplatesAndMenus();
  }, []);


  const allTags: string[] = Array.from(
    new Set<string>(dishes.map((dish) => dish.category))
  );

  // Порядок категорій для сортування (якщо категорія є в БД, вона відсортується за цим порядком)
  const categoryOrder: string[] = [
    "Холодні закуски",
    "Салати",
    "Гарячі страви",
    "Гарнір",
    "Десерти",
    "Безалкогольні напої",
    "Алкогольні напої",
    "Доповнення"
  ];

  // Функція для перевірки, чи страва є напоєм
  const isDrink = (dish: Dish): boolean => {
    const category = dish.category || "";
    return category.toLowerCase().includes("напой") || 
           category.toLowerCase().includes("напої") ||
           category === "Безалкогольні напої" ||
           category === "Алкогольні напої";
  };

  // Функція для отримання індексу категорії (для сортування)
  const getCategoryIndex = (category: string): number => {
    if (!category) return 999;
    
    // Перевіряємо точну відповідність
    const exactIndex = categoryOrder.findIndex(cat => 
      category.toLowerCase().trim() === cat.toLowerCase().trim()
    );
    if (exactIndex !== -1) return exactIndex;
    
    // Перевіряємо часткову відповідність (на випадок варіацій назв)
    const partialIndex = categoryOrder.findIndex(cat => 
      category.toLowerCase().includes(cat.toLowerCase()) || 
      cat.toLowerCase().includes(category.toLowerCase())
    );
    if (partialIndex !== -1) return partialIndex;
    
    // Якщо категорія не знайдена в порядку, повертаємо велике число, щоб вона була в кінці
    return 999;
  };

  const filteredDishes = dishes
    .filter((dish) => {
      const matchesSearch =
        dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dish.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => dish.category.includes(tag));
      return matchesSearch && matchesTags;
    })
    .sort((a, b) => {
      // Спочатку сортуємо за категорією
      const categoryDiff = getCategoryIndex(a.category) - getCategoryIndex(b.category);
      if (categoryDiff !== 0) return categoryDiff;
      // Потім за назвою в межах категорії
      return a.name.localeCompare(b.name, 'uk');
    });

  // Групуємо страви за категоріями (категорії беруться з БД)
  const dishesByCategory = filteredDishes.reduce((acc, dish) => {
    const category = dish.category || "Інше";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(dish);
    return acc;
  }, {} as Record<string, typeof filteredDishes>);

  // Сортуємо категорії за порядком (тільки ті, що є в БД)
  const sortedCategories = Object.keys(dishesByCategory).sort((a, b) => {
    return getCategoryIndex(a) - getCategoryIndex(b);
  });

  const toggleDish = (dishId: number, formatId?: number | null) => {
    const targetFormatId = formatId !== undefined ? formatId : activeFormatId;
    
    // Якщо обрано формат, додаємо страву до формату
    if (targetFormatId !== null && targetFormatId !== undefined) {
      setEventFormats((prev) =>
        prev.map((f) => {
          if (f.id === targetFormatId) {
            const isSelected = f.selectedDishes.includes(dishId);
            if (isSelected) {
              return {
                ...f,
                selectedDishes: f.selectedDishes.filter((id) => id !== dishId),
              };
            } else {
              return {
                ...f,
                selectedDishes: [...f.selectedDishes, dishId],
              };
            }
          }
          return f;
        })
      );
    }
    
    // Також додаємо до загального списку обраних страв
    setSelectedDishes((prev) => {
      const isSelected = prev.includes(dishId);
      if (isSelected) {
        const updated = prev.filter((id) => id !== dishId);
        setDishQuantities((q) => {
          const { [dishId]: _, ...rest } = q;
          saveFormDataToLocalStorage();
          return rest;
        });
        saveFormDataToLocalStorage();
        return updated;
      }
      // За замовчуванням: 1 порція на гостя, якщо відома кількість гостей
      setDishQuantities((q) => {
        const newQuantities = {
          ...q,
          [dishId]: q[dishId] ?? (guestCount ? parseInt(guestCount, 10) || 1 : 1),
        };
        setTimeout(() => saveFormDataToLocalStorage(), 0);
        return newQuantities;
      });
      const updated = [...prev, dishId];
      setTimeout(() => saveFormDataToLocalStorage(), 0);
      return updated;
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const getSelectedDishesData = () => {
    const regularDishes = dishes.filter((dish) => selectedDishes.includes(dish.id));
    return [...regularDishes, ...customDishes];
  };

  // Отримати вагу страви з урахуванням перевизначень
  const getDishWeight = (dish: Dish): number | string => {
    if (dishOverrides[dish.id]?.weight !== undefined) {
      return dishOverrides[dish.id].weight!;
    }
    return dish.weight || 0;
  };

  // Функція для парсингу ваги з формату "150/75" або числа
  const parseWeightValue = (weight: number | string): { first: number; second?: number; isRange: boolean } => {
    if (typeof weight === 'string') {
      // Перевіряємо формат "150/75"
      const parts = weight.toString().split('/');
      if (parts.length === 2) {
        const first = parseFloat(parts[0].trim()) || 0;
        const second = parseFloat(parts[1].trim()) || 0;
        return { first, second, isRange: true };
      }
      // Якщо не формат через слеш, намагаємося парсити як число
      const num = parseFloat(weight);
      return { first: isNaN(num) ? 0 : num, isRange: false };
    }
    return { first: weight || 0, isRange: false };
  };

  // Отримати ціну страви з урахуванням перевизначень
  const getDishPrice = (dish: Dish): number => {
    if (dishOverrides[dish.id]?.price !== undefined) {
      return dishOverrides[dish.id].price!;
    }
    return dish.price;
  };

  // Перевірити чи страва кастомна (додана вручну)
  const isCustomDish = (dishId: number): boolean => {
    return dishId < 0;
  };

  const getTotalPrice = () => {
    return getSelectedDishesData().reduce((sum, dish) => {
      const qty = dishQuantities[dish.id] ?? 1;
      const price = getDishPrice(dish);
      return sum + price * qty;
    }, 0);
  };

  // Отримати вартість тільки звичайних страв (без кастомних) для розрахунку знижки
  const getRegularDishesPrice = () => {
    return dishes
      .filter((dish) => selectedDishes.includes(dish.id))
      .reduce((sum, dish) => {
        const qty = dishQuantities[dish.id] ?? 1;
        const price = getDishPrice(dish);
        return sum + price * qty;
      }, 0);
  };

  const getTotalWeight = () => {
    // Розраховуємо загальну вагу в грамах (БЕЗ напоїв)
    return getSelectedDishesData().reduce((sum, dish) => {
      // Пропускаємо напої - вони не рахуються до загальної ваги
      if (isDrink(dish)) {
        return sum;
      }
      
      const qty = dishQuantities[dish.id] ?? 1;
      const weightValue = getDishWeight(dish);
      // Парсимо вагу з формату "150/75" або числа
      const parsedWeight = parseWeightValue(weightValue);
      let weightInGrams = parsedWeight.first;
      const unit = (dish.unit || 'г').toLowerCase();
      
      // Конвертуємо в грами
      if (unit === 'кг') {
        weightInGrams = weightInGrams * 1000;
      } else if (unit === 'г') {
        weightInGrams = weightInGrams;
      } else if (unit === 'л') {
        // Для рідини приблизно 1л = 1000г
        weightInGrams = weightInGrams * 1000;
      } else if (unit === 'мл') {
        weightInGrams = weightInGrams;
      }
      // Для інших одиниць (шт тощо) вважаємо вагу 0
      
      return sum + weightInGrams * qty;
    }, 0);
  };

  // Розраховуємо загальний об'єм напоїв в мл
  const getTotalDrinksVolume = () => {
    return getSelectedDishesData().reduce((sum, dish) => {
      if (!isDrink(dish)) {
        return sum;
      }
      
      const qty = dishQuantities[dish.id] ?? 1;
      const weightValue = getDishWeight(dish);
      // Парсимо вагу з формату "150/75" або числа
      const parsedWeight = parseWeightValue(weightValue);
      let volumeInMl = parsedWeight.first;
      const unit = (dish.unit || 'мл').toLowerCase();
      
      // Конвертуємо в мілілітри
      if (unit === 'л') {
        volumeInMl = volumeInMl * 1000;
      } else if (unit === 'мл') {
        volumeInMl = volumeInMl;
      } else if (unit === 'г' || unit === 'кг') {
        // Якщо напій був в грамах/кг, конвертуємо в мл (1г ≈ 1мл для води)
        if (unit === 'кг') {
          volumeInMl = volumeInMl * 1000;
        }
      }
      
      return sum + volumeInMl * qty;
    }, 0);
  };

  const getWeightPerPerson = () => {
    const totalWeight = getTotalWeight();
    const peopleCountNum = guestCount ? parseInt(guestCount, 10) || 0 : 0;
    if (totalWeight > 0 && peopleCountNum > 0) {
      return totalWeight / peopleCountNum;
    }
    return 0;
  };

  // Розраховуємо об'єм напоїв на 1 особу в мл
  const getDrinksVolumePerPerson = () => {
    const totalDrinksVolume = getTotalDrinksVolume();
    const peopleCountNum = guestCount ? parseInt(guestCount, 10) || 0 : 0;
    if (totalDrinksVolume > 0 && peopleCountNum > 0) {
      return totalDrinksVolume / peopleCountNum;
    }
    return 0;
  };

  const calculateAdditionalTotal = (items: AdditionalItem[]) =>
    items.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
      0
    );

  const equipmentLossOrBreakagePriceNum = parseFloat(equipmentLossOrBreakagePrice) || 0;
  const equipmentTotal = calculateAdditionalTotal(equipmentItems) + equipmentLossOrBreakagePriceNum;
  const serviceTotal = calculateAdditionalTotal(serviceItems);

  const foodTotalPrice = getTotalPrice();
  const regularDishesPrice = getRegularDishesPrice(); // Тільки звичайні страви (без кастомних)

  // Функція для розрахунку знижки з урахуванням окремих знижок по категоріях
  const calculateDiscountAmount = () => {
    let totalDiscount = 0;
    
    // Знижка на меню
    if (discountMenuId) {
      const discountBenefit = benefits.find((b) => b.id === discountMenuId);
      if (discountBenefit) {
        totalDiscount += (regularDishesPrice * discountBenefit.value) / 100;
      }
    }
    
    // Знижка на обладнання
    if (discountEquipmentId || Object.keys(discountEquipmentSubcategories).length > 0) {
      // Якщо є знижки по підкатегоріях, розраховуємо окремо для кожної
      if (Object.keys(discountEquipmentSubcategories).length > 0) {
        equipmentItems.forEach(item => {
          if (item.subcategoryId && discountEquipmentSubcategories[item.subcategoryId]) {
            const benefitId = discountEquipmentSubcategories[item.subcategoryId];
            const discountBenefit = benefits.find((b) => b.id === benefitId);
            if (discountBenefit) {
              const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
              totalDiscount += (itemTotal * discountBenefit.value) / 100;
            }
          }
        });
        // Додаємо знижку на "Втрати та бій" якщо є загальна знижка
        if (discountEquipmentId) {
          const discountBenefit = benefits.find((b) => b.id === discountEquipmentId);
          if (discountBenefit) {
            totalDiscount += (equipmentLossOrBreakagePriceNum * discountBenefit.value) / 100;
          }
        }
      } else if (discountEquipmentId) {
        // Загальна знижка на все обладнання
        const discountBenefit = benefits.find((b) => b.id === discountEquipmentId);
        if (discountBenefit) {
          totalDiscount += (equipmentTotal * discountBenefit.value) / 100;
        }
      }
    }
    
    // Знижка на сервіс
    if (discountServiceId) {
      const discountBenefit = benefits.find((b) => b.id === discountServiceId);
      if (discountBenefit) {
        totalDiscount += (serviceTotal * discountBenefit.value) / 100;
      }
    }
    
    // Для сумісності зі старою системою
    if (!discountMenuId && !discountEquipmentId && !discountServiceId && selectedDiscountId) {
      const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
      if (discountBenefit) {
        let discountBase = 0;
        if (discountIncludeMenu) {
          discountBase += regularDishesPrice;
        }
        if (discountIncludeEquipment) {
          discountBase += equipmentTotal;
        }
        if (discountIncludeService) {
          discountBase += serviceTotal;
        }
        totalDiscount += (discountBase * discountBenefit.value) / 100;
      }
    }
    
    return totalDiscount;
  };
  // Кількість гостей для розрахунків (загальне поле «Кількість гостей» в КП)
  // Якщо guestCount не заповнено, беремо максимальне значення з форматів
  const peopleCountNum = guestCount 
    ? parseInt(guestCount, 10) || 0 
    : eventFormats.length > 0
      ? Math.max(...eventFormats.map(f => parseInt(f.peopleCount, 10) || 0), 0)
      : 0;
  const totalPrice = foodTotalPrice + equipmentTotal + serviceTotal;

  const handleApplyMenu = () => {
    if (!selectedMenuId) return;
    const menuIdNum = parseInt(selectedMenuId, 10);
    const menu = menus.find((m) => m.id === menuIdNum);
    if (!menu) {
      toast.error("Меню не знайдено");
      return;
    }

    if (!menu.items || menu.items.length === 0) {
      toast.error("У цьому меню немає страв");
      return;
    }

    // Додаємо/оновлюємо кількість порцій за меню
    setDishQuantities((prev) => {
      const updated = { ...prev };
      menu.items.forEach((mi) => {
        // Переконуємось, що ця страва доступна серед активних страв
        const exists = dishes.some((d) => d.id === mi.item_id);
        if (!exists) return;
        updated[mi.item_id] = (updated[mi.item_id] ?? 0) + mi.quantity;
      });
      return updated;
    });

    // Додаємо страви з меню до обраних
    setSelectedDishes((prev) => {
      const ids = new Set(prev);
      menu.items.forEach((mi) => {
        if (dishes.some((d) => d.id === mi.item_id)) {
          ids.add(mi.item_id);
        }
      });
      return Array.from(ids);
    });

    toast.success(`Меню "${menu.name}" додано до списку страв`);
  };

  const handleAdditionalItemChange = (
    type: "equipment" | "service",
    id: number,
    field: keyof Omit<AdditionalItem, "id">,
    value: string
  ) => {
    const updater =
      type === "equipment" ? setEquipmentItems : setServiceItems;
    updater((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === "name"
                  ? value
                  : Number.isNaN(parseFloat(value))
                  ? 0
                  : parseFloat(value),
            }
          : item
      )
    );
  };

  const handleAddAdditionalItem = (type: "equipment" | "service") => {
    const updater =
      type === "equipment" ? setEquipmentItems : setServiceItems;
    updater((items) => [
      ...items,
      {
        id: Date.now(),
        name: "",
        quantity: 0,
        unitPrice: 0,
      },
    ]);
  };

  const handleRemoveAdditionalItem = (type: "equipment" | "service", id: number) => {
    const updater =
      type === "equipment" ? setEquipmentItems : setServiceItems;
    updater((items) => items.filter((item) => item.id !== id));
  };

  const [creatingKP, setCreatingKP] = useState(false);

  // Функція для генерації PDF preview
  const handleGeneratePDFPreview = async () => {
    if (!selectedTemplateId) {
      toast.error("Будь ласка, оберіть шаблон КП");
      return;
    }

    setIsGeneratingPreview(true);
    try {
      // Спочатку створюємо КП якщо ще не створено
      let kpIdForPreview = createdKPId;
      
      if (!kpIdForPreview) {
        // Валідація перед створенням
        if (!validateStep1()) {
          setStep(1);
          setIsGeneratingPreview(false);
          return;
        }
        if (!validateStep2()) {
          setStep(2);
          setIsGeneratingPreview(false);
          return;
        }

        // Створюємо КП з усіма даними
        // Якщо guestCount порожній, беремо максимальне значення з форматів
        const peopleCountNumForPayload = guestCount 
          ? parseInt(guestCount, 10) || 0
          : eventFormats.length > 0
            ? Math.max(...eventFormats.map(f => parseInt(f.peopleCount, 10) || 0), 0)
            : 0;
        
        console.log("Creating KP for preview with data:", {
          guestCount,
          eventFormats: eventFormats.map(f => ({ name: f.name, peopleCount: f.peopleCount })),
          peopleCountNumForPayload,
          clientName,
          eventDate,
          selectedDishesCount: selectedDishes.length
        });
        const foodTotalPrice = getTotalPrice();
        const regularDishesPriceForPayload = getRegularDishesPrice();
        const customDishesPrice = foodTotalPrice - regularDishesPriceForPayload;
        const transportEquipmentTotalNum = parseFloat(transportEquipmentTotal || "0") || 0;
        const transportPersonnelTotalNum = parseFloat(transportPersonnelTotal || "0") || 0;
        const transportTotalNum = transportEquipmentTotalNum + transportPersonnelTotalNum;
        
        let discountAmount = calculateDiscountAmount();
        let finalFoodPrice = foodTotalPrice;
        let finalEquipmentTotal = equipmentTotal;
        let finalServiceTotal = serviceTotal;
        
        if (selectedDiscountId) {
          const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
          if (discountBenefit) {
            if (discountIncludeMenu) {
              const regularDishesDiscount = (regularDishesPriceForPayload * discountBenefit.value) / 100;
              finalFoodPrice = foodTotalPrice - regularDishesDiscount;
            }
            if (discountIncludeEquipment) {
              finalEquipmentTotal = equipmentTotal - (equipmentTotal * discountBenefit.value) / 100;
            }
            if (discountIncludeService) {
              finalServiceTotal = serviceTotal - (serviceTotal * discountBenefit.value) / 100;
            }
          }
        }
        
        let cashbackAmount = 0;
        const totalBeforeCashback = finalFoodPrice + finalEquipmentTotal + finalServiceTotal + transportTotalNum;
        if (selectedCashbackId) {
          const cashbackBenefit = benefits.find((b) => b.id === selectedCashbackId);
          if (cashbackBenefit) {
            cashbackAmount = (totalBeforeCashback * cashbackBenefit.value) / 100;
          }
        }
        
        const totalPrice = totalBeforeCashback - (useCashback ? cashbackAmount : 0);
        const title = clientName || `КП від ${new Date(eventDate || Date.now()).toLocaleDateString("uk-UA")}`;

        // Формуємо payload для страв
        const itemsPayload: Array<{ item_id: number; quantity: number; event_format_id?: number }> = [];
        const allSelectedDishIds = new Set<number>();
        eventFormats.forEach((format) => {
          format.selectedDishes.forEach((dishId) => allSelectedDishIds.add(dishId));
        });
        selectedDishes.forEach((dishId) => allSelectedDishIds.add(dishId));
        
        allSelectedDishIds.forEach((dishId) => {
          const dish = dishes.find((d) => d.id === dishId);
          if (dish && !isCustomDish(dish.id)) {
            itemsPayload.push({
              item_id: dish.id,
              quantity: dishQuantities[dish.id] || 1,
            });
          }
        });

        const kpData = {
          title,
          client_name: clientName || undefined,
          client_email: clientEmail || undefined,
          client_phone: clientPhone || undefined,
          people_count: peopleCountNumForPayload,
          menu_total: foodTotalPrice,
          equipment_total: equipmentTotal || undefined,
          service_total: serviceTotal || undefined,
          transport_total: transportTotalNum || undefined,
          transport_equipment_total: transportEquipmentTotalNum || undefined,
          transport_personnel_total: transportPersonnelTotalNum || undefined,
          discount_amount: discountAmount || undefined,
          discount_benefit_id: selectedDiscountId || undefined,
          cashback_benefit_id: selectedCashbackId || undefined,
          cashback_amount: useCashback ? cashbackAmount : undefined,
          cashback_earned: !useCashback ? cashbackAmount : undefined,
          total_amount: totalBeforeCashback,
          final_amount: totalPrice,
          total_price: totalPrice,
          template_id: selectedTemplateId,
          items: itemsPayload,
          event_date: eventDate || undefined,
          event_format: eventFormat || undefined,
          event_group: eventGroup || undefined,
          event_location: eventLocation || undefined,
          event_time: eventTime || undefined,
          coordinator_name: coordinatorName || undefined,
          coordinator_phone: coordinatorPhone || undefined,
          status: "draft",
        };

        const newKP = await kpApi.createKP(kpData);
        kpIdForPreview = newKP.id;
        setCreatedKPId(newKP.id);
        toast.success("КП створено для preview");
      }

      // Генеруємо PDF preview
      const pdfBlob = await kpApi.generateKPPDF(kpIdForPreview, selectedTemplateId);
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(pdfUrl);
      toast.success("PDF preview згенеровано");
    } catch (error: any) {
      console.error("Error generating PDF preview:", error);
      toast.error(error.message || "Помилка генерації PDF preview");
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleCreateKP = async () => {
    // Валідація всіх обов'язкових полів
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validateStep2()) {
      setStep(2);
      return;
    }
    if (!selectedTemplateId) {
      toast.error("Будь ласка, оберіть шаблон КП");
      setStep(7);
      return;
    }
    if (sendEmail && !clientEmail) {
      toast.error("Вкажіть email клієнта для відправки КП");
      setStep(1);
      return;
    }
    // Перевірка, що не можна використовувати знижку та кешбек разом
    if (selectedDiscountId && selectedCashbackId) {
      toast.error("Не можна використовувати знижку та кешбек разом");
      setStep(7);
      return;
    }

  // Якщо guestCount порожній, беремо максимальне значення з форматів
  const peopleCountNumForPayload = guestCount 
    ? parseInt(guestCount, 10) || 0
    : eventFormats.length > 0
      ? Math.max(...eventFormats.map(f => parseInt(f.peopleCount, 10) || 0), 0)
      : 0;
  const foodTotalPrice = getTotalPrice();
  const regularDishesPriceForPayload = getRegularDishesPrice(); // Тільки звичайні страви
  const customDishesPrice = foodTotalPrice - regularDishesPriceForPayload; // Ціна кастомних страв
  const transportEquipmentTotalNum = parseFloat(transportEquipmentTotal || "0") || 0;
  const transportPersonnelTotalNum = parseFloat(transportPersonnelTotal || "0") || 0;
  const transportTotalNum = transportEquipmentTotalNum + transportPersonnelTotalNum;
    
    // Розрахунок знижки з урахуванням вибраних опцій
    let discountAmount = calculateDiscountAmount();
    
    // Розраховуємо фінальні ціни з урахуванням знижки
    // Знижка застосовується тільки до звичайних страв, кастомні страви не враховуються
    let finalFoodPrice = foodTotalPrice;
    let finalEquipmentTotal = equipmentTotal;
    let finalServiceTotal = serviceTotal;
    
    if (selectedDiscountId) {
      const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
      if (discountBenefit) {
        if (discountIncludeMenu) {
          // Знижка тільки на звичайні страви
          const regularDishesDiscount = (regularDishesPriceForPayload * discountBenefit.value) / 100;
          finalFoodPrice = foodTotalPrice - regularDishesDiscount;
        }
        if (discountIncludeEquipment) {
          finalEquipmentTotal = equipmentTotal - (equipmentTotal * discountBenefit.value) / 100;
        }
        if (discountIncludeService) {
          finalServiceTotal = serviceTotal - (serviceTotal * discountBenefit.value) / 100;
        }
      }
    }
    
    // Розрахунок кешбеку (від загальної суми після знижки)
    let cashbackAmount = 0;
    const totalBeforeCashback = finalFoodPrice + finalEquipmentTotal + finalServiceTotal + transportTotalNum;
    if (selectedCashbackId) {
      const cashbackBenefit = benefits.find((b) => b.id === selectedCashbackId);
      if (cashbackBenefit) {
        cashbackAmount = (totalBeforeCashback * cashbackBenefit.value) / 100;
      }
    }
    
    const totalPrice = totalBeforeCashback - (useCashback ? cashbackAmount : 0);
    const title =
      clientName ||
      `КП від ${new Date(eventDate || Date.now()).toLocaleDateString("uk-UA")}`;

    // Формуємо payload для страв
    // Примітка: event_format_id буде встановлено після створення КП та форматів на бекенді
    const itemsPayload: Array<{ item_id: number; quantity: number; event_format_id?: number }> = [];
    
    // Збираємо всі унікальні страви з форматів та загального вибору
    const allSelectedDishIds = new Set<number>();
    eventFormats.forEach((format) => {
      format.selectedDishes.forEach((dishId) => allSelectedDishIds.add(dishId));
    });
    // Додаємо страви з загального вибору
    selectedDishes.forEach((dishId) => allSelectedDishIds.add(dishId));
    
    // Формуємо payload для всіх обраних страв
    allSelectedDishIds.forEach((dishId) => {
      const dish = dishes.find((d) => d.id === dishId);
      if (dish && !isCustomDish(dish.id)) {
        itemsPayload.push({
          item_id: dish.id,
          quantity: dishQuantities[dish.id] || 1,
          // event_format_id буде встановлено після створення форматів на бекенді
        });
      }
    });

    setCreatingKP(true);
    try {
      const kpData = {
        title,
        people_count: peopleCountNumForPayload,
        // Основна група / формат для шапки КП: беремо з полів форми (як і раніше),
        // а формати заходу нижче використовуємо лише для деталізації меню в PDF.
        event_group: eventGroup || undefined,
        client_name: clientName || undefined,
        event_format:
          eventFormat ||
          eventFormats[0]?.name ||
          undefined,
        event_date: eventDate ? new Date(eventDate).toISOString() : undefined,
        event_location: eventLocation || undefined,
        event_time: eventTime || undefined,
        coordinator_name: coordinatorName || undefined,
        coordinator_phone: coordinatorPhone || undefined,
        total_price: totalPrice,
        price_per_person:
          peopleCountNumForPayload > 0
            ? totalPrice / peopleCountNumForPayload
            : undefined,
        items: itemsPayload,
        template_id: selectedTemplateId || undefined,
        client_email: clientEmail || undefined,
        send_email: sendEmail,
        email_message: emailMessage || undefined,
        client_phone: clientPhone || undefined,
        send_telegram: sendTelegram,
        telegram_message: telegramMessage || undefined,
        equipment_total: finalEquipmentTotal || undefined,
        service_total: finalServiceTotal || undefined,
        transport_total: transportTotalNum || undefined,
        total_weight: getTotalWeight() > 0 ? getTotalWeight() : undefined,
        weight_per_person: getWeightPerPerson() > 0 ? getWeightPerPerson() : undefined,
        discount_id: selectedDiscountId || undefined, // Deprecated, для сумісності
        cashback_id: selectedCashbackId || undefined,
        use_cashback: useCashback,
        discount_amount: discountAmount > 0 ? discountAmount : undefined,
        cashback_amount: cashbackAmount > 0 ? cashbackAmount : undefined,
        discount_include_menu: discountIncludeMenu, // Deprecated
        discount_include_equipment: discountIncludeEquipment, // Deprecated
        discount_include_service: discountIncludeService, // Deprecated
        discount_menu_id: discountMenuId || undefined,
        discount_equipment_id: discountEquipmentId || undefined,
        discount_service_id: discountServiceId || undefined,
        discount_equipment_subcategories: Object.keys(discountEquipmentSubcategories).length > 0 
          ? Object.fromEntries(
              Object.entries(discountEquipmentSubcategories).map(([k, v]) => [String(k), v])
            )
          : undefined,
        event_formats:
          eventFormats.length > 0
            ? eventFormats.map((f, index) => ({
                name: f.name || `Формат ${index + 1}`,
                event_time: f.eventTime || undefined,
                people_count: f.peopleCount ? parseInt(f.peopleCount, 10) || undefined : undefined,
                order_index: index,
              }))
            : undefined,
      };

      let kp;
      if (kpId) {
        // Редагування існуючого КП
        kp = await kpApi.updateKP(kpId, kpData);
        toast.success(
          sendEmail || sendTelegram
            ? "КП оновлено та відправлено клієнту"
            : "КП оновлено успішно"
        );
      } else {
        // Створення нового КП
        kp = await kpApi.createKP(kpData);
        toast.success(
          sendEmail || sendTelegram
            ? "КП створено та відправлено клієнту"
            : "КП створено успішно"
        );
      }

      // Відкриваємо PDF у новій вкладці для перегляду
      try {
        const blob = await kpApi.generateKPPDF(kp.id, selectedTemplateId || undefined);
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } catch (pdfError) {
        console.error("Помилка генерації PDF:", pdfError);
      }

      // Якщо є onClose callback (для редагування), викликаємо його
      if (onClose) {
        onClose();
      }

      // Reset form
      localStorage.removeItem('kp_form_data');
      setStep(1);
      setSelectedDishes([]);
      setSelectedTemplateId(null);
      setClientName("");
      setEventGroup("");
      setEventFormat("");
      setEventDate("");
      setEventTime("");
      setGuestCount("");
      setEventLocation("");
      setClientEmail("");
      setClientPhone("");
      setCoordinatorName("");
      setCoordinatorPhone("");
      setSendEmail(false);
      setEmailMessage("");
      setSendTelegram(false);
      setTelegramMessage("");
      setDishQuantities({});
      setEquipmentItems([]);
      setServiceItems([]);
      setTransportEquipmentTotal("");
      setTransportPersonnelTotal("");
      setEquipmentLossOrBreakagePrice("");
      setCustomDishes([]);
      setDishOverrides({});
      setCustomDishIdCounter(-1);
      setActiveFormatId(null);
    } catch (error: any) {
      console.error("Error creating KP:", error);
      toast.error(
        error?.data?.detail || error?.message || "Помилка створення КП"
      );
    } finally {
      setCreatingKP(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl text-gray-900 mb-2">
          {kpId ? "Редагувати КП" : "Створити КП"}
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          {kpId ? "Редагування комерційної пропозиції" : "Створення нової комерційної пропозиції для клієнта"}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 md:gap-4 overflow-x-auto pb-2">
        {[
          { num: 1, label: "Дані клієнта та заходу" },
          { num: 2, label: "Вибір страв" },
          { num: 3, label: "Прорахунок обладнання" },
          { num: 4, label: "Прорахунок обслуговування" },
          { num: 5, label: "Конструктор" },
          { num: 6, label: "Прев'ю КП" },
          { num: 7, label: "Шаблон та відправка" },
        ].map((s, idx, arr) => (
          <div key={s.num} className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm cursor-pointer transition-all ${
                step >= s.num
                  ? "bg-[#FF5A00] text-white hover:bg-[#FF5A00]/90"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
              }`}
              onClick={() => goToStep(s.num)}
              title={`Перейти до кроку ${s.num}: ${s.label}`}
            >
              {s.num}
            </div>
            <span
              className={`text-xs md:text-sm whitespace-nowrap cursor-pointer ${
                step >= s.num ? "text-gray-900" : "text-gray-600"
              }`}
              onClick={() => goToStep(s.num)}
            >
              {s.label}
            </span>
            </div>
            {idx < arr.length - 1 && (
              <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Client Data */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Крок 1: Дані клієнта та заходу</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 md:space-y-6">
              {/* Вибір типу: Бокс або Кейтеринг */}
              <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Label className="text-base font-semibold">
                  Тип послуги <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="type-boxes"
                      checked={eventGroup === "delivery-boxes"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEventGroup("delivery-boxes");
                          setStep1Errors((prev) => ({ ...prev, eventGroup: undefined }));
                          // Очищаємо формати, якщо вони не відповідають новому типу
                          setEventFormats((prev) => 
                            prev.filter(f => f.group === "delivery-boxes" || !f.group).map((f, idx) => ({
                              ...f,
                              id: idx,
                              group: f.group || "delivery-boxes",
                            }))
                          );
                        } else if (eventGroup === "delivery-boxes") {
                          // Якщо знімаємо вибір, очищаємо eventGroup
                          setEventGroup("");
                        }
                      }}
                    />
                    <Label htmlFor="type-boxes" className="cursor-pointer font-medium">
                      Доставка боксів
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="type-catering"
                      checked={eventGroup === "catering"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEventGroup("catering");
                          setStep1Errors((prev) => ({ ...prev, eventGroup: undefined }));
                          // Очищаємо формати, якщо вони не відповідають новому типу
                          setEventFormats((prev) => 
                            prev.filter(f => f.group === "catering" || !f.group).map((f, idx) => ({
                              ...f,
                              id: idx,
                              group: f.group || "catering",
                            }))
                          );
                        } else if (eventGroup === "catering") {
                          // Якщо знімаємо вибір, очищаємо eventGroup
                          setEventGroup("");
                        }
                      }}
                    />
                    <Label htmlFor="type-catering" className="cursor-pointer font-medium">
                      Кейтерінг
                    </Label>
                  </div>
                </div>
                {step1Errors.eventGroup && (
                  <p className="text-xs text-red-600">{step1Errors.eventGroup}</p>
                )}
              </div>

              {/* Вибір між новим та існуючим клієнтом */}
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                <Label>Оберіть клієнта</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="new-client"
                      checked={clientSelectionMode === "new"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setClientSelectionMode("new");
                          setSelectedClientId(null);
                          // Очищаємо поля при переключенні на новий клієнт
                          setClientName("");
                          setClientEmail("");
                          setClientPhone("");
                        }
                      }}
                    />
                    <Label htmlFor="new-client" className="cursor-pointer">
                      Новий клієнт
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="existing-client"
                      checked={clientSelectionMode === "existing"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setClientSelectionMode("existing");
                        }
                      }}
                    />
                    <Label htmlFor="existing-client" className="cursor-pointer">
                      Обрати існуючого клієнта
                    </Label>
                  </div>
                </div>
              </div>

              {/* Вибір існуючого клієнта */}
              {clientSelectionMode === "existing" && (
                <div className="space-y-2">
                  <Label htmlFor="select-client">
                    Оберіть клієнта <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={selectedClientId?.toString() || ""}
                    onValueChange={(value) => {
                      const clientId = parseInt(value);
                      setSelectedClientId(clientId);
                      setStep1Errors((prev) => ({ ...prev, selectedClient: undefined }));

                      const client = clients.find((c) => c.id === clientId);
                      if (client) {
                        setClientName(client.name || "");
                        setClientEmail(client.email || "");
                        setClientPhone(client.phone || "");
                        // Заповнюємо дані заходу, якщо вони є
                        if (client.event_date) {
                          const date = new Date(client.event_date);
                          setEventDate(date.toISOString().split("T")[0]);
                        }
                        if (client.event_format) {
                          setEventFormat(client.event_format);
                        }
                        if (client.event_location) {
                          setEventLocation(client.event_location);
                        }

                        // Завантажуємо всі чеклісти та анкети клієнта
                        loadClientChecklists(clientId);
                        loadClientQuestionnaires(clientId);
                      }
                    }}
                  >
                    <SelectTrigger
                      id="select-client"
                      className={`h-10 ${
                        step1Errors.selectedClient
                          ? "border-red-500 focus-visible:ring-red-500"
                          : ""
                      }`}
                    >
                      <SelectValue placeholder="Оберіть клієнта зі списку" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.name} {client.phone ? `(${client.phone})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {step1Errors.selectedClient && (
                    <p className="text-xs text-red-600">{step1Errors.selectedClient}</p>
                  )}
                </div>
              )}

              {/* Вибір чекліста або анкети клієнта для автозаповнення КП */}
              {clientSelectionMode === "existing" && selectedClientId && (
                <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Clipboard className="w-4 h-4 text-blue-600" />
                      Оберіть чекліст клієнта
                    </Label>
                    {(Object.keys(checklistAutofill).length > 0 || Object.keys(questionnaireAutofill).length > 0) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          clearChecklistData();
                          setSelectedQuestionnaireId(null);
                          setQuestionnaireAutofill({});
                        }}
                      >
                        Очистити дані
                      </Button>
                    )}
                  </div>

                  {clientChecklists.length === 0 && clientQuestionnaires.length === 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600">
                        У цього клієнта ще немає чеклістів або анкет.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Вибір чекліста (пріоритет) */}
                      {clientChecklists.length > 0 && (
                        <Select
                          value={selectedChecklistId?.toString() || ""}
                          onValueChange={(value) => {
                            const clId = parseInt(value, 10);
                            const cl = clientChecklists.find((c) => c.id === clId) || null;
                            applyChecklistToKP(cl);
                          }}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Оберіть чекліст клієнта" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientChecklists.map((cl) => {
                              const dateLabel = cl.event_date || cl.created_at || "";
                              const formattedDate = dateLabel
                                ? new Date(dateLabel).toLocaleDateString("uk-UA", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric"
                                  })
                                : "";
                              const typeLabel = cl.checklist_type === "box" ? "🎁 Бокси" : "🍽️ Кейтеринг";
                              const eventFormat = cl.event_format || "";
                              const guestCount = cl.guest_count ? `${cl.guest_count} гостей` : "";
                              return (
                                <SelectItem key={cl.id} value={cl.id.toString()}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {typeLabel} {formattedDate ? `від ${formattedDate}` : `#${cl.id}`}
                                    </span>
                                    {(eventFormat || guestCount) && (
                                      <span className="text-xs text-gray-500">
                                        {eventFormat && guestCount ? `${eventFormat}, ${guestCount}` : eventFormat || guestCount}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {/* Fallback на анкети якщо немає чеклістів */}
                      {clientChecklists.length === 0 && clientQuestionnaires.length > 0 && (
                        <>
                          <p className="text-xs text-amber-600 mb-2">
                            💡 Немає чеклістів - використовуємо анкети
                          </p>
                          <Select
                            value={selectedQuestionnaireId?.toString() || ""}
                            onValueChange={(value) => {
                              const qId = parseInt(value, 10);
                              const q = clientQuestionnaires.find((qq) => qq.id === qId) || null;
                              applyQuestionnaireToKP(q);
                            }}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Оберіть анкету клієнта" />
                            </SelectTrigger>
                            <SelectContent>
                              {clientQuestionnaires.map((q) => {
                                const dateLabel = q.event_date || q.created_at || "";
                                const formattedDate = dateLabel
                                  ? new Date(dateLabel).toLocaleDateString("uk-UA", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric"
                                    })
                                  : "";
                                const eventType = q.event_type || "";
                                const guestCount = q.guest_count ? `${q.guest_count} гостей` : "";
                                return (
                                  <SelectItem key={q.id} value={q.id.toString()}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {formattedDate ? `Анкета від ${formattedDate}` : `Анкета #${q.id}`}
                                      </span>
                                      {(eventType || guestCount) && (
                                        <span className="text-xs text-gray-500">
                                          {eventType && guestCount ? `${eventType}, ${guestCount}` : eventType || guestCount}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                      
                      {selectedChecklistId && (
                        <p className="text-xs text-emerald-700 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Дані з чекліста будуть автоматично заповнені у відповідних полях
                        </p>
                      )}
                      {selectedQuestionnaireId && !selectedChecklistId && (
                        <p className="text-xs text-emerald-700 flex items-center gap-1">
                          <Clipboard className="w-3 h-3" />
                          Дані з анкети будуть автоматично заповнені у відповідних полях
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client-name">
                    Ім'я клієнта <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="client-name"
                    placeholder="ТОВ 'Компанія' або Іван Петренко"
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      if (step1Errors.clientName) {
                        setStep1Errors((prev) => ({ ...prev, clientName: undefined }));
                      }
                    }}
                    aria-invalid={!!step1Errors.clientName}
                    disabled={clientSelectionMode === "existing" && !selectedClientId}
                  />
                  {step1Errors.clientName && (
                    <p className="text-xs text-red-600">{step1Errors.clientName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  {/* Старий блок з групою/форматом прибрано, залишаємо лише багатоформатний редактор нижче */}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="event-date">
                      Дата події <span className="text-red-500">*</span>
                    </Label>
                    {questionnaireAutofill.eventDate && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs px-2 py-0 flex items-center gap-1">
                        <Clipboard className="w-3 h-3" />
                        З анкети
                      </Badge>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="event-date"
                      type="date"
                      value={eventDate}
                      onChange={(e) => {
                        setEventDate(e.target.value);
                        if (step1Errors.eventDate) {
                          setStep1Errors((prev) => ({ ...prev, eventDate: undefined }));
                        }
                        // Видаляємо індикатор якщо користувач змінює значення
                        if (questionnaireAutofill.eventDate) {
                          const newAutofill = { ...questionnaireAutofill };
                          delete newAutofill.eventDate;
                          setQuestionnaireAutofill(newAutofill);
                        }
                      }}
                      aria-invalid={!!step1Errors.eventDate}
                      className={`${
                        questionnaireAutofill.eventDate
                          ? "!border-emerald-400 !bg-emerald-50"
                          : ""
                      }`}
                    />
                    {questionnaireAutofill.eventDate && (
                      <Clipboard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 pointer-events-none" />
                    )}
                  </div>
                  {step1Errors.eventDate && (
                    <p className="text-xs text-red-600">{step1Errors.eventDate}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="event-time">Час події</Label>
                    {questionnaireAutofill.eventTime && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs px-2 py-0 flex items-center gap-1">
                        <Clipboard className="w-3 h-3" />
                        З анкети
                      </Badge>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="event-time"
                      placeholder="17:00–19:00"
                      value={eventTime}
                      onChange={(e) => {
                        setEventTime(e.target.value);
                        // Видаляємо індикатор якщо користувач змінює значення
                        if (questionnaireAutofill.eventTime) {
                          const newAutofill = { ...questionnaireAutofill };
                          delete newAutofill.eventTime;
                          setQuestionnaireAutofill(newAutofill);
                        }
                      }}
                      className={`${
                        questionnaireAutofill.eventTime
                          ? "!border-emerald-400 !bg-emerald-50 pr-8"
                          : ""
                      }`}
                    />
                    {questionnaireAutofill.eventTime && (
                      <Clipboard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 pointer-events-none" />
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Поле "Кількість гостей" під форматами прибрали — кількість рахуємо з сумарних гостей у форматах */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="event-location">Місце проведення</Label>
                    {questionnaireAutofill.eventLocation && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs px-2 py-0 flex items-center gap-1">
                        <Clipboard className="w-3 h-3" />
                        З анкети
                      </Badge>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="event-location"
                      placeholder="м. Київ, вул. Короленківська 4"
                      value={eventLocation}
                      onChange={(e) => {
                        setEventLocation(e.target.value);
                        // Видаляємо індикатор якщо користувач змінює значення
                        if (questionnaireAutofill.eventLocation) {
                          const newAutofill = { ...questionnaireAutofill };
                          delete newAutofill.eventLocation;
                          setQuestionnaireAutofill(newAutofill);
                        }
                      }}
                      className={`${
                        questionnaireAutofill.eventLocation
                          ? "!border-emerald-400 !bg-emerald-50 pr-8"
                          : ""
                      }`}
                    />
                    {questionnaireAutofill.eventLocation && (
                      <Clipboard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  {questionnaireAutofill.eventLocation && (
                    <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                      Дані з анкети{" "}
                      {questionnaireAutofill.eventLocation.questionnaireDate && (
                        <>
                          від{" "}
                          {new Date(
                            questionnaireAutofill.eventLocation.questionnaireDate
                          ).toLocaleDateString("uk-UA")}
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client-email">Email клієнта</Label>
                  <Input
                    id="client-email"
                    type="email"
                    placeholder="client@example.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-phone">Телефон клієнта (Telegram)</Label>
                  <Input
                    id="client-phone"
                    type="tel"
                    placeholder="+380..."
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="coordinator-name">Координатор</Label>
                    {questionnaireAutofill.coordinatorName && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs px-2 py-0 flex items-center gap-1">
                        <Clipboard className="w-3 h-3" />
                        З анкети
                      </Badge>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="coordinator-name"
                      placeholder="Ім'я координатора"
                      value={coordinatorName}
                      onChange={(e) => {
                        setCoordinatorName(e.target.value);
                        // Видаляємо індикатор якщо користувач змінює значення
                        if (questionnaireAutofill.coordinatorName) {
                          const newAutofill = { ...questionnaireAutofill };
                          delete newAutofill.coordinatorName;
                          setQuestionnaireAutofill(newAutofill);
                        }
                      }}
                      className={`${
                        questionnaireAutofill.coordinatorName
                          ? "!border-emerald-400 !bg-emerald-50 pr-8"
                          : ""
                      }`}
                    />
                    {questionnaireAutofill.coordinatorName && (
                      <Clipboard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  {questionnaireAutofill.coordinatorName && (
                    <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                      Дані з анкети{" "}
                      {questionnaireAutofill.coordinatorName.questionnaireDate && (
                        <>
                          від{" "}
                          {new Date(
                            questionnaireAutofill.coordinatorName.questionnaireDate
                          ).toLocaleDateString("uk-UA")}
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="coordinator-phone">Телефон координатора</Label>
                    {questionnaireAutofill.coordinatorPhone && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs px-2 py-0 flex items-center gap-1">
                        <Clipboard className="w-3 h-3" />
                        З анкети
                      </Badge>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="coordinator-phone"
                      type="tel"
                      placeholder="+380..."
                      value={coordinatorPhone}
                      onChange={(e) => {
                        setCoordinatorPhone(e.target.value);
                        // Видаляємо індикатор якщо користувач змінює значення
                        if (questionnaireAutofill.coordinatorPhone) {
                          const newAutofill = { ...questionnaireAutofill };
                          delete newAutofill.coordinatorPhone;
                          setQuestionnaireAutofill(newAutofill);
                        }
                      }}
                      className={`${
                        questionnaireAutofill.coordinatorPhone
                          ? "!border-emerald-400 !bg-emerald-50 pr-8"
                          : ""
                      }`}
                    />
                    {questionnaireAutofill.coordinatorPhone && (
                      <Clipboard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  {questionnaireAutofill.coordinatorPhone && (
                    <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                      Дані з анкети{" "}
                      {questionnaireAutofill.coordinatorPhone.questionnaireDate && (
                        <>
                          від{" "}
                          {new Date(
                            questionnaireAutofill.coordinatorPhone.questionnaireDate
                          ).toLocaleDateString("uk-UA")}
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Відправка email</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Checkbox
                      id="send-email"
                      checked={sendEmail}
                      onCheckedChange={(checked) => setSendEmail(!!checked)}
                    />
                    <Label
                      htmlFor="send-email"
                      className="text-sm text-gray-700"
                    >
                      Автоматично відправити КП на email клієнта
                    </Label>
                  </div>
                  {sendEmail && (
                    <div className="space-y-2 mt-2">
                      <Label htmlFor="email-message">
                        Супровідний текст листа
                      </Label>
                      <textarea
                        id="email-message"
                        className="w-full px-3 py-2 border rounded-md min-h-[80px] text-sm"
                        placeholder="Напишіть коротке повідомлення для клієнта..."
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Відправка в Telegram</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Checkbox
                      id="send-telegram"
                      checked={sendTelegram}
                      onCheckedChange={(checked) =>
                        setSendTelegram(!!checked)
                      }
                    />
                    <Label
                      htmlFor="send-telegram"
                      className="text-sm text-gray-700"
                    >
                      Автоматично відправити КП в Telegram
                    </Label>
                  </div>
                  {sendTelegram && (
                    <div className="space-y-2 mt-2">
                      <Label htmlFor="telegram-message">
                        Повідомлення в Telegram
                      </Label>
                      <textarea
                        id="telegram-message"
                        className="w-full px-3 py-2 border rounded-md min-h-[80px] text-sm"
                        placeholder="Коротке повідомлення, яке побачить клієнт в Telegram..."
                        value={telegramMessage}
                        onChange={(e) => setTelegramMessage(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => goToStep(2)}
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 w-full md:w-auto"
                  disabled={!isStep1Valid()}
                >
                  Далі: Вибір страв
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Dishes, Equipment, Service */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Крок 2: Виберіть страви, обладнання та обслуговування</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Швидкий вибір форматів заходу */}
              {eventGroup && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <Label className="text-sm font-semibold mb-3 block">Формат заходу</Label>
                  <div className="flex flex-wrap gap-2">
                    {(eventGroup === "delivery-boxes" ? BOX_FORMAT_OPTIONS : CATERING_FORMAT_OPTIONS).map((formatValue) => {
                      const format = { label: formatValue, value: formatValue };
                    const isSelected = eventFormats.some((f) => f.name === format.value);
                    return (
                      <Button
                        key={format.value}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={`h-9 text-sm ${
                          isSelected
                            ? "bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white"
                            : "bg-white hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            // Видаляємо формат якщо вже вибраний
                            setEventFormats((prev) =>
                              prev.filter((f) => f.name !== format.value)
                            );
                          } else {
                            // Додаємо новий формат з правильною групою
                            setEventFormats((prev) => [
                              ...prev,
                              {
                                id: prev.length > 0 ? Math.max(...prev.map((f) => f.id)) + 1 : 0,
                                name: format.value,
                                eventTime: eventTime || "",
                                peopleCount: guestCount || "",
                                group: eventGroup,
                                selectedDishes: [],
                              },
                            ]);
                          }
                        }}
                      >
                        {formatValue}
                        {isSelected && <X className="w-3 h-3 ml-1" />}
                      </Button>
                    );
                    })}
                  </div>
                  {eventFormats.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Обрані формати: {eventFormats.map((f) => f.name).join(", ")}
                    </p>
                  )}
                </div>
              )}

              <Tabs defaultValue="dishes" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dishes">Страви</TabsTrigger>
                  <TabsTrigger value="equipment">Обладнання</TabsTrigger>
                  <TabsTrigger value="service">Обслуговування</TabsTrigger>
                </TabsList>
                
                {/* Tab: Страви */}
                <TabsContent value="dishes" className="mt-4">
              {loading ? (
                <div className="py-12 text-center">
                  <Loader2 className="h-12 w-12 text-[#FF5A00] animate-spin mx-auto mb-4" />
                  <p className="text-gray-500">Завантаження страв...</p>
                </div>
              ) : dishes.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl text-gray-900 mb-2">
                    Немає активних страв
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Додайте страви в розділі "Меню / Страви"
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Формати заходу з таймінгами */}
                  <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Формати заходу та таймінг
                        </p>
                        <p className="text-xs text-gray-500">
                          Додайте формати заходу (наприклад, Welcome drink, Фуршет) з таймінгами та оберіть страви для кожного формату.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEventFormats((prev) => [
                            ...prev,
                            {
                              id: prev.length,
                              name: eventFormat || `Формат ${prev.length + 1}`,
                              eventTime: eventTime || "",
                              peopleCount: guestCount || "",
                              group: eventGroup || "",
                              selectedDishes: [],
                            },
                          ]);
                        }}
                        disabled={!eventGroup}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Додати формат
                      </Button>
                    </div>

                    {eventFormats.length > 0 && (
                      <div className="space-y-3">
                        {eventFormats.map((format) => (
                          <div
                            key={format.id}
                            className="p-4 bg-white rounded-lg border border-gray-200"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end mb-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-600">Назва формату</Label>
                                <Input
                                  value={format.name}
                                  list="event-format-options"
                                  onChange={(e) =>
                                    setEventFormats((prev) =>
                                      prev.map((f) =>
                                        f.id === format.id ? { ...f, name: e.target.value } : f
                                      )
                                    )
                                  }
                                  placeholder="Welcome drink / Фуршет"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-600">Таймінг</Label>
                                <Input
                                  value={format.eventTime}
                                  onChange={(e) =>
                                    setEventFormats((prev) =>
                                      prev.map((f) =>
                                        f.id === format.id ? { ...f, eventTime: e.target.value } : f
                                      )
                                    )
                                  }
                                  placeholder="09:00–11:00"
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-600">К-сть гостей</Label>
                                <Input
                                  type="number"
                                  value={format.peopleCount}
                                  onChange={(e) =>
                                    setEventFormats((prev) =>
                                      prev.map((f) =>
                                        f.id === format.id ? { ...f, peopleCount: e.target.value } : f
                                      )
                                    )
                                  }
                                  placeholder={guestCount || "50"}
                                  className="h-9"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-600">Група формату</Label>
                                <div className="text-xs text-gray-600 px-2 py-1.5 bg-gray-50 rounded border">
                                  {eventGroup === "delivery-boxes" ? "Доставка боксів" : eventGroup === "catering" ? "Кейтерінг" : "—"}
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setEventFormats((prev) =>
                                      prev.filter((f) => f.id !== format.id).map((f, idx) => ({
                                        ...f,
                                        id: idx,
                                        selectedDishes: f.selectedDishes || [],
                                      }))
                                    )
                                  }
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t">
                              <Label className="text-xs text-gray-600 mb-2 block">
                                Обрані страви для формату "{format.name}": {format.selectedDishes.length}
                              </Label>
                              {format.selectedDishes.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {format.selectedDishes.map((dishId) => {
                                    const dish = dishes.find((d) => d.id === dishId);
                                    if (!dish) return null;
                                    return (
                                      <Badge
                                        key={dishId}
                                        variant="outline"
                                        className="bg-[#FF5A00]/10 border-[#FF5A00] text-[#FF5A00]"
                                      >
                                        {dish.name}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEventFormats((prev) =>
                                              prev.map((f) =>
                                                f.id === format.id
                                                  ? { ...f, selectedDishes: f.selectedDishes.filter((id) => id !== dishId) }
                                                  : f
                                              )
                                            );
                                          }}
                                          className="ml-2 hover:text-red-600"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </Badge>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {/* Datalist з популярними форматами для підказки */}
                        <datalist id="event-format-options">
                          {(eventGroup === "delivery-boxes" ? BOX_FORMAT_OPTIONS : eventGroup === "catering" ? CATERING_FORMAT_OPTIONS : EVENT_FORMAT_OPTIONS).map((option) => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                      </div>
                    )}
                  </div>
                  {/* Ready menus selector */}
                  {menus.length > 0 && (
                    <div className="flex flex-col md:flex-row gap-3 md:items-end">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="ready-menu">Додати готове меню</Label>
                        <select
                          id="ready-menu"
                          className="w-full border rounded-md px-3 py-2 text-sm"
                          value={selectedMenuId}
                          onChange={(e) => setSelectedMenuId(e.target.value)}
                        >
                          <option value="">Оберіть меню</option>
                          {menus.map((menu) => (
                            <option key={menu.id} value={menu.id}>
                              {menu.name}
                              {menu.people_count
                                ? ` • ${menu.people_count} гостей`
                                : ""}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500">
                          Після вибору меню всі його страви з кількостями будуть додані до списку нижче. 
                          Ви зможете додатково змінити порції на наступному кроці «Конструктор».
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full md:w-auto"
                        disabled={!selectedMenuId}
                        onClick={handleApplyMenu}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Додати меню
                      </Button>
                    </div>
                  )}

                  {/* Активний формат для вибору страв */}
                  {eventFormats.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium text-gray-900 mb-1 block">
                            Оберіть формат для вибору страв:
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={activeFormatId === null ? "default" : "outline"}
                              size="sm"
                              onClick={() => setActiveFormatId(null)}
                              className={activeFormatId === null ? "bg-[#FF5A00] hover:bg-[#FF5A00]/90" : ""}
                            >
                              Загальний вибір
                            </Button>
                            {eventFormats.map((format) => (
                              <Button
                                key={format.id}
                                type="button"
                                variant={activeFormatId === format.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActiveFormatId(format.id)}
                                className={activeFormatId === format.id ? "bg-[#FF5A00] hover:bg-[#FF5A00]/90" : ""}
                              >
                                {format.name} {format.eventTime && `(${format.eventTime})`}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {activeFormatId !== null && (
                        <p className="text-xs text-gray-600 mt-2">
                          Страви будуть додані до формату "{eventFormats.find((f) => f.id === activeFormatId)?.name}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Пошук страв..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Tag filters */}
                  {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-sm text-gray-600 py-1">Категорії:</span>
                      {allTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant={selectedTags.includes(tag) ? "default" : "outline"}
                          className={`cursor-pointer ${
                            selectedTags.includes(tag)
                              ? "bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                              : "hover:bg-gray-100"
                          }`}
                          onClick={() => toggleTag(tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Dishes Grid */}
                  {filteredDishes.length === 0 ? (
                    <div className="py-12 text-center">
                      <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">
                        Не знайдено страв за вашим запитом
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6 max-h-[500px] overflow-y-auto p-1">
                      {sortedCategories.map((category) => {
                        const categoryDishes = dishesByCategory[category];
                        if (!categoryDishes || categoryDishes.length === 0) return null;
                        
                        return (
                          <div key={category} className="space-y-3">
                            <h3 className="text-lg font-semibold text-gray-900 border-b-2 border-[#FF5A00] pb-2">
                              {category}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {categoryDishes.map((dish) => {
                                const isSelected = selectedDishes.includes(dish.id);
                                const isSelectedForFormat = activeFormatId !== null 
                                  ? eventFormats.find((f) => f.id === activeFormatId)?.selectedDishes.includes(dish.id) || false
                                  : false;
                                return (
                                  <div
                                    key={dish.id}
                                    onClick={() => toggleDish(dish.id)}
                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                      isSelectedForFormat
                                        ? "border-blue-500 bg-blue-50"
                                        : isSelected
                                        ? "border-[#FF5A00] bg-[#FF5A00]/5"
                                        : "border-gray-200 hover:border-gray-300"
                                    }`}
                                  >
                                    <div className="flex gap-4">
                                      <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-50 flex items-center justify-center">
                                        {dish.photo_url ? (
                                          <img
                                            src={getImageUrl(dish.photo_url) || ""}
                                            alt={dish.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).style.display = "none";
                                            }}
                                          />
                                        ) : (
                                          <span className="text-[10px] text-gray-400 text-center px-1">
                                            Нема фото
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                          <h4 className="text-gray-900 truncate">{dish.name}</h4>
                                          <Checkbox checked={isSelectedForFormat || isSelected} />
                                        </div>
                                        {isSelectedForFormat && activeFormatId !== null && (
                                          <Badge variant="outline" className="text-xs mb-1 bg-blue-100 border-blue-300 text-blue-700">
                                            {eventFormats.find((f) => f.id === activeFormatId)?.name}
                                          </Badge>
                                        )}
                                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                          {dish.description}
                                        </p>
                                        <div className="flex items-center justify-between">
                                          <div className="text-sm text-gray-600">
                                            {dish.weight ? `${dish.weight}${dish.unit}` : '-'}
                                          </div>
                                          <div className="text-gray-900">{dish.price} грн</div>
                                        </div>
                                        {dish.subcategory && (
                                          <Badge variant="outline" className="mt-2 text-xs">
                                            {dish.subcategory}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Selected Summary */}
                  {selectedDishes.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-900">
                          Обрано страв: {selectedDishes.length}
                        </span>
                        <span className="text-gray-900">
                          Всього: {getTotalPrice()} грн
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
                </TabsContent>

                {/* Tab: Обладнання */}
                <TabsContent value="equipment" className="mt-4">
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Додайте все необхідне обладнання для заходу (столи, посуд, текстиль тощо).
                    </p>
                    <div className="space-y-3">
                      {equipmentItems.map((item) => {
                        const equipmentCategory = categories.find(cat => cat.name === "Обладнання");
                        const equipmentSubcategories = equipmentCategory 
                          ? subcategories.filter(sub => sub.category_id === equipmentCategory.id)
                          : [];
                        
                        return (
                        <div
                          key={item.id}
                          className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end border rounded-lg p-3 bg-gray-50"
                        >
                          <div className="space-y-1 md:col-span-2">
                            <Label>Найменування</Label>
                            <Input
                              value={item.name}
                              onChange={(e) =>
                                handleAdditionalItemChange(
                                  "equipment",
                                  item.id,
                                  "name",
                                  e.target.value
                                )
                              }
                              placeholder="Наприклад, коктейльний стіл у чохлі"
                            />
                          </div>
                          {equipmentSubcategories.length > 0 && (
                            <div className="space-y-1">
                              <Label>Підкатегорія (для знижки)</Label>
                              <Select
                                value={item.subcategoryId?.toString() || ""}
                                onValueChange={(value) => {
                                  const subcategoryId = value ? parseInt(value) : undefined;
                                  setEquipmentItems(prev =>
                                    prev.map(i =>
                                      i.id === item.id
                                        ? { ...i, subcategoryId }
                                        : i
                                    )
                                  );
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Оберіть" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Не вказано</SelectItem>
                                  {equipmentSubcategories.map((sub) => (
                                    <SelectItem key={sub.id} value={sub.id.toString()}>
                                      {sub.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label>Кількість</Label>
                            <Input
                              type="number"
                              value={item.quantity || ""}
                              onChange={(e) =>
                                handleAdditionalItemChange(
                                  "equipment",
                                  item.id,
                                  "quantity",
                                  e.target.value
                                )
                              }
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Ціна за одиницю, грн</Label>
                            <Input
                              type="number"
                              value={item.unitPrice || ""}
                              onChange={(e) =>
                                handleAdditionalItemChange(
                                  "equipment",
                                  item.id,
                                  "unitPrice",
                                  e.target.value
                                )
                              }
                              placeholder="0"
                            />
                          </div>
                          <div className="flex items-center justify-between md:col-span-4 pt-2">
                            <span className="text-sm text-gray-600">
                              Сума:{" "}
                              <span className="font-semibold text-gray-900">
                                {(item.quantity || 0) * (item.unitPrice || 0)} грн
                              </span>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRemoveAdditionalItem("equipment", item.id)
                              }
                            >
                              <X className="w-4 h-4 mr-1" />
                              Видалити
                            </Button>
                          </div>
                        </div>
                        );
                      })}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleAddAdditionalItem("equipment")}
                        className="w-full md:w-auto"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Додати позицію
                      </Button>
                    </div>
                    
                    {/* Поле для втрати або бію */}
                    <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-900">
                          Втрата або бій
                        </Label>
                        <div className="flex gap-3 items-end">
                          <div className="flex-1 space-y-1">
                            <Input
                              type="number"
                              value={equipmentLossOrBreakagePrice}
                              onChange={(e) => setEquipmentLossOrBreakagePrice(e.target.value)}
                              placeholder="0"
                              className="bg-white"
                            />
                          </div>
                          <div className="text-sm text-gray-600">
                            грн
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          Вкажіть суму за можливу втрату або бій обладнання
                        </p>
                      </div>
                    </div>

                    {(equipmentItems.length > 0 || equipmentLossOrBreakagePriceNum > 0) && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900">
                            Позицій: {equipmentItems.length}
                            {equipmentLossOrBreakagePriceNum > 0 && " + Втрата/бій"}
                          </span>
                          <span className="text-gray-900">
                            Всього: {equipmentTotal} грн
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Tab: Обслуговування */}
                <TabsContent value="service" className="mt-4">
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Додайте послуги обслуговування (офіціанти, бармени, адміністратори тощо).
                    </p>
                    <div className="space-y-3">
                      {serviceItems.map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end border rounded-lg p-3 bg-gray-50"
                        >
                          <div className="space-y-1 md:col-span-2">
                            <Label>Найменування</Label>
                            <Input
                              value={item.name}
                              onChange={(e) =>
                                handleAdditionalItemChange(
                                  "service",
                                  item.id,
                                  "name",
                                  e.target.value
                                )
                              }
                              placeholder="Наприклад, офіціант"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Кількість</Label>
                            <Input
                              type="number"
                              value={item.quantity || ""}
                              onChange={(e) =>
                                handleAdditionalItemChange(
                                  "service",
                                  item.id,
                                  "quantity",
                                  e.target.value
                                )
                              }
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Ціна за одиницю, грн</Label>
                            <Input
                              type="number"
                              value={item.unitPrice || ""}
                              onChange={(e) =>
                                handleAdditionalItemChange(
                                  "service",
                                  item.id,
                                  "unitPrice",
                                  e.target.value
                                )
                              }
                              placeholder="0"
                            />
                          </div>
                          <div className="flex items-center justify-between md:col-span-4 pt-2">
                            <span className="text-sm text-gray-600">
                              Сума:{" "}
                              <span className="font-semibold text-gray-900">
                                {(item.quantity || 0) * (item.unitPrice || 0)} грн
                              </span>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRemoveAdditionalItem("service", item.id)
                              }
                            >
                              <X className="w-4 h-4 mr-1" />
                              Видалити
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleAddAdditionalItem("service")}
                        className="w-full md:w-auto"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Додати позицію
                      </Button>
                    </div>
                    {serviceItems.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900">
                            Позицій: {serviceItems.length}
                          </span>
                          <span className="text-gray-900">
                            Всього: {serviceTotal} грн
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => goToStep(1)} variant="outline" className="w-full sm:w-auto">
              Назад
            </Button>
            <Button
              onClick={() => goToStep(3)}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 w-full sm:w-auto"
              disabled={selectedDishes.length === 0 || loading}
            >
              Далі: Обладнання
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Equipment calculation */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Крок 3: Прорахунок обладнання</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Додайте все необхідне обладнання для заходу (столи, посуд, текстиль тощо).
                </p>
                <div className="space-y-3">
                  {equipmentItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end border rounded-lg p-3 bg-gray-50"
                    >
                      <div className="space-y-1 md:col-span-2">
                        <Label>Найменування</Label>
                        <Input
                          value={item.name}
                          onChange={(e) =>
                            handleAdditionalItemChange(
                              "equipment",
                              item.id,
                              "name",
                              e.target.value
                            )
                          }
                          placeholder="Наприклад, коктейльний стіл у чохлі"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Кількість</Label>
                        <Input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) =>
                            handleAdditionalItemChange(
                              "equipment",
                              item.id,
                              "quantity",
                              e.target.value
                            )
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Ціна за одиницю, грн</Label>
                        <Input
                          type="number"
                          value={item.unitPrice || ""}
                          onChange={(e) =>
                            handleAdditionalItemChange(
                              "equipment",
                              item.id,
                              "unitPrice",
                              e.target.value
                            )
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="flex items-center justify-between md:col-span-4 pt-2">
                        <span className="text-sm text-gray-600">
                          Сума:{" "}
                          <span className="font-semibold text-gray-900">
                            {(item.quantity || 0) * (item.unitPrice || 0)} грн
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleRemoveAdditionalItem("equipment", item.id)
                          }
                        >
                          <X className="w-4 h-4 mr-1" />
                          Видалити
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAddAdditionalItem("equipment")}
                    className="w-full md:w-auto"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Додати позицію
                  </Button>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex justify-between">
                  <span className="text-gray-700 font-medium">
                    Всього за обладнання:
                  </span>
                  <span className="text-gray-900 font-semibold">
                    {equipmentTotal} грн
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => goToStep(2)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Назад
            </Button>
            <Button
              onClick={() => goToStep(4)}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 w-full sm:w-auto"
            >
              Далі: Обслуговування
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Service calculation */}
      {step === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Крок 4: Прорахунок обслуговування</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Додайте послуги обслуговування (офіціанти, логістика тощо).
                </p>
                <div className="space-y-3">
                  {serviceItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end border rounded-lg p-3 bg-gray-50"
                    >
                      <div className="space-y-1 md:col-span-2">
                        <Label>Найменування</Label>
                        <Input
                          value={item.name}
                          onChange={(e) =>
                            handleAdditionalItemChange(
                              "service",
                              item.id,
                              "name",
                              e.target.value
                            )
                          }
                          placeholder="Наприклад, офіціант"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Кількість</Label>
                        <Input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) =>
                            handleAdditionalItemChange(
                              "service",
                              item.id,
                              "quantity",
                              e.target.value
                            )
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Ціна за одиницю, грн</Label>
                        <Input
                          type="number"
                          value={item.unitPrice || ""}
                          onChange={(e) =>
                            handleAdditionalItemChange(
                              "service",
                              item.id,
                              "unitPrice",
                              e.target.value
                            )
                          }
                          placeholder="0"
                        />
                      </div>
                      <div className="flex items-center justify-between md:col-span-4 pt-2">
                        <span className="text-sm text-gray-600">
                          Сума:{" "}
                          <span className="font-semibold text-gray-900">
                            {(item.quantity || 0) * (item.unitPrice || 0)} грн
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleRemoveAdditionalItem("service", item.id)
                          }
                        >
                          <X className="w-4 h-4 mr-1" />
                          Видалити
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleAddAdditionalItem("service")}
                    className="w-full md:w-auto"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Додати послугу
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex justify-between">
                    <span className="text-gray-700 font-medium">
                      Всього за обслуговування:
                    </span>
                    <span className="text-gray-900 font-semibold">
                      {serviceTotal} грн
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-center justify-between gap-4">
                      <span className="text-gray-700 font-medium">
                        Транспортні витрати (для доставки обладнання), грн
                      </span>
                      <Input
                        className="w-40 text-right"
                        type="number"
                        value={transportEquipmentTotal}
                        onChange={(e) => setTransportEquipmentTotal(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-center justify-between gap-4">
                      <span className="text-gray-700 font-medium">
                        Транспортні витрати (для персоналу), грн
                      </span>
                      <Input
                        className="w-40 text-right"
                        type="number"
                        value={transportPersonnelTotal}
                        onChange={(e) => setTransportPersonnelTotal(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    {(parseFloat(transportEquipmentTotal || "0") > 0 || parseFloat(transportPersonnelTotal || "0") > 0) && (
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 flex items-center justify-between">
                        <span className="text-gray-700 font-semibold">
                          Всього транспортних витрат:
                        </span>
                        <span className="text-gray-900 font-bold">
                          {transportTotalNum} грн
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => goToStep(3)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Назад
            </Button>
            <Button
              onClick={() => goToStep(5)}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 w-full sm:w-auto"
            >
              Далі: Конструктор
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Constructor (menu and per-person calculation) */}
      {step === 5 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Крок 5: Конструктор меню</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Налаштуйте кількість порцій по кожній позиції меню, щоб система розрахувала вагу та вартість.
                </p>
                {(selectedDishes.length === 0 && customDishes.length === 0) ? (
                  <p className="text-gray-500">
                    Страви не обрано. Поверніться на крок &quot;Вибір страв&quot; або додайте позицію вручну.
                  </p>
                ) : (
                  <>
                    <div className="flex justify-end mb-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newId = customDishIdCounter - 1;
                          setCustomDishIdCounter(newId);
                          const newDish: Dish = {
                            id: newId,
                            name: "",
                            description: "",
                            weight: 0,
                            unit: "г",
                            price: 0,
                            photo_url: "",
                            category: "",
                            subcategory: "",
                          };
                          setCustomDishes([...customDishes, newDish]);
                          setDishQuantities((prev) => ({
                            ...prev,
                            [newId]: 1,
                          }));
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Додати позицію вручну
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b bg-[#FF5A00] text-white">
                            <th className="py-3 px-4 text-left font-semibold">Страва</th>
                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Вихід на стіл,<br />порція/вага (гр/мл)</th>
                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Кіл-сть<br />порцій</th>
                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Ціна,<br />грн</th>
                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Сума,<br />грн</th>
                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Вихід грам/мл<br />на особу</th>
                            <th className="py-3 px-4 text-center font-semibold">Дії</th>
                          </tr>
                        </thead>
                        <tbody>
                      {(() => {
                        // Розділяємо страви на звичайні та напої
                        const allDishes = getSelectedDishesData();
                        const regularDishes = allDishes.filter(d => !isDrink(d));
                        const drinks = allDishes.filter(d => isDrink(d));
                        
                        // Розраховуємо кількість гостей один раз
                        let peopleCountNum = 0;
                        if (eventFormats.length > 0) {
                          peopleCountNum = eventFormats.reduce((sum, format) => {
                            const formatPeopleCount = parseInt(format.peopleCount, 10) || 0;
                            return sum + formatPeopleCount;
                          }, 0);
                        }
                        if (peopleCountNum === 0) {
                          peopleCountNum = parseInt(guestCount, 10) || 0;
                        }
                        
                        // Функція для відображення рядка страви
                        const renderDishRow = (dish: Dish, isDrinkItem: boolean) => {
                            const qty = dishQuantities[dish.id] ?? 1;
                            const price = getDishPrice(dish);
                            const weight = getDishWeight(dish);
                            const total = qty * price;
                            const isCustom = isCustomDish(dish.id);
                            
                            // Для напоїв: конвертуємо в мл
                            // Для звичайних страв: конвертуємо в грами
                            // Парсимо вагу з формату "150/75" або числа
                            const parsedWeight = parseWeightValue(weight);
                            let displayValue: number | string = weight || 0;
                            let displayUnit = dish.unit || (isDrinkItem ? 'мл' : 'г');
                            let outputPerPerson = "0.00";
                            
                            if (isDrinkItem) {
                              // Для напоїв: конвертуємо все в мл
                              const unit = (dish.unit || 'мл').toLowerCase();
                              let volumeInMl = parsedWeight.first;
                              if (unit === 'л') {
                                volumeInMl = volumeInMl * 1000;
                              } else if (unit === 'мл') {
                                volumeInMl = volumeInMl;
                              } else if (unit === 'г' || unit === 'кг') {
                                // Якщо напій був в грамах/кг, конвертуємо в мл (1г ≈ 1мл для води)
                                if (unit === 'кг') {
                                  volumeInMl = volumeInMl * 1000;
                                }
                              }
                              displayValue = volumeInMl;
                              displayUnit = 'мл';
                              
                              const totalVolumeMl = volumeInMl * qty;
                              outputPerPerson = totalVolumeMl > 0 && peopleCountNum > 0 
                                ? (totalVolumeMl / peopleCountNum).toFixed(2)
                                : "0.00";
                            } else {
                              // Для звичайних страв: якщо вага в форматі через слеш, відображаємо як є
                              if (parsedWeight.isRange) {
                                displayValue = weight; // Відображаємо оригінальний формат "150/75"
                                displayUnit = dish.unit || 'г';
                                // Для обчислень використовуємо перше число
                                const unit = (dish.unit || 'г').toLowerCase();
                                let weightInGrams = parsedWeight.first;
                                if (unit === 'кг') {
                                  weightInGrams = weightInGrams * 1000;
                                } else if (unit === 'г') {
                                  weightInGrams = weightInGrams;
                                } else if (unit === 'л') {
                                  weightInGrams = weightInGrams * 1000;
                                } else if (unit === 'мл') {
                                  weightInGrams = weightInGrams;
                                }
                                const totalWeightGrams = weightInGrams * qty;
                                outputPerPerson = totalWeightGrams > 0 && peopleCountNum > 0 
                                  ? (totalWeightGrams / peopleCountNum).toFixed(2)
                                  : "0.00";
                              } else {
                                // Для звичайних страв: конвертуємо в грами
                                const unit = (dish.unit || 'г').toLowerCase();
                                let weightInGrams = parsedWeight.first;
                                if (unit === 'кг') {
                                  weightInGrams = weightInGrams * 1000;
                                } else if (unit === 'г') {
                                  weightInGrams = weightInGrams;
                                } else if (unit === 'л') {
                                  weightInGrams = weightInGrams * 1000;
                                } else if (unit === 'мл') {
                                  weightInGrams = weightInGrams;
                                }
                                displayValue = weightInGrams;
                                displayUnit = 'г';
                                
                                const totalWeightGrams = weightInGrams * qty;
                                outputPerPerson = totalWeightGrams > 0 && peopleCountNum > 0 
                                  ? (totalWeightGrams / peopleCountNum).toFixed(2)
                                  : "0.00";
                              }
                            }
                            
                            return (
                              <tr key={dish.id} className={`border-b last:border-0 hover:bg-gray-50 ${isCustom ? 'bg-yellow-50' : ''}`}>
                                <td className="py-3 px-4 text-left">
                                  {isCustom ? (
                                    <Input
                                      type="text"
                                      className="w-full"
                                      placeholder="Назва страви"
                                      value={dish.name}
                                      onChange={(e) => {
                                        setCustomDishes((prev) =>
                                          prev.map((d) => (d.id === dish.id ? { ...d, name: e.target.value } : d))
                                        );
                                      }}
                                    />
                                  ) : (
                                    dish.name
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Input
                                    type="text"
                                    className="w-24 ml-auto text-right"
                                    placeholder="150 або 150/75"
                                    value={typeof displayValue === 'string' ? displayValue : String(displayValue)}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setDishOverrides((prev) => ({
                                        ...prev,
                                        [dish.id]: { ...prev[dish.id], weight: value },
                                      }));
                                    }}
                                  />
                                  <span className="text-xs text-gray-500 ml-1">{displayUnit}</span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Input
                                    type="number"
                                    className="w-20 ml-auto text-right"
                                    min="0"
                                    value={qty}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value, 10) || 0;
                                      setDishQuantities((prev) => ({
                                        ...prev,
                                        [dish.id]: value,
                                      }));
                                    }}
                                  />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Input
                                    type="number"
                                    className="w-24 ml-auto text-right"
                                    min="0"
                                    step="0.01"
                                    value={price.toFixed(2)}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value) || 0;
                                      setDishOverrides((prev) => ({
                                        ...prev,
                                        [dish.id]: { ...prev[dish.id], price: value },
                                      }));
                                    }}
                                  />
                                </td>
                                <td className="py-3 px-4 text-right font-medium">{total.toFixed(2)}</td>
                                <td className="py-3 px-4 text-right">{outputPerPerson}</td>
                                <td className="py-3 px-4 text-center">
                                  {isCustom && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setCustomDishes((prev) => prev.filter((d) => d.id !== dish.id));
                                        setDishQuantities((prev) => {
                                          const { [dish.id]: _, ...rest } = prev;
                                          return rest;
                                        });
                                        setDishOverrides((prev) => {
                                          const { [dish.id]: _, ...rest } = prev;
                                          return rest;
                                        });
                                      }}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          };
                          
                          return (
                            <>
                              {/* Звичайні страви */}
                              {regularDishes.map(dish => renderDishRow(dish, false))}
                              {/* Напої */}
                              {drinks.length > 0 && (
                                <>
                                  <tr>
                                    <td colSpan={7} className="py-2 px-4 bg-blue-50 border-t-2 border-blue-200">
                                      <div className="font-semibold text-blue-900">Напої</div>
                                    </td>
                                  </tr>
                                  {drinks.map(dish => renderDishRow(dish, true))}
                                </>
                              )}
                            </>
                          );
                        })()}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">
                          Вартість страв (усі позиції)
                        </div>
                        {(() => {
                          // Розраховуємо знижку на меню з урахуванням нової системи
                          let finalFoodPrice = foodTotalPrice;
                          let menuDiscountAmount = 0;
                          
                          if (discountMenuId) {
                            const discountBenefit = benefits.find((b) => b.id === discountMenuId);
                            menuDiscountAmount = discountBenefit ? (regularDishesPrice * discountBenefit.value) / 100 : 0;
                            finalFoodPrice = foodTotalPrice - menuDiscountAmount;
                          } else if (selectedDiscountId && discountIncludeMenu) {
                            // Стара система для сумісності
                            const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
                            menuDiscountAmount = discountBenefit ? (regularDishesPrice * discountBenefit.value) / 100 : 0;
                            finalFoodPrice = foodTotalPrice - menuDiscountAmount;
                          }
                          
                          if (menuDiscountAmount > 0) {
                            return (
                              <>
                                <div className="text-xs text-gray-500 line-through mb-1">
                                  {foodTotalPrice.toLocaleString()} грн
                                </div>
                                <div className="text-xs text-[#FF5A00] mb-1">
                                  Знижка: -{menuDiscountAmount.toLocaleString()} грн
                                  {customDishes.length > 0 && (
                                    <span className="text-gray-500 ml-1">(тільки на звичайні страви)</span>
                                  )}
                                </div>
                                <div className="text-lg font-semibold text-gray-900">
                                  {finalFoodPrice.toLocaleString()} грн
                                </div>
                              </>
                            );
                          }
                          return (
                            <div className="text-lg font-semibold text-gray-900">
                              {foodTotalPrice.toLocaleString()} грн
                            </div>
                          );
                        })()}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">
                          Вартість обладнання
                        </div>
                        {(() => {
                          // Розраховуємо знижку на обладнання
                          let finalEquipmentPrice = equipmentTotal;
                          let equipmentDiscountAmount = 0;
                          
                          if (discountEquipmentId || Object.keys(discountEquipmentSubcategories).length > 0) {
                            // Якщо є знижки по підкатегоріях, розраховуємо окремо
                            if (Object.keys(discountEquipmentSubcategories).length > 0) {
                              equipmentItems.forEach(item => {
                                if (item.subcategoryId && discountEquipmentSubcategories[item.subcategoryId]) {
                                  const benefitId = discountEquipmentSubcategories[item.subcategoryId];
                                  const discountBenefit = benefits.find((b) => b.id === benefitId);
                                  if (discountBenefit) {
                                    const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
                                    equipmentDiscountAmount += (itemTotal * discountBenefit.value) / 100;
                                  }
                                }
                              });
                              // Додаємо знижку на "Втрати та бій" якщо є загальна знижка
                              if (discountEquipmentId) {
                                const discountBenefit = benefits.find((b) => b.id === discountEquipmentId);
                                if (discountBenefit) {
                                  equipmentDiscountAmount += (equipmentLossOrBreakagePriceNum * discountBenefit.value) / 100;
                                }
                              }
                            } else if (discountEquipmentId) {
                              // Загальна знижка на все обладнання
                              const discountBenefit = benefits.find((b) => b.id === discountEquipmentId);
                              equipmentDiscountAmount = discountBenefit ? (equipmentTotal * discountBenefit.value) / 100 : 0;
                            }
                            finalEquipmentPrice = equipmentTotal - equipmentDiscountAmount;
                          } else if (selectedDiscountId && discountIncludeEquipment) {
                            // Стара система для сумісності
                            const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
                            equipmentDiscountAmount = discountBenefit ? (equipmentTotal * discountBenefit.value) / 100 : 0;
                            finalEquipmentPrice = equipmentTotal - equipmentDiscountAmount;
                          }
                          
                          if (equipmentDiscountAmount > 0) {
                            return (
                              <>
                                <div className="text-xs text-gray-500 line-through mb-1">
                                  {equipmentTotal.toLocaleString()} грн
                                </div>
                                <div className="text-xs text-[#FF5A00] mb-1">
                                  Знижка: -{equipmentDiscountAmount.toLocaleString()} грн
                                </div>
                                <div className="text-lg font-semibold text-gray-900">
                                  {finalEquipmentPrice.toLocaleString()} грн
                                </div>
                              </>
                            );
                          }
                          return (
                            <div className="text-lg font-semibold text-gray-900">
                              {equipmentTotal.toLocaleString()} грн
                            </div>
                          );
                        })()}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">
                          Вартість сервісу
                        </div>
                        {(() => {
                          // Розраховуємо знижку на сервіс
                          let finalServicePrice = serviceTotal;
                          let serviceDiscountAmount = 0;
                          
                          if (discountServiceId) {
                            const discountBenefit = benefits.find((b) => b.id === discountServiceId);
                            serviceDiscountAmount = discountBenefit ? (serviceTotal * discountBenefit.value) / 100 : 0;
                            finalServicePrice = serviceTotal - serviceDiscountAmount;
                          } else if (selectedDiscountId && discountIncludeService) {
                            // Стара система для сумісності
                            const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
                            serviceDiscountAmount = discountBenefit ? (serviceTotal * discountBenefit.value) / 100 : 0;
                            finalServicePrice = serviceTotal - serviceDiscountAmount;
                          }
                          
                          if (serviceDiscountAmount > 0) {
                            return (
                              <>
                                <div className="text-xs text-gray-500 line-through mb-1">
                                  {serviceTotal.toLocaleString()} грн
                                </div>
                                <div className="text-xs text-[#FF5A00] mb-1">
                                  Знижка: -{serviceDiscountAmount.toLocaleString()} грн
                                </div>
                                <div className="text-lg font-semibold text-gray-900">
                                  {finalServicePrice.toLocaleString()} грн
                                </div>
                              </>
                            );
                          }
                          return (
                            <div className="text-lg font-semibold text-gray-900">
                              {serviceTotal.toLocaleString()} грн
                            </div>
                          );
                        })()}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">
                          Орієнтовний вихід (сума ваги)
                        </div>
                        <div className="text-lg font-semibold text-gray-900">
                          {getTotalWeight().toFixed(0)} г
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">
                          Вартість страв на 1 гостя
                        </div>
                        <div className="text-lg font-semibold text-gray-900">
                          {(() => {
                            const peopleCountNum = guestCount ? parseInt(guestCount, 10) || 0 : 0;
                            if (peopleCountNum <= 0) return "-";
                            
                            let finalFoodPrice = foodTotalPrice;
                            if (discountMenuId) {
                              const discountBenefit = benefits.find((b) => b.id === discountMenuId);
                              const menuDiscountAmount = discountBenefit ? (regularDishesPrice * discountBenefit.value) / 100 : 0;
                              finalFoodPrice = foodTotalPrice - menuDiscountAmount;
                            } else if (selectedDiscountId && discountIncludeMenu) {
                              const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
                              const menuDiscountAmount = discountBenefit ? (regularDishesPrice * discountBenefit.value) / 100 : 0;
                              finalFoodPrice = foodTotalPrice - menuDiscountAmount;
                            }
                            
                            const pricePerPerson = finalFoodPrice / peopleCountNum;
                            if (pricePerPerson <= 0) return "-";
                            return `${pricePerPerson.toFixed(2)} грн`;
                          })()}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">
                          Орієнтовний вихід на 1 гостя
                        </div>
                        <div className="text-lg font-semibold text-gray-900">
                          {(() => {
                            const peopleCountNum = guestCount ? parseInt(guestCount, 10) || 0 : 0;
                            if (peopleCountNum <= 0) return "- г";
                            const weightPerPerson = getWeightPerPerson();
                            if (weightPerPerson <= 0) return "- г";
                            return `${weightPerPerson.toFixed(0)} г`;
                          })()}
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">
                          Напої на 1 гостя
                        </div>
                        <div className="text-lg font-semibold text-gray-900">
                          {(() => {
                            const peopleCountNum = guestCount ? parseInt(guestCount, 10) || 0 : 0;
                            if (peopleCountNum <= 0) return "- мл";
                            const drinksPerPerson = getDrinksVolumePerPerson();
                            if (drinksPerPerson <= 0) return "- мл";
                            return `${drinksPerPerson.toFixed(0)} мл`;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Discount and Cashback Selection */}
                    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border mt-6">
                      <h3 className="text-gray-900 font-medium">Знижка та кешбек</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="discount-menu-select">Знижка на меню</Label>
                            <Select
                              value={discountMenuId?.toString() || ""}
                              onValueChange={(value) => {
                                const id = value ? parseInt(value) : null;
                                setDiscountMenuId(id);
                              }}
                            >
                              <SelectTrigger id="discount-menu-select">
                                <SelectValue placeholder="Оберіть знижку на меню" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Без знижки</SelectItem>
                                {benefits
                                  .filter((b) => b.type === "discount" && b.is_active)
                                  .map((benefit) => (
                                    <SelectItem key={benefit.id} value={benefit.id.toString()}>
                                      {benefit.name} ({benefit.value}%)
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="discount-equipment-select">Знижка на обладнання (загальна)</Label>
                            <Select
                              value={discountEquipmentId?.toString() || ""}
                              onValueChange={(value) => {
                                const id = value ? parseInt(value) : null;
                                setDiscountEquipmentId(id);
                                // Якщо вибрано загальну знижку, очищаємо знижки по підкатегоріях
                                if (id) {
                                  setDiscountEquipmentSubcategories({});
                                }
                              }}
                            >
                              <SelectTrigger id="discount-equipment-select">
                                <SelectValue placeholder="Оберіть знижку на обладнання" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Без знижки</SelectItem>
                                {benefits
                                  .filter((b) => b.type === "discount" && b.is_active)
                                  .map((benefit) => (
                                    <SelectItem key={benefit.id} value={benefit.id.toString()}>
                                      {benefit.name} ({benefit.value}%)
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Знижки по підкатегоріях обладнання */}
                          {(() => {
                            const equipmentCategory = categories.find(cat => cat.name === "Обладнання");
                            const equipmentSubcategories = equipmentCategory 
                              ? subcategories.filter(sub => sub.category_id === equipmentCategory.id)
                              : [];
                            
                            if (equipmentSubcategories.length > 0 && !discountEquipmentId) {
                              return (
                                <div className="space-y-2 pt-2 border-t">
                                  <Label className="text-sm text-gray-700">Знижки по підкатегоріях обладнання:</Label>
                                  <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {equipmentSubcategories.map((sub) => (
                                      <div key={sub.id} className="flex items-center gap-2">
                                        <Label className="text-xs flex-1 min-w-0 truncate">{sub.name}:</Label>
                                        <Select
                                          value={discountEquipmentSubcategories[sub.id]?.toString() || ""}
                                          onValueChange={(value) => {
                                            const id = value ? parseInt(value) : null;
                                            setDiscountEquipmentSubcategories(prev => {
                                              const next = { ...prev };
                                              if (id) {
                                                next[sub.id] = id;
                                              } else {
                                                delete next[sub.id];
                                              }
                                              return next;
                                            });
                                          }}
                                        >
                                          <SelectTrigger className="w-32 h-8 text-xs">
                                            <SelectValue placeholder="—" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="">Без знижки</SelectItem>
                                            {benefits
                                              .filter((b) => b.type === "discount" && b.is_active)
                                              .map((benefit) => (
                                                <SelectItem key={benefit.id} value={benefit.id.toString()}>
                                                  {benefit.value}%
                                                </SelectItem>
                                              ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          
                          <div className="space-y-2">
                            <Label htmlFor="discount-service-select">Знижка на сервіс</Label>
                            <Select
                              value={discountServiceId?.toString() || ""}
                              onValueChange={(value) => {
                                const id = value ? parseInt(value) : null;
                                setDiscountServiceId(id);
                              }}
                            >
                              <SelectTrigger id="discount-service-select">
                                <SelectValue placeholder="Оберіть знижку на сервіс" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Без знижки</SelectItem>
                                {benefits
                                  .filter((b) => b.type === "discount" && b.is_active)
                                  .map((benefit) => (
                                    <SelectItem key={benefit.id} value={benefit.id.toString()}>
                                      {benefit.name} ({benefit.value}%)
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cashback-select-step5">Кешбек</Label>
                          <Select
                            value={selectedCashbackId?.toString() || ""}
                            onValueChange={(value) => {
                              const id = parseInt(value);
                              setSelectedCashbackId(id);
                              // Якщо обрано кешбек, скидаємо знижку
                              if (id) {
                                setSelectedDiscountId(null);
                              }
                            }}
                          >
                            <SelectTrigger id="cashback-select-step5">
                              <SelectValue placeholder="Оберіть кешбек" />
                            </SelectTrigger>
                            <SelectContent>
                              {benefits
                                .filter((b) => b.type === "cashback" && b.is_active)
                                .map((benefit) => (
                                  <SelectItem key={benefit.id} value={benefit.id.toString()}>
                                    {benefit.name} ({benefit.value}%)
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {selectedCashbackId && (() => {
                        const cashbackBenefit = benefits.find((b) => b.id === selectedCashbackId);
                        const discountAmount = calculateDiscountAmount();
                        const foodPrice = discountIncludeMenu && selectedDiscountId
                          ? foodTotalPrice - (() => {
                              const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
                              return discountBenefit ? (foodTotalPrice * discountBenefit.value) / 100 : 0;
                            })()
                          : foodTotalPrice;
                        const equipmentPrice = discountIncludeEquipment && selectedDiscountId
                          ? equipmentTotal - (() => {
                              const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
                              return discountBenefit ? (equipmentTotal * discountBenefit.value) / 100 : 0;
                            })()
                          : equipmentTotal;
                        const servicePrice = discountIncludeService && selectedDiscountId
                          ? serviceTotal - (() => {
                              const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
                              return discountBenefit ? (serviceTotal * discountBenefit.value) / 100 : 0;
                            })()
                          : serviceTotal;
                        const transportTotalPreview = (parseFloat(transportEquipmentTotal || "0") || 0) + (parseFloat(transportPersonnelTotal || "0") || 0);
                        const totalBeforeCashback = foodPrice + equipmentPrice + servicePrice + transportTotalPreview;
                        const cashbackAmount = cashbackBenefit ? (totalBeforeCashback * cashbackBenefit.value) / 100 : 0;
                        const selectedClient = selectedClientId ? clients.find((c) => c.id === selectedClientId) : null;
                        const clientBalance = selectedClient?.cashback || 0;
                        const hasEnoughBalance = clientBalance >= cashbackAmount;
                        
                        return (
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="use-cashback-step5"
                                checked={useCashback}
                                disabled={!hasEnoughBalance && selectedClientId !== null}
                                onCheckedChange={(checked) => {
                                  if (checked && selectedClientId && !hasEnoughBalance) {
                                    toast.error(`Недостатньо коштів на бонусному рахунку. Доступно: ${clientBalance.toFixed(2)} грн, потрібно: ${cashbackAmount.toFixed(2)} грн`);
                                    return;
                                  }
                                  setUseCashback(checked as boolean);
                                }}
                              />
                              <Label htmlFor="use-cashback-step5" className="cursor-pointer">
                                Списати кешбек з бонусного рахунку клієнта
                              </Label>
                            </div>
                            {selectedClientId && (
                              <div className="text-sm text-gray-600">
                                Бонусний баланс клієнта: <span className={hasEnoughBalance ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{clientBalance.toFixed(2)} грн</span>
                                {!hasEnoughBalance && (
                                  <span className="text-red-600 ml-2">(недостатньо для списання)</span>
                                )}
                              </div>
                            )}
                            {!selectedClientId && (
                              <div className="text-sm text-yellow-600">
                                ⚠️ Оберіть клієнта зі списку для перевірки балансу
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {(selectedDiscountId && selectedCashbackId) && (
                        <p className="text-sm text-red-600 mt-2">
                          ⚠️ Не можна використовувати знижку та кешбек разом
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => goToStep(4)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Назад
            </Button>
            <Button
              onClick={() => goToStep(6)}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 w-full sm:w-auto"
            >
              Далі: Прев'ю КП
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 6: KP preview */}
      {step === 6 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Крок 6: Прев&apos;ю КП</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <EditableField
                    label="Клієнт"
                    value={clientName}
                    onChange={(value) => setClientName(value)}
                    onEdit={() => goToStep(1)}
                    stepNumber={1}
                  />
                  <EditableField
                    label="Формат"
                    value={eventFormat || "-"}
                    onChange={(value) => setEventFormat(value)}
                    onEdit={() => goToStep(1)}
                    stepNumber={1}
                  />
                  <EditableField
                    label="Дата заходу"
                    value={eventDate || "-"}
                    onChange={(value) => setEventDate(value)}
                    onEdit={() => goToStep(1)}
                    stepNumber={1}
                    type="date"
                  />
                  <EditableField
                    label="Час"
                    value={eventTime || "-"}
                    onChange={(value) => setEventTime(value)}
                    onEdit={() => goToStep(1)}
                    stepNumber={1}
                  />
                  <EditableField
                    label="Кількість гостей"
                    value={guestCount || "-"}
                    onChange={(value) => setGuestCount(value)}
                    onEdit={() => goToStep(1)}
                    stepNumber={1}
                    type="number"
                  />
                  <EditableField
                    label="Місце проведення"
                    value={eventLocation || "-"}
                    onChange={(value) => setEventLocation(value)}
                    onEdit={() => goToStep(1)}
                    stepNumber={1}
                  />
                  <EditableField
                    label="Координатор"
                    value={coordinatorName || "-"}
                    onChange={(value) => setCoordinatorName(value)}
                    onEdit={() => goToStep(1)}
                    stepNumber={1}
                  />
                  <EditableField
                    label="Телефон координатора"
                    value={coordinatorPhone || "-"}
                    onChange={(value) => setCoordinatorPhone(value)}
                    onEdit={() => goToStep(1)}
                    stepNumber={1}
                    type="tel"
                  />
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h4 className="text-gray-900 font-medium">Обрані страви</h4>
                  {getSelectedDishesData().length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      Страви не обрано.
                    </p>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {getSelectedDishesData().map((dish) => {
                        const qty = dishQuantities[dish.id] ?? 1;
                        return (
                          <div
                            key={dish.id}
                            className="flex items-center justify-between"
                          >
                            <span className="text-gray-900">
                              {dish.name}{" "}
                              <span className="text-gray-500">
                                × {qty} порцій
                              </span>
                            </span>
                            <span className="text-gray-600">
                              {dish.price * qty} грн
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 space-y-4 text-sm">
                  <h4 className="text-gray-900 font-medium">
                    Додаткові блоки
                  </h4>
                  
                  {/* Обладнання */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-700 font-medium">
                        Обладнання
                      </span>
                      <span className="text-gray-900 font-semibold">
                        {(() => {
                          if (selectedDiscountId && discountIncludeEquipment) {
                            const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
                            const discountAmount = discountBenefit ? (equipmentTotal * discountBenefit.value) / 100 : 0;
                            const finalEquipmentPrice = equipmentTotal - discountAmount;
                            return (
                              <>
                                <span className="text-xs text-gray-500 line-through mr-2">
                                  {equipmentTotal.toLocaleString()}
                                </span>
                                {finalEquipmentPrice.toLocaleString()} грн
                              </>
                            );
                          }
                          return `${equipmentTotal.toLocaleString()} грн`;
                        })()}
                      </span>
                    </div>
                    {equipmentItems.length > 0 ? (
                      <div className="ml-4 space-y-1 text-xs text-gray-600">
                        {equipmentItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <span>
                              {item.name} × {item.quantity}
                            </span>
                            <span>
                              {(item.quantity * item.unitPrice).toLocaleString()} грн
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="ml-4 text-xs text-gray-400 italic">
                        Позиції не додані
                      </div>
                    )}
                  </div>

                  {/* Обслуговування */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-700 font-medium">
                        Обслуговування
                      </span>
                      <span className="text-gray-900 font-semibold">
                        {(() => {
                          if (selectedDiscountId && discountIncludeService) {
                            const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
                            const discountAmount = discountBenefit ? (serviceTotal * discountBenefit.value) / 100 : 0;
                            const finalServicePrice = serviceTotal - discountAmount;
                            return (
                              <>
                                <span className="text-xs text-gray-500 line-through mr-2">
                                  {serviceTotal.toLocaleString()}
                                </span>
                                {finalServicePrice.toLocaleString()} грн
                              </>
                            );
                          }
                          return `${serviceTotal.toLocaleString()} грн`;
                        })()}
                      </span>
                    </div>
                    {serviceItems.length > 0 ? (
                      <div className="ml-4 space-y-1 text-xs text-gray-600">
                        {serviceItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <span>
                              {item.name} × {item.quantity}
                            </span>
                            <span>
                              {(item.quantity * item.unitPrice).toLocaleString()} грн
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="ml-4 text-xs text-gray-400 italic">
                        Позиції не додані
                      </div>
                    )}
                  </div>

                  {/* Транспортні витрати */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-medium">
                      Транспортні витрати
                    </span>
                    <span className="text-gray-900 font-semibold">
                      {transportTotalNum} грн
                    </span>
                  </div>
                </div>

                {/* Розрахунок фінальної суми з урахуванням знижок та кешбеку */}
                {(() => {
                  const discountAmount = calculateDiscountAmount();
                  const discountBenefit = selectedDiscountId ? benefits.find((b) => b.id === selectedDiscountId) : null;
                  
                  // Розраховуємо фінальні ціни з урахуванням знижки
                  let finalFoodPrice = foodTotalPrice;
                  let finalEquipmentTotal = equipmentTotal;
                  let finalServiceTotal = serviceTotal;
                  
                  if (discountBenefit) {
                    if (discountIncludeMenu) {
                      finalFoodPrice = foodTotalPrice - (foodTotalPrice * discountBenefit.value) / 100;
                    }
                    if (discountIncludeEquipment) {
                      finalEquipmentTotal = equipmentTotal - (equipmentTotal * discountBenefit.value) / 100;
                    }
                    if (discountIncludeService) {
                      finalServiceTotal = serviceTotal - (serviceTotal * discountBenefit.value) / 100;
                    }
                  }
                  
                  const transportTotalNum = parseFloat(transportTotal || "0") || 0;
                  const totalBeforeCashback = finalFoodPrice + finalEquipmentTotal + finalServiceTotal + transportTotalNum;
                  const cashbackAmount = selectedCashbackId
                    ? (() => {
                        const cashbackBenefit = benefits.find((b) => b.id === selectedCashbackId);
                        return cashbackBenefit ? (totalBeforeCashback * cashbackBenefit.value) / 100 : 0;
                      })()
                    : 0;
                  const finalTotal = totalBeforeCashback - (useCashback ? cashbackAmount : 0);
                  const peopleCountNum = parseInt(guestCount, 10) || 0;
                  
                  return (
                    <div className="border-t pt-4 space-y-4">
                      {(selectedDiscountId || selectedCashbackId) && (
                        <div className="space-y-2 text-sm">
                          {selectedDiscountId && discountAmount > 0 && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[#FF5A00]">
                                <span>Знижка:</span>
                                <span>-{discountAmount.toLocaleString()} грн</span>
                              </div>
                              <div className="text-xs text-gray-500 ml-4">
                                {discountIncludeMenu && `Меню: -${((foodTotalPrice * (discountBenefit?.value || 0)) / 100).toLocaleString()} грн`}
                                {discountIncludeEquipment && ` | Обладнання: -${((equipmentTotal * (discountBenefit?.value || 0)) / 100).toLocaleString()} грн`}
                                {discountIncludeService && ` | Сервіс: -${((serviceTotal * (discountBenefit?.value || 0)) / 100).toLocaleString()} грн`}
                              </div>
                            </div>
                          )}
                          {selectedCashbackId && (
                            <>
                              <div className="flex justify-between text-green-600">
                                <span>Кешбек:</span>
                                <span>+{cashbackAmount.toLocaleString()} грн</span>
                              </div>
                              {useCashback && (
                                <div className="flex justify-between text-red-600">
                                  <span>Списано з бонусного рахунку:</span>
                                  <span>-{cashbackAmount.toLocaleString()} грн</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">
                            Загальна вартість заходу
                          </div>
                          <div className="text-lg font-semibold text-gray-900">
                            {finalTotal.toLocaleString()} грн
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">
                            На 1 гостя
                          </div>
                          <div className="text-lg font-semibold text-gray-900">
                            {peopleCountNum > 0
                              ? Math.round(finalTotal / peopleCountNum).toLocaleString()
                              : "-"}{" "}
                            грн
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">
                            Орієнтовний вихід на 1 гостя
                          </div>
                          <div className="text-lg font-semibold text-gray-900">
                            {(() => {
                              if (peopleCountNum <= 0) return "- г";
                              const weightPerPerson = getWeightPerPerson();
                              if (weightPerPerson <= 0) return "- г";
                              return `${weightPerPerson.toFixed(0)} г`;
                            })()}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">
                            Напої на 1 гостя
                          </div>
                          <div className="text-lg font-semibold text-gray-900">
                            {(() => {
                              if (peopleCountNum <= 0) return "- мл";
                              const drinksPerPerson = getDrinksVolumePerPerson();
                              if (drinksPerPerson <= 0) return "- мл";
                              return `${drinksPerPerson.toFixed(0)} мл`;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => goToStep(5)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Назад
            </Button>
            <Button
              onClick={() => goToStep(7)}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 w-full sm:w-auto"
            >
              Далі: Шаблон та відправка
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 7: Template Selection and Send */}
      {step === 7 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Крок 7: Вибір шаблону та відправка</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Template Selection */}
                <div className="space-y-2">
                  <Label>Оберіть шаблон КП</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {templatesLoading && (
                      <div className="col-span-3 py-8 text-center text-gray-500">
                        Завантаження шаблонів...
                      </div>
                    )}
                    {!templatesLoading && templates.length === 0 && (
                      <div className="col-span-3 py-8 text-center text-gray-500">
                        Немає доступних шаблонів. Створіть шаблон у розділі
                        &quot;Шаблони КП&quot;.
                      </div>
                    )}
                    {!templatesLoading &&
                      templates.map((template) => {
                        const isSelected =
                          selectedTemplateId === template.id;
                      return (
                        <div
                          key={template.id}
                          onClick={() => setSelectedTemplateId(template.id)}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? "border-[#FF5A00] bg-[#FF5A00]/5"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {template.preview_image_url && (
                            <div className="mb-3 h-40 rounded-md overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                              <img
                                src={getImageUrl(template.preview_image_url)}
                                alt={template.name}
                                className="max-w-full max-h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            </div>
                          )}
                          <div className="flex items-start justify-between mb-2">
                            <FileText
                              className={`w-5 h-5 ${
                                isSelected ? "text-[#FF5A00]" : "text-gray-400"
                              }`}
                            />
                            <Checkbox checked={isSelected} />
                          </div>
                          <h4 className="text-gray-900 mb-1">{template.name}</h4>
                          <p className="text-sm text-gray-600">{template.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PDF Preview Actions */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-900">Попередній перегляд PDF</h3>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleGeneratePDFPreview}
                        variant="outline"
                        disabled={!selectedTemplateId || isGeneratingPreview}
                      >
                        {isGeneratingPreview ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Генерація...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            Переглянути PDF
                          </>
                        )}
                      </Button>
                      {pdfPreviewUrl && (
                        <Button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = pdfPreviewUrl;
                            link.download = `KP_${clientName || 'preview'}_${new Date().toLocaleDateString('uk-UA')}.pdf`;
                            link.click();
                          }}
                          variant="outline"
                          className="bg-[#FF5A00] text-white hover:bg-[#FF5A00]/90"
                        >
                          Скачати PDF
                        </Button>
                      )}
                    </div>
                  </div>

                  {pdfPreviewUrl && (
                    <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                      <iframe
                        src={pdfPreviewUrl}
                        className="w-full"
                        style={{ height: '600px' }}
                        title="PDF Preview"
                      />
                    </div>
                  )}
                </div>

                {/* Text Preview */}
                <div className="border-t pt-6">
                  <h3 className="text-gray-900 mb-4">Деталі КП</h3>
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Клієнт:</span>
                        <span className="text-gray-900 ml-2">{clientName}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Дата події:</span>
                        <span className="text-gray-900 ml-2">{eventDate}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Гостей:</span>
                        <span className="text-gray-900 ml-2">
                          {guestCount || (eventFormats.length > 0 
                            ? Math.max(...eventFormats.map(f => parseInt(f.peopleCount, 10) || 0), 0) 
                            : "Не вказано")}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Страв:</span>
                        <span className="text-gray-900 ml-2">{selectedDishes.length}</span>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="text-gray-900 mb-3">Обрані страви:</h4>
                      <div className="space-y-2">
                        {getSelectedDishesData().map((dish) => (
                          <div
                            key={dish.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-gray-900">{dish.name}</span>
                            <span className="text-gray-600">{dish.price} грн</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t mt-4 pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Сума меню:</span>
                          <span className="text-gray-900">{getTotalPrice().toLocaleString()} грн</span>
                        </div>
                        {selectedDiscountId && (() => {
                          const discountAmount = calculateDiscountAmount();
                          const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
                          const menuDiscountAmount = discountIncludeMenu 
                            ? (discountBenefit ? (getTotalPrice() * discountBenefit.value) / 100 : 0)
                            : 0;
                          return (
                            <>
                              <div className="flex justify-between text-sm text-[#FF5A00]">
                                <span>Знижка ({discountBenefit?.value}%):</span>
                                <span>-{discountAmount.toLocaleString()} грн</span>
                              </div>
                              {discountAmount > 0 && (
                                <div className="text-xs text-gray-500 ml-4">
                                  {discountIncludeMenu && `Меню: -${menuDiscountAmount.toLocaleString()} грн`}
                                  {discountIncludeEquipment && ` | Обладнання: -${(discountBenefit ? (equipmentTotal * discountBenefit.value) / 100 : 0).toLocaleString()} грн`}
                                  {discountIncludeService && ` | Сервіс: -${(discountBenefit ? (serviceTotal * discountBenefit.value) / 100 : 0).toLocaleString()} грн`}
                                </div>
                              )}
                              {discountIncludeMenu && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Сума меню зі знижкою:</span>
                                  <span className="text-gray-900">{(getTotalPrice() - menuDiscountAmount).toLocaleString()} грн</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                        {selectedCashbackId && (() => {
                          const cashbackBenefit = benefits.find((b) => b.id === selectedCashbackId);
                          const discountBenefit = selectedDiscountId ? benefits.find((b) => b.id === selectedDiscountId) : null;
                          
                          // Розраховуємо фінальні ціни з урахуванням знижки
                          let finalFoodPrice = getTotalPrice();
                          let finalEquipmentTotal = equipmentTotal;
                          let finalServiceTotal = serviceTotal;
                          
                          if (discountBenefit) {
                            if (discountIncludeMenu) {
                              finalFoodPrice = getTotalPrice() - (getTotalPrice() * discountBenefit.value) / 100;
                            }
                            if (discountIncludeEquipment) {
                              finalEquipmentTotal = equipmentTotal - (equipmentTotal * discountBenefit.value) / 100;
                            }
                            if (discountIncludeService) {
                              finalServiceTotal = serviceTotal - (serviceTotal * discountBenefit.value) / 100;
                            }
                          }
                          
                          const transportTotalPreview = (parseFloat(transportEquipmentTotal || "0") || 0) + (parseFloat(transportPersonnelTotal || "0") || 0);
                          const totalBeforeCashback = finalFoodPrice + finalEquipmentTotal + finalServiceTotal + transportTotalPreview;
                          const cashbackAmount = cashbackBenefit ? (totalBeforeCashback * cashbackBenefit.value) / 100 : 0;
                          return (
                            <>
                              <div className="flex justify-between text-sm text-green-600">
                                <span>Кешбек ({cashbackBenefit?.value}%):</span>
                                <span>+{cashbackAmount.toLocaleString()} грн</span>
                              </div>
                              {useCashback && (
                                <div className="flex justify-between text-sm text-red-600">
                                  <span>Списано з бонусного рахунку:</span>
                                  <span>-{cashbackAmount.toLocaleString()} грн</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                        <div className="flex justify-between font-semibold text-lg border-t pt-2">
                          <span className="text-gray-900">Загальна сума:</span>
                          <span className="text-gray-900">
                            {(() => {
                              const discountAmount = calculateDiscountAmount();
                              const discountBenefit = selectedDiscountId ? benefits.find((b) => b.id === selectedDiscountId) : null;
                              
                              // Розраховуємо фінальні ціни з урахуванням знижки
                              let finalFoodPrice = getTotalPrice();
                              let finalEquipmentTotal = equipmentTotal;
                              let finalServiceTotal = serviceTotal;
                              
                              if (discountBenefit) {
                                if (discountIncludeMenu) {
                                  finalFoodPrice = getTotalPrice() - (getTotalPrice() * discountBenefit.value) / 100;
                                }
                                if (discountIncludeEquipment) {
                                  finalEquipmentTotal = equipmentTotal - (equipmentTotal * discountBenefit.value) / 100;
                                }
                                if (discountIncludeService) {
                                  finalServiceTotal = serviceTotal - (serviceTotal * discountBenefit.value) / 100;
                                }
                              }
                              
                              const transportTotalPreview = (parseFloat(transportEquipmentTotal || "0") || 0) + (parseFloat(transportPersonnelTotal || "0") || 0);
                          const totalBeforeCashback = finalFoodPrice + finalEquipmentTotal + finalServiceTotal + transportTotalPreview;
                              const cashbackAmount = selectedCashbackId
                                ? (() => {
                                    const cashbackBenefit = benefits.find((b) => b.id === selectedCashbackId);
                                    return cashbackBenefit ? (totalBeforeCashback * cashbackBenefit.value) / 100 : 0;
                                  })()
                                : 0;
                              const finalTotal = totalBeforeCashback - (useCashback ? cashbackAmount : 0);
                              return finalTotal.toLocaleString();
                            })()} грн
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => setStep(2)} variant="outline" className="w-full sm:w-auto">
              Назад
            </Button>
            <Button
              onClick={handleCreateKP}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 w-full sm:w-auto sm:flex-1"
              disabled={!selectedTemplateId || creatingKP}
            >
              {creatingKP ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Створення КП...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Створити КП
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}