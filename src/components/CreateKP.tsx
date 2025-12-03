import React, { useState, useEffect } from "react";
import { Plus, Search, X, Send, FileText, ChevronRight, Loader2 } from "lucide-react";
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
  kpApi,
  templatesApi,
  menusApi,
  clientsApi,
  benefitsApi,
  getImageUrl,
  type Item,
  type Category,
  type Template as ApiTemplate,
  type Menu,
  type Client,
  type Benefit,
} from "../lib/api";

interface Dish {
  id: number;
  name: string;
  description: string;
  weight: number;
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
}

// Формат заходу в UI (локальний стан)
interface UIEventFormat {
  id: number; // локальний ID (індекс)
  name: string;
  eventTime: string;
  peopleCount: string;
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
  const [transportTotal, setTransportTotal] = useState<string>("");
  // Кілька форматів заходу (Welcome drink, Фуршет тощо)
  const [eventFormats, setEventFormats] = useState<UIEventFormat[]>([]);
  
  // State for dishes from API
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clientSelectionMode, setClientSelectionMode] = useState<"existing" | "new">("new");
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<number | null>(null);
  const [selectedCashbackId, setSelectedCashbackId] = useState<number | null>(null);
  const [useCashback, setUseCashback] = useState(false);
  // Налаштування знижки: що включати в знижку
  const [discountIncludeMenu, setDiscountIncludeMenu] = useState(true);
  const [discountIncludeEquipment, setDiscountIncludeEquipment] = useState(false);
  const [discountIncludeService, setDiscountIncludeService] = useState(false);

  // Функція для валідації кроку 1 (без показу помилок)
  const isStep1Valid = (): boolean => {
    if (clientSelectionMode === "existing" && !selectedClientId) {
      return false;
    }
    return !!(clientName && eventDate && guestCount && eventGroup && eventFormat);
  };

  // Функція для валідації кроку 1 з показом помилок
  const validateStep1 = (): boolean => {
    if (clientSelectionMode === "existing" && !selectedClientId) {
      toast.error("Будь ласка, оберіть клієнта зі списку");
      return false;
    }
    if (!clientName || !eventDate || !guestCount) {
      toast.error("Будь ласка, заповніть всі обов'язкові дані клієнта та заходу");
      return false;
    }
    if (!eventGroup) {
      toast.error("Оберіть групу формату заходу");
      return false;
    }
    if (!eventFormat) {
      toast.error("Вкажіть формат заходу");
      return false;
    }
    return true;
  };

  // Функція для валідації кроку 2
  const validateStep2 = (): boolean => {
    if (selectedDishes.length === 0) {
      toast.error("Будь ласка, оберіть хоча б одну страву");
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
      transportTotal,
      selectedTemplateId,
      selectedDiscountId,
      selectedCashbackId,
      useCashback,
      discountIncludeMenu,
      discountIncludeEquipment,
      discountIncludeService,
      eventFormats,
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
        setTransportTotal(formData.transportTotal || "");
        setSelectedTemplateId(formData.selectedTemplateId || null);
        setSelectedDiscountId(formData.selectedDiscountId || null);
        setSelectedCashbackId(formData.selectedCashbackId || null);
        setUseCashback(formData.useCashback || false);
        setDiscountIncludeMenu(formData.discountIncludeMenu !== undefined ? formData.discountIncludeMenu : true);
        setDiscountIncludeEquipment(formData.discountIncludeEquipment || false);
        setDiscountIncludeService(formData.discountIncludeService || false);
        setEventFormats(formData.eventFormats || []);
      } catch (error) {
        console.error("Помилка завантаження даних з localStorage:", error);
      }
    }
  };

  // Завантаження даних при ініціалізації
  useEffect(() => {
    loadFormDataFromLocalStorage();
  }, []);

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
    transportTotal,
    selectedTemplateId,
    selectedDiscountId,
    selectedCashbackId,
    useCashback,
    discountIncludeMenu,
    discountIncludeEquipment,
    discountIncludeService,
    eventFormats,
  ]);

  // Load dishes from API
  useEffect(() => {
    const loadDishes = async () => {
      setLoading(true);
      try {
        const [itemsData, categoriesData] = await Promise.all([
          itemsApi.getItems(0, 1000),
          categoriesApi.getCategories(),
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
        setClients(clientsData);
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
        setSelectedDiscountId(kp.discount_id || null);
        setSelectedCashbackId(kp.cashback_id || null);
        setUseCashback(kp.use_cashback || false);
        setDiscountIncludeMenu(kp.discount_include_menu !== undefined ? kp.discount_include_menu : true);
        setDiscountIncludeEquipment(kp.discount_include_equipment || false);
        setDiscountIncludeService(kp.discount_include_service || false);

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

  const filteredDishes = dishes.filter((dish) => {
    const matchesSearch =
      dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dish.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.some((tag) => dish.category.includes(tag));
    return matchesSearch && matchesTags;
  });

  const toggleDish = (dishId: number) => {
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
    return dishes.filter((dish) => selectedDishes.includes(dish.id));
  };

  const getTotalPrice = () => {
    return getSelectedDishesData().reduce((sum, dish) => {
      const qty = dishQuantities[dish.id] ?? 1;
      return sum + dish.price * qty;
    }, 0);
  };

  const getTotalWeight = () => {
    // Розраховуємо загальну вагу в грамах
    return getSelectedDishesData().reduce((sum, dish) => {
      const qty = dishQuantities[dish.id] ?? 1;
      let weightInGrams = dish.weight || 0;
      const unit = (dish.unit || 'кг').toLowerCase();
      
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

  const getWeightPerPerson = () => {
    const totalWeight = getTotalWeight();
    const peopleCountNum = guestCount ? parseInt(guestCount, 10) || 0 : 0;
    if (totalWeight > 0 && peopleCountNum > 0) {
      return totalWeight / peopleCountNum;
    }
    return 0;
  };

  const calculateAdditionalTotal = (items: AdditionalItem[]) =>
    items.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
      0
    );

  const equipmentTotal = calculateAdditionalTotal(equipmentItems);
  const serviceTotal = calculateAdditionalTotal(serviceItems);

  const foodTotalPrice = getTotalPrice();

  // Функція для розрахунку знижки з урахуванням вибраних опцій
  const calculateDiscountAmount = () => {
    if (!selectedDiscountId) return 0;
    
    const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
    if (!discountBenefit) return 0;
    
    let discountBase = 0;
    if (discountIncludeMenu) {
      discountBase += foodTotalPrice;
    }
    if (discountIncludeEquipment) {
      discountBase += equipmentTotal;
    }
    if (discountIncludeService) {
      discountBase += serviceTotal;
    }
    
    return (discountBase * discountBenefit.value) / 100;
  };
  const peopleCountNum = guestCount ? parseInt(guestCount, 10) || 0 : 0;
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

    const peopleCountNum = parseInt(guestCount, 10) || 0;
    const foodTotalPrice = getTotalPrice();
    const transportTotalNum = parseFloat(transportTotal || "0") || 0;
    
    // Розрахунок знижки з урахуванням вибраних опцій
    let discountAmount = calculateDiscountAmount();
    
    // Розраховуємо фінальні ціни з урахуванням знижки
    let finalFoodPrice = foodTotalPrice;
    let finalEquipmentTotal = equipmentTotal;
    let finalServiceTotal = serviceTotal;
    
    if (selectedDiscountId) {
      const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
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

    const itemsPayload = getSelectedDishesData().map((dish) => ({
      item_id: dish.id,
      quantity: dishQuantities[dish.id] || 1,
      // Поки що не розподіляємо страви по форматах, тому event_format_id не задаємо
    }));

    setCreatingKP(true);
    try {
      const kpData = {
        title,
        people_count: peopleCountNum,
        event_group: eventGroup || undefined,
        client_name: clientName || undefined,
        event_format: eventFormat || undefined,
        event_date: eventDate ? new Date(eventDate).toISOString() : undefined,
        event_location: eventLocation || undefined,
        event_time: eventTime || undefined,
        coordinator_name: coordinatorName || undefined,
        coordinator_phone: coordinatorPhone || undefined,
        total_price: totalPrice,
        price_per_person:
          peopleCountNum > 0 ? totalPrice / peopleCountNum : undefined,
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
        discount_id: selectedDiscountId || undefined,
        cashback_id: selectedCashbackId || undefined,
        use_cashback: useCashback,
        discount_amount: discountAmount > 0 ? discountAmount : undefined,
        cashback_amount: cashbackAmount > 0 ? cashbackAmount : undefined,
        discount_include_menu: discountIncludeMenu,
        discount_include_equipment: discountIncludeEquipment,
        discount_include_service: discountIncludeService,
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
      setTransportTotal("");
      setClientName("");
      setEventGroup("");
      setEventDate("");
      setEventFormat("");
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
      setTransportTotal("");
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
                        if (client.event_time) {
                          setEventTime(client.event_time);
                        }
                      }
                    }}
                  >
                    <SelectTrigger id="select-client">
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
                    onChange={(e) => setClientName(e.target.value)}
                    disabled={clientSelectionMode === "existing" && !selectedClientId}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-group">Група формату</Label>
                  <Select
                    value={eventGroup}
                    onValueChange={(value) => {
                      setEventGroup(value as "delivery-boxes" | "catering" | "other");
                      // Скидаємо детальний формат при зміні групи
                      setEventFormat("");
                    }}
                  >
                    <SelectTrigger id="event-group">
                      <SelectValue placeholder="Оберіть групу формату" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delivery-boxes">Доставка боксів</SelectItem>
                      <SelectItem value="catering">Кейтерінг</SelectItem>
                      <SelectItem value="other">Інше</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-format">Формат заходу</Label>
                  {eventGroup === "catering" && (
                    <Select
                      value={eventFormat}
                      onValueChange={(value) => setEventFormat(value)}
                    >
                      <SelectTrigger id="event-format">
                        <SelectValue placeholder="Оберіть формат кейтерінгу" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Доставка готових страв">
                          Доставка готових страв
                        </SelectItem>
                        <SelectItem value="Доставка обідів">
                          Доставка обідів
                        </SelectItem>
                        <SelectItem value="Кава-брейк">Кава-брейк</SelectItem>
                        <SelectItem value="Фуршет">Фуршет</SelectItem>
                        <SelectItem value="Банкет">Банкет</SelectItem>
                        <SelectItem value="Комплексне обслуговування">
                          Комплексне обслуговування
                        </SelectItem>
                        <SelectItem value="Доставка з накриттям (фуршет/банкет)">
                          Доставка з накриттям (фуршет/банкет)
                        </SelectItem>
                        <SelectItem value="Бар кейтерінг">Бар кейтерінг</SelectItem>
                        <SelectItem value="Су-від">Су-від</SelectItem>
                        <SelectItem value="Оренда обладнання/персоналу">
                          Оренда обладнання/персоналу
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {eventGroup === "delivery-boxes" && (
                    <Input
                      id="event-format"
                      value={eventFormat || "Доставка боксів"}
                      onChange={(e) => setEventFormat(e.target.value)}
                      placeholder="Доставка боксів"
                    />
                  )}
                  {eventGroup === "other" && (
                    <Input
                      id="event-format"
                      value={eventFormat}
                      onChange={(e) => setEventFormat(e.target.value)}
                      placeholder="Опишіть формат (Інше)"
                    />
                  )}
                  {!eventGroup && (
                    <p className="text-xs text-gray-500">
                      Спочатку оберіть групу формату (Доставка боксів / Кейтерінг / Інше).
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-date">
                    Дата події <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="event-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-time">Час події</Label>
                  <Input
                    id="event-time"
                    placeholder="17:00–19:00"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                  />
              </div>
              </div>
              
              {/* Декілька форматів заходу */}
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Формати заходу (опційно)
                    </p>
                    <p className="text-xs text-gray-500">
                      Ви можете додати кілька форматів (наприклад, Welcome drink, Фуршет) зі своїм часом та кількістю гостей.
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
                        },
                      ]);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Додати формат
                  </Button>
                </div>

                {eventFormats.length > 0 && (
                  <div className="space-y-2">
                    {eventFormats.map((format) => (
                      <div
                        key={format.id}
                        className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end p-3 bg-white rounded-lg border"
                      >
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Назва формату</Label>
                          <Input
                            value={format.name}
                            onChange={(e) =>
                              setEventFormats((prev) =>
                                prev.map((f) =>
                                  f.id === format.id ? { ...f, name: e.target.value } : f
                                )
                              )
                            }
                            placeholder="Welcome drink / Фуршет"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-600">Час</Label>
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
                          />
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
                                }))
                              )
                            }
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guest-count">
                  Кількість гостей <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="guest-count"
                  type="number"
                  placeholder="50"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-location">Місце проведення</Label>
                  <Input
                    id="event-location"
                    placeholder="м. Київ, вул. Короленківська 4"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                  />
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
                  <Label htmlFor="coordinator-name">Координатор</Label>
                  <Input
                    id="coordinator-name"
                    placeholder="Ім'я координатора"
                    value={coordinatorName}
                    onChange={(e) => setCoordinatorName(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="coordinator-phone">Телефон координатора</Label>
                  <Input
                    id="coordinator-phone"
                    type="tel"
                    placeholder="+380..."
                    value={coordinatorPhone}
                    onChange={(e) => setCoordinatorPhone(e.target.value)}
                  />
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto p-1">
                      {filteredDishes.map((dish) => {
                        const isSelected = selectedDishes.includes(dish.id);
                        return (
                          <div
                            key={dish.id}
                            onClick={() => toggleDish(dish.id)}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              isSelected
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
                                  <Checkbox checked={isSelected} />
                                </div>
                                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                  {dish.description}
                                </p>
                                <div className="flex items-center justify-between">
                                  <div className="text-sm text-gray-600">
                                    {dish.weight > 0 ? `${dish.weight}${dish.unit}` : '-'}
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
                    {equipmentItems.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900">
                            Позицій: {equipmentItems.length}
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
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-center justify-between gap-4">
                    <span className="text-gray-700 font-medium">
                      Транспортні витрати (загальна сума), грн
                    </span>
                    <Input
                      className="w-40 text-right"
                      type="number"
                      value={transportTotal}
                      onChange={(e) => setTransportTotal(e.target.value)}
                      placeholder="0"
                    />
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
                {selectedDishes.length === 0 ? (
                  <p className="text-gray-500">
                    Страви не обрано. Поверніться на крок &quot;Вибір страв&quot;.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b bg-[#FF5A00] text-white">
                            <th className="py-3 px-4 text-left font-semibold">Страва</th>
                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Вихід на стіл,<br />порція/вага, гр.</th>
                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Кіл-сть<br />порцій</th>
                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Ціна,<br />грн</th>
                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Сума,<br />грн</th>
                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Вихід грам<br />на особу</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getSelectedDishesData().map((dish) => {
                            const qty = dishQuantities[dish.id] ?? 1;
                            const total = qty * dish.price;
                            const peopleCountNum = parseInt(guestCount, 10) || 1;
                            const weightPerPerson = dish.weight && qty > 0 && peopleCountNum > 0 
                              ? (dish.weight * qty / peopleCountNum).toFixed(2)
                              : "0.00";
                            return (
                              <tr key={dish.id} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-3 px-4 text-left">{dish.name}</td>
                                <td className="py-3 px-4 text-right">
                                  {dish.weight > 0 ? `${dish.weight} ${dish.unit || 'г'}` : "-"}
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
                                <td className="py-3 px-4 text-right">{dish.price.toFixed(2)}</td>
                                <td className="py-3 px-4 text-right font-medium">{total.toFixed(2)}</td>
                                <td className="py-3 px-4 text-right">{weightPerPerson}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">
                          Вартість страв (усі позиції)
                        </div>
                        {selectedDiscountId ? (() => {
                          const discountAmount = calculateDiscountAmount();
                          // Розраховуємо знижку тільки на меню для відображення в цьому блоці
                          const menuDiscountAmount = discountIncludeMenu 
                            ? (() => {
                                const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
                                return discountBenefit ? (foodTotalPrice * discountBenefit.value) / 100 : 0;
                              })()
                            : 0;
                          const finalFoodPrice = foodTotalPrice - menuDiscountAmount;
                          return (
                            <>
                              <div className="text-xs text-gray-500 line-through mb-1">
                                {foodTotalPrice.toLocaleString()} грн
                              </div>
                              <div className="text-xs text-[#FF5A00] mb-1">
                                Знижка: -{menuDiscountAmount.toLocaleString()} грн
                              </div>
                              <div className="text-lg font-semibold text-gray-900">
                                {finalFoodPrice.toLocaleString()} грн
                              </div>
                            </>
                          );
                        })() : (
                          <div className="text-lg font-semibold text-gray-900">
                            {foodTotalPrice.toLocaleString()} грн
                          </div>
                        )}
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
                          {peopleCountNum > 0
                            ? (selectedDiscountId ? (() => {
                                const menuDiscountAmount = discountIncludeMenu 
                                  ? (() => {
                                      const discountBenefit = benefits.find((b) => b.id === selectedDiscountId);
                                      return discountBenefit ? (foodTotalPrice * discountBenefit.value) / 100 : 0;
                                    })()
                                  : 0;
                                const finalFoodPrice = foodTotalPrice - menuDiscountAmount;
                                return (finalFoodPrice / peopleCountNum).toFixed(2);
                              })() : (foodTotalPrice / peopleCountNum).toFixed(2))
                            : "-"}{" "}
                          грн
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">
                          Орієнтовний вихід на 1 гостя
                        </div>
                        <div className="text-lg font-semibold text-gray-900">
                          {peopleCountNum > 0
                            ? getWeightPerPerson().toFixed(0)
                            : "-"}{" "}
                          г
                        </div>
                      </div>
                    </div>

                    {/* Discount and Cashback Selection */}
                    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border mt-6">
                      <h3 className="text-gray-900 font-medium">Знижка та кешбек</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="discount-select-step5">Знижка</Label>
                          <Select
                            value={selectedDiscountId?.toString() || ""}
                            onValueChange={(value) => {
                              const id = parseInt(value);
                              setSelectedDiscountId(id);
                              // Якщо обрано знижку, скидаємо кешбек
                              if (id) {
                                setSelectedCashbackId(null);
                                setUseCashback(false);
                              }
                            }}
                          >
                            <SelectTrigger id="discount-select-step5">
                              <SelectValue placeholder="Оберіть знижку" />
                            </SelectTrigger>
                            <SelectContent>
                              {benefits
                                .filter((b) => b.type === "discount" && b.is_active)
                                .map((benefit) => (
                                  <SelectItem key={benefit.id} value={benefit.id.toString()}>
                                    {benefit.name} ({benefit.value}%)
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          {selectedDiscountId && (
                            <div className="mt-3 space-y-2 pt-2 border-t">
                              <Label className="text-sm text-gray-700">Включити в знижку:</Label>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="discount-include-menu"
                                    checked={discountIncludeMenu}
                                    onCheckedChange={(checked) => setDiscountIncludeMenu(checked as boolean)}
                                  />
                                  <Label htmlFor="discount-include-menu" className="cursor-pointer text-sm">
                                    Меню
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="discount-include-equipment"
                                    checked={discountIncludeEquipment}
                                    onCheckedChange={(checked) => setDiscountIncludeEquipment(checked as boolean)}
                                  />
                                  <Label htmlFor="discount-include-equipment" className="cursor-pointer text-sm">
                                    Обладнання
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="discount-include-service"
                                    checked={discountIncludeService}
                                    onCheckedChange={(checked) => setDiscountIncludeService(checked as boolean)}
                                  />
                                  <Label htmlFor="discount-include-service" className="cursor-pointer text-sm">
                                    Сервіс
                                  </Label>
                                </div>
                              </div>
                            </div>
                          )}
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
                        const totalBeforeCashback = foodPrice + equipmentPrice + servicePrice + (parseFloat(transportTotal || "0") || 0);
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
                  <div className="space-y-1">
                    <p className="text-gray-500">Клієнт</p>
                    <p className="text-gray-900 font-medium">{clientName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">Формат</p>
                    <p className="text-gray-900 font-medium">
                      {eventFormat || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">Дата заходу</p>
                    <p className="text-gray-900 font-medium">
                      {eventDate || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">Час</p>
                    <p className="text-gray-900 font-medium">
                      {eventTime || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">Кількість гостей</p>
                    <p className="text-gray-900 font-medium">
                      {guestCount || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">Місце проведення</p>
                    <p className="text-gray-900 font-medium">
                      {eventLocation || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">Координатор</p>
                    <p className="text-gray-900 font-medium">
                      {coordinatorName || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">Телефон координатора</p>
                    <p className="text-gray-900 font-medium">
                      {coordinatorPhone || "-"}
                    </p>
                  </div>
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
                      {transportTotal || "0"} грн
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
                            {peopleCountNum > 0
                              ? getWeightPerPerson().toFixed(0)
                              : "-"}{" "}
                            г
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

                {/* Preview */}
                <div className="border-t pt-6">
                  <h3 className="text-gray-900 mb-4">Попередній перегляд КП</h3>
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
                        <span className="text-gray-900 ml-2">{guestCount}</span>
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
                          
                          const totalBeforeCashback = finalFoodPrice + finalEquipmentTotal + finalServiceTotal + (parseFloat(transportTotal || "0") || 0);
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
                              
                              const totalBeforeCashback = finalFoodPrice + finalEquipmentTotal + finalServiceTotal + (parseFloat(transportTotal || "0") || 0);
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