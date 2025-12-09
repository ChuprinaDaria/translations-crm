import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { QuestionnaireWizard } from "./QuestionnaireWizard";
import { Step1Client } from "./questionnaireSteps/Step1Client";
import { Step2Event } from "./questionnaireSteps/Step2Event";
import { Step3Location } from "./questionnaireSteps/Step3Location";
import { Step4Timing } from "./questionnaireSteps/Step4Timing";
import { Step5Details } from "./questionnaireSteps/Step5Details";
import { Step6Kitchen } from "./questionnaireSteps/Step6Kitchen";
import { Step7Arrival } from "./questionnaireSteps/Step7Arrival";
import { Step7Content } from "./questionnaireSteps/Step7Content";
import { Step8Client } from "./questionnaireSteps/Step8Client";
import { Step9Comments } from "./questionnaireSteps/Step9Comments";
import { Step10Preview } from "./questionnaireSteps/Step10Preview";
import {
  clientsApi,
  questionnairesApi,
  itemsApi,
  categoriesApi,
  type ClientCreate,
  type ClientQuestionnaireCreate,
  type ClientQuestionnaireUpdate,
  type Item,
  type ClientQuestionnaire,
} from "../lib/api";
import { useDebouncedCallback } from "../hooks/useDebounce";
import { getDefaultEventDate } from "../utils/questionnaireValidation";

interface QuestionnaireWizardFormProps {
  questionnaireId?: number;
  clientId?: number;
  onBack: () => void;
  onSave?: () => void;
}

export function QuestionnaireWizardForm({
  questionnaireId,
  clientId,
  onBack,
  onSave,
}: QuestionnaireWizardFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(!questionnaireId);

  // Дані клієнта
  const [clientData, setClientData] = useState<ClientCreate>({
    name: "",
    phone: "",
    email: "",
    company_name: "",
  });

  // Дані анкети
  const [formData, setFormData] = useState<ClientQuestionnaireUpdate>({
    event_date: getDefaultEventDate(),
  });

  // Обладнання
  const [allEquipment, setAllEquipment] = useState<Item[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Item[]>([]);
  const [customEquipmentNote, setCustomEquipmentNote] = useState("");

  // Обладнання для кухні
  const [dishServingEquipment, setDishServingEquipment] = useState<Item[]>([]);
  const [customDishServing, setCustomDishServing] = useState("");
  const [hotSnacksEquipment, setHotSnacksEquipment] = useState<Item[]>([]);
  const [customHotSnacks, setCustomHotSnacks] = useState("");
  const [saladEquipment, setSaladEquipment] = useState<Item[]>([]);
  const [customSalad, setCustomSalad] = useState("");

  // Фото заїзду
  const [venuePhotosUrls, setVenuePhotosUrls] = useState<string[]>([]);
  const [arrivalPhotosUrls, setArrivalPhotosUrls] = useState<string[]>([]);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  // Попередні анкети для швидкого заповнення
  const [previousQuestionnaires, setPreviousQuestionnaires] = useState<ClientQuestionnaire[]>([]);
  const [showQuickFillDialog, setShowQuickFillDialog] = useState(false);

  // Завантаження обладнання
  useEffect(() => {
    loadEquipment();
  }, []);

  // Завантаження попередніх анкет клієнта
  useEffect(() => {
    if (clientId) {
      loadPreviousQuestionnaires(clientId);
    }
  }, [clientId]);

  // Завантаження існуючої анкети або draft
  useEffect(() => {
    if (questionnaireId) {
      loadQuestionnaire();
    } else {
      // Перевіряємо чи є draft для нової анкети
      const draft = localStorage.getItem('questionnaire_draft_new');
      if (draft) {
        try {
          const draftData = JSON.parse(draft);
          if (draftData.data) {
            setFormData(draftData.data);
          }
          if (draftData.clientData) {
            setClientData(draftData.clientData);
          }
          toast.info("Знайдено незавершену анкету. Продовжити?");
        } catch (error) {
          console.error("Помилка завантаження draft:", error);
        }
      }
    }
  }, [questionnaireId]);

  const loadEquipment = async () => {
    try {
      const [itemsData, categoriesData] = await Promise.all([
        itemsApi.getItems(0, 1000),
        categoriesApi.getCategories(),
      ]);
      
      // Фільтруємо тільки обладнання (категорія "Обладнання")
      const equipmentCategory = categoriesData.find(cat => cat.name === "Обладнання");
      const equipmentItems = equipmentCategory
        ? itemsData.filter(item => item.subcategory?.category_id === equipmentCategory.id)
        : [];
      
      setAllEquipment(equipmentItems);
    } catch (error) {
      console.error("Помилка завантаження обладнання:", error);
    }
  };

  const loadPreviousQuestionnaires = async (clientId: number) => {
    try {
      const data = await questionnairesApi.getClientQuestionnaires(clientId);
      const questionnaires = data.questionnaires || [];
      setPreviousQuestionnaires(questionnaires);
      
      // Якщо є попередні анкети, показуємо діалог швидкого заповнення
      if (questionnaires.length > 0 && isCreatingNew) {
        setShowQuickFillDialog(true);
      }
    } catch (error) {
      console.error("Помилка завантаження попередніх анкет:", error);
    }
  };

  const loadQuestionnaire = async () => {
    if (!questionnaireId) return;
    
    try {
      setIsLoading(true);
      const data = await questionnairesApi.getById(questionnaireId);
      setFormData(data);
      
      // Завантажуємо дані клієнта якщо є
      if ((data as any).client_id) {
        const clientData = await clientsApi.getClient((data as any).client_id);
        const client = clientData.client;
        setClientData({
          name: client.name || "",
          phone: client.phone || "",
          email: client.email || "",
          company_name: client.company_name || "",
        });
      }
      
      // Парсимо обладнання
      if ((data as any).selected_equipment_ids && allEquipment.length > 0) {
        const ids = (data as any).selected_equipment_ids;
        const selected = allEquipment.filter(eq => ids.includes(eq.id));
        setSelectedEquipment(selected);
      }
      
      // Парсимо обладнання для кухні
      if ((data as any).dish_serving_equipment_ids && allEquipment.length > 0) {
        const ids = (data as any).dish_serving_equipment_ids;
        setDishServingEquipment(allEquipment.filter(eq => ids.includes(eq.id)));
      }
      if ((data as any).hot_snacks_equipment_ids && allEquipment.length > 0) {
        const ids = (data as any).hot_snacks_equipment_ids;
        setHotSnacksEquipment(allEquipment.filter(eq => ids.includes(eq.id)));
      }
      if ((data as any).salad_equipment_ids && allEquipment.length > 0) {
        const ids = (data as any).salad_equipment_ids;
        setSaladEquipment(allEquipment.filter(eq => ids.includes(eq.id)));
      }
      
      // Завантажуємо фото
      if ((data as any).venue_photos_urls) {
        setVenuePhotosUrls((data as any).venue_photos_urls || []);
      }
      if ((data as any).arrival_photos_urls) {
        setArrivalPhotosUrls((data as any).arrival_photos_urls || []);
      }
    } catch (error) {
      toast.error("Помилка завантаження анкети");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Швидке заповнення з попередньої анкети
  const handleQuickFill = (questionnaire: ClientQuestionnaire) => {
    // Заповнюємо основні поля
    if (questionnaire.event_date) setFormData(prev => ({ ...prev, event_date: questionnaire.event_date }));
    if (questionnaire.event_type) setFormData(prev => ({ ...prev, event_type: questionnaire.event_type }));
    if (questionnaire.location) setFormData(prev => ({ ...prev, location: questionnaire.location }));
    if (questionnaire.contact_person) setFormData(prev => ({ ...prev, contact_person: questionnaire.contact_person }));
    if (questionnaire.contact_phone) setFormData(prev => ({ ...prev, contact_phone: questionnaire.contact_phone }));
    if (questionnaire.on_site_contact) setFormData(prev => ({ ...prev, on_site_contact: questionnaire.on_site_contact }));
    if (questionnaire.on_site_phone) setFormData(prev => ({ ...prev, on_site_phone: questionnaire.on_site_phone }));
    if (questionnaire.event_start_time) setFormData(prev => ({ ...prev, event_start_time: questionnaire.event_start_time }));
    if (questionnaire.event_end_time) setFormData(prev => ({ ...prev, event_end_time: questionnaire.event_end_time }));
    if (questionnaire.payment_method) setFormData(prev => ({ ...prev, payment_method: questionnaire.payment_method }));
    if (questionnaire.textile_color) setFormData(prev => ({ ...prev, textile_color: questionnaire.textile_color }));
    if (questionnaire.banquet_line_color) setFormData(prev => ({ ...prev, banquet_line_color: questionnaire.banquet_line_color }));
    if (questionnaire.product_allergy) setFormData(prev => ({ ...prev, product_allergy: questionnaire.product_allergy }));
    if (questionnaire.hot_snacks_prep) setFormData(prev => ({ ...prev, hot_snacks_prep: questionnaire.hot_snacks_prep }));
    if (questionnaire.menu_notes) setFormData(prev => ({ ...prev, menu_notes: questionnaire.menu_notes }));
    if (questionnaire.client_drinks_notes) setFormData(prev => ({ ...prev, client_drinks_notes: questionnaire.client_drinks_notes }));
    if (questionnaire.client_order_notes) setFormData(prev => ({ ...prev, client_order_notes: questionnaire.client_order_notes }));
    if (questionnaire.photo_allowed) setFormData(prev => ({ ...prev, photo_allowed: questionnaire.photo_allowed }));
    if (questionnaire.video_allowed) setFormData(prev => ({ ...prev, video_allowed: questionnaire.video_allowed }));
    if (questionnaire.branded_products) setFormData(prev => ({ ...prev, branded_products: questionnaire.branded_products }));
    if (questionnaire.client_company_name) setFormData(prev => ({ ...prev, client_company_name: questionnaire.client_company_name }));
    if (questionnaire.client_activity_type) setFormData(prev => ({ ...prev, client_activity_type: questionnaire.client_activity_type }));
    if (questionnaire.special_notes) setFormData(prev => ({ ...prev, special_notes: questionnaire.special_notes }));
    
    setShowQuickFillDialog(false);
    toast.success("Дані з попередньої анкети заповнено!");
  };

  // Autosave з debounce
  const debouncedAutoSave = useDebouncedCallback(
    async (step: number, data: any) => {
      if (!isCreatingNew && questionnaireId) {
        try {
          await questionnairesApi.update(questionnaireId, formData);
          // Зберігаємо в localStorage як draft
          localStorage.setItem(`questionnaire_draft_${questionnaireId}`, JSON.stringify({
            step,
            data: formData,
            timestamp: new Date().toISOString(),
          }));
        } catch (error) {
          console.error("Помилка автозбереження:", error);
        }
      } else {
        // Зберігаємо draft в localStorage
        localStorage.setItem('questionnaire_draft_new', JSON.stringify({
          step,
          data: formData,
          clientData,
          timestamp: new Date().toISOString(),
        }));
      }
    },
    2000
  );

  // Завантаження фото
  const handlePhotoUpload = async (file: File, type: 'venue' | 'arrival') => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Файл занадто великий. Максимум 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (type === 'venue') {
        setVenuePhotosUrls(prev => [...prev, dataUrl]);
      } else {
        setArrivalPhotosUrls(prev => [...prev, dataUrl]);
      }
    };
    reader.readAsDataURL(file);
  };

  // Видалення фото
  const handlePhotoRemove = (index: number, type: 'venue' | 'arrival') => {
    if (type === 'venue') {
      setVenuePhotosUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      setArrivalPhotosUrls(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Перегляд фото
  const handlePhotoView = (url: string) => {
    setViewingPhoto(url);
  };

  // Збереження анкети
  const handleSave = async () => {
    try {
      setIsSaving(true);

      let finalClientId = clientId;

      // Створюємо клієнта якщо новий
      if (isCreatingNew && !clientId) {
        if (!clientData.name || !clientData.phone) {
          toast.error("Заповніть обов'язкові поля: ім'я та телефон клієнта");
          setIsSaving(false);
          return;
        }

        const createdClient = await clientsApi.createClient(clientData);
        finalClientId = createdClient.id;
        toast.success("Клієнта створено!");
      }

      if (!finalClientId) {
        toast.error("Помилка: не вказано клієнта");
        setIsSaving(false);
        return;
      }

      // Формуємо дані для збереження
      const equipmentText = [
        ...selectedEquipment.map(eq => eq.name),
        customEquipmentNote
      ].filter(Boolean).join('; ');

      const dishServingText = [
        ...dishServingEquipment.map(eq => eq.name),
        customDishServing
      ].filter(Boolean).join('; ');

      const hotSnacksText = [
        ...hotSnacksEquipment.map(eq => eq.name),
        customHotSnacks
      ].filter(Boolean).join('; ');

      const saladText = [
        ...saladEquipment.map(eq => eq.name),
        customSalad
      ].filter(Boolean).join('; ');

      const questionnaireData: ClientQuestionnaireUpdate = {
        ...formData,
        equipment_notes: equipmentText,
        selected_equipment_ids: selectedEquipment.map(eq => eq.id),
        dish_serving: dishServingText,
        dish_serving_equipment_ids: dishServingEquipment.map(eq => eq.id),
        hot_snacks_serving: hotSnacksText,
        hot_snacks_equipment_ids: hotSnacksEquipment.map(eq => eq.id),
        salad_serving: saladText,
        salad_equipment_ids: saladEquipment.map(eq => eq.id),
        venue_photos_urls: venuePhotosUrls.length > 0 ? venuePhotosUrls : undefined,
        arrival_photos_urls: arrivalPhotosUrls.length > 0 ? arrivalPhotosUrls : undefined,
      };

      if (questionnaireId) {
        // Оновлюємо існуючу анкету
        await questionnairesApi.update(questionnaireId, questionnaireData);
        toast.success("Анкету оновлено!");
      } else if (finalClientId) {
        // Створюємо нову анкету
        const createData: ClientQuestionnaireCreate = {
          ...questionnaireData,
          client_id: finalClientId,
        };
        await questionnairesApi.create(createData);
        toast.success("Анкету створено!");
        // Видаляємо draft
        localStorage.removeItem('questionnaire_draft_new');
      }

      if (onSave) {
        onSave();
      }
    } catch (error: any) {
      console.error("Помилка збереження анкети:", error);
      toast.error(error.message || "Помилка збереження анкети");
    } finally {
      setIsSaving(false);
    }
  };

  // Оновлення поля форми
  const updateField = useCallback((field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Автозбереження через debounce
      debouncedAutoSave(0, updated);
      return updated;
    });
  }, [debouncedAutoSave]);

  // Валідація кроків
  // Парсинг форматів для валідації
  const parseEventFormats = (eventTypeStr?: string): Array<{ format: string; time?: string }> => {
    if (!eventTypeStr) return [];
    
    try {
      const parsed = JSON.parse(eventTypeStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      if (eventTypeStr.trim()) {
        return [{ format: eventTypeStr }];
      }
    }
    
    return [];
  };

  const validateStep = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: // Клієнт
        return !!(clientData.name && clientData.phone);
      case 1: // Захід
        const formats = parseEventFormats(formData.event_type);
        return !!(formData.event_date && formats.length > 0 && (formData.guest_count || formData.people_count));
      case 2: // Локація
        return !!(formData.location && formData.contact_person && formData.contact_phone);
      case 3: // Тайминг
        return !!(formData.event_start_time && formData.event_end_time);
      default:
        return true; // Інші кроки опціональні
    }
  };

  // Ref для доступу до wizard для навігації
  const [wizardRef, setWizardRef] = useState<{ navigateToStep: (step: number) => void } | null>(null);

  const handleNavigateToStep = useCallback((stepIndex: number) => {
    // Навігація буде оброблена через ref
    if (wizardRef) {
      wizardRef.navigateToStep(stepIndex);
    }
  }, [wizardRef]);

  // Створюємо кроки для wizard
  const steps = [
    {
      id: 1,
      title: "Клієнт",
      component: (
        <Step1Client
          clientData={clientData}
          onChange={setClientData}
        />
      ),
      isValid: () => validateStep(0),
    },
    {
      id: 2,
      title: "Захід",
      component: (
        <Step2Event
          eventDate={formData.event_date || ""}
          eventType={formData.event_type || ""}
          guestCount={(formData.guest_count || formData.people_count)?.toString() || ""}
          budget={formData.budget}
          onChange={updateField}
        />
      ),
      isValid: () => validateStep(1),
    },
    {
      id: 3,
      title: "Локація",
      component: (
        <Step3Location
          location={formData.location || ""}
          contactPerson={formData.contact_person || ""}
          contactPhone={formData.contact_phone || ""}
          onSiteContact={formData.on_site_contact || ""}
          onSitePhone={formData.on_site_phone || ""}
          onChange={updateField}
        />
      ),
      isValid: () => validateStep(2),
    },
    {
      id: 4,
      title: "Тайминг",
      component: (
        <Step4Timing
          arrivalTime={formData.arrival_time || ""}
          eventStartTime={formData.event_start_time || ""}
          eventEndTime={formData.event_end_time || ""}
          additionalServicesTiming={formData.additional_services_timing || ""}
          onChange={updateField}
        />
      ),
      isValid: () => validateStep(3),
    },
    {
      id: 5,
      title: "Деталі",
      component: (
        <Step5Details
          selectedEquipment={selectedEquipment}
          allEquipment={allEquipment}
          customEquipmentNote={customEquipmentNote}
          paymentMethod={formData.payment_method || ""}
          textileColor={formData.textile_color || ""}
          banquetLineColor={formData.banquet_line_color || ""}
          onEquipmentChange={setSelectedEquipment}
          onCustomEquipmentChange={setCustomEquipmentNote}
          onFieldChange={updateField}
        />
      ),
      isValid: () => true,
    },
    {
      id: 6,
      title: "Кухня",
      component: (
        <Step6Kitchen
          dishServingEquipment={dishServingEquipment}
          hotSnacksEquipment={hotSnacksEquipment}
          saladEquipment={saladEquipment}
          allEquipment={allEquipment}
          customDishServing={customDishServing}
          customHotSnacks={customHotSnacks}
          customSalad={customSalad}
          allergies={formData.product_allergy || ""}
          hotSnacksPrep={formData.hot_snacks_prep || ""}
          menuNotes={formData.menu_notes || ""}
          clientDrinksNotes={formData.client_drinks_notes || ""}
          clientOrderNotes={formData.client_order_notes || ""}
          onDishServingChange={setDishServingEquipment}
          onHotSnacksChange={setHotSnacksEquipment}
          onSaladChange={setSaladEquipment}
          onCustomDishServingChange={setCustomDishServing}
          onCustomHotSnacksChange={setCustomHotSnacks}
          onCustomSaladChange={setCustomSalad}
          onFieldChange={updateField}
        />
      ),
      isValid: () => true,
    },
    {
      id: 7,
      title: "Заїзд",
      component: (
        <Step7Arrival
          venueComplexity={formData.venue_complexity || ""}
          floorNumber={formData.floor_number || ""}
          elevatorAvailable={formData.elevator_available || false}
          technicalRoom={formData.technical_room || ""}
          kitchenAvailable={formData.kitchen_available || ""}
          venuePhotos={formData.venue_photos || false}
          arrivalPhotos={formData.arrival_photos || false}
          venuePhotosUrls={venuePhotosUrls}
          arrivalPhotosUrls={arrivalPhotosUrls}
          onChange={updateField}
          onPhotoUpload={handlePhotoUpload}
          onPhotoRemove={handlePhotoRemove}
          onPhotoView={handlePhotoView}
        />
      ),
      isValid: () => true,
    },
    {
      id: 8,
      title: "Контент",
      component: (
        <Step7Content
          photoAllowed={formData.photo_allowed || ""}
          videoAllowed={formData.video_allowed || ""}
          brandedProducts={formData.branded_products || ""}
          onFieldChange={updateField}
        />
      ),
      isValid: () => true,
    },
    {
      id: 9,
      title: "Замовник",
      component: (
        <Step8Client
          clientCompanyName={formData.client_company_name || ""}
          clientActivityType={formData.client_activity_type || ""}
          onFieldChange={updateField}
        />
      ),
      isValid: () => true,
    },
    {
      id: 10,
      title: "Коментарі",
      component: (
        <Step9Comments
          specialNotes={formData.special_notes || ""}
          onFieldChange={updateField}
        />
      ),
      isValid: () => true,
    },
    {
      id: 11,
      title: "Перегляд",
      component: (
        <Step10Preview
          clientData={clientData}
          formData={formData}
          selectedEquipment={selectedEquipment}
          dishServingEquipment={dishServingEquipment}
          hotSnacksEquipment={hotSnacksEquipment}
          saladEquipment={saladEquipment}
          customEquipmentNote={customEquipmentNote}
          customDishServing={customDishServing}
          customHotSnacks={customHotSnacks}
          customSalad={customSalad}
          onNavigateToStep={handleNavigateToStep}
        />
      ),
      isValid: () => true,
    },
  ];

  // Діалог швидкого заповнення
  const QuickFillDialog = () => {
    if (!showQuickFillDialog || previousQuestionnaires.length === 0) return null;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
          <h3 className="text-lg font-semibold">Швидке заповнення</h3>
          <p className="text-sm text-gray-600">
            Використати дані з попередньої анкети?
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {previousQuestionnaires.slice(0, 3).map((q) => (
              <button
                key={q.id}
                onClick={() => handleQuickFill(q)}
                className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium">
                  {q.event_date ? new Date(q.event_date).toLocaleDateString("uk-UA") : "Без дати"}
                </div>
                <div className="text-sm text-gray-600">
                  {q.event_type || "Без формату"} • {q.location || "Без локації"}
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowQuickFillDialog(false)}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Пропустити
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5A00] mx-auto mb-4"></div>
          <p className="text-gray-600">Завантаження...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <QuestionnaireWizard
        steps={steps}
        onSave={handleSave}
        onCancel={onBack}
        autoSave={debouncedAutoSave}
        onRef={setWizardRef}
      />
      <QuickFillDialog />
      
      {/* Діалог перегляду фото */}
      {viewingPhoto && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <button
            onClick={() => setViewingPhoto(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={viewingPhoto} 
            alt="Photo preview" 
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

