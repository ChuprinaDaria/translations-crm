import { useState, useEffect, useCallback } from "react";
import { ChecklistCreate, ChecklistUpdate, Checklist } from "../lib/api";

export interface ValidationErrors {
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  event_date?: string;
}

export interface UseChecklistFormProps {
  checklist?: Checklist | null;
  checklistType: "box" | "catering";
  onAutoSave?: (data: ChecklistCreate) => void;
  autoSaveDelay?: number;
}

export function useChecklistForm({
  checklist,
  checklistType,
  onAutoSave,
  autoSaveDelay = 1000,
}: UseChecklistFormProps) {
  const [formData, setFormData] = useState<ChecklistCreate>({
    checklist_type: checklistType,
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    event_date: "",
    event_format: "",
    event_reason: "",
    order_number: "",
    delivery_time: "",
    event_duration: "",
    needs_courier: false,
    personnel_notes: "",
    location_address: "",
    location_floor: "",
    location_elevator: false,
    guest_count: undefined,
    budget: "",
    budget_amount: undefined,
    equipment_furniture: false,
    equipment_tablecloths: false,
    equipment_disposable_dishes: false,
    equipment_glass_dishes: false,
    equipment_notes: "",
    food_hot: false,
    food_cold: false,
    food_salads: false,
    food_garnish: false,
    food_sweet: false,
    food_vegetarian: false,
    food_vegan: false,
    food_preference: "",
    food_notes: "",
    general_comment: "",
    drinks_notes: "",
    alcohol_notes: "",
    discount_notes: "",
    surcharge_notes: "",
    status: "draft",
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Завантаження даних при редагуванні
  useEffect(() => {
    if (checklist) {
      setFormData({
        ...formData,
        ...checklist,
        checklist_type: checklistType,
      });
    }
  }, [checklist]);

  // Автозбереження з debounce
  useEffect(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    if (onAutoSave && (formData.contact_name || formData.contact_phone || formData.event_date)) {
      const timer = setTimeout(() => {
        onAutoSave(formData);
      }, autoSaveDelay);
      setAutoSaveTimer(timer);
    }

    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [formData, autoSaveDelay]);

  // Маска телефону +380 XX XXX XX XX
  const formatPhoneNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, "");
    
    if (cleaned.length === 0) return "";
    
    let formatted = "+380";
    
    if (cleaned.length > 3) {
      const part1 = cleaned.slice(3, 5);
      formatted += ` ${part1}`;
      
      if (cleaned.length > 5) {
        const part2 = cleaned.slice(5, 8);
        formatted += ` ${part2}`;
        
        if (cleaned.length > 8) {
          const part3 = cleaned.slice(8, 10);
          formatted += ` ${part3}`;
          
          if (cleaned.length > 10) {
            const part4 = cleaned.slice(10, 12);
            formatted += ` ${part4}`;
          }
        }
      }
    }
    
    return formatted;
  };

  // Оновлення поля
  const updateField = useCallback((field: keyof ChecklistCreate, value: any) => {
    setFormData((prev) => {
      let processedValue = value;
      
      // Маска для телефону
      if (field === "contact_phone" && typeof value === "string") {
        processedValue = formatPhoneNumber(value);
      }
      
      return { ...prev, [field]: processedValue };
    });
    
    // Очищаємо помилку при зміні поля
    if (errors[field as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  // Валідація email
  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Email не обов'язковий
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Валідація телефону
  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length === 12 && cleaned.startsWith("380");
  };

  // Отримати повідомлення про помилку телефону
  const getPhoneErrorMessage = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, "");
    if (!cleaned.startsWith("380")) {
      return "Номер має починатися з +380";
    }
    if (cleaned.length < 12) {
      const missing = 12 - cleaned.length;
      return `Не вистачає ${missing} цифр${missing === 1 ? 'и' : ''}`;
    }
    if (cleaned.length > 12) {
      return "Забагато цифр у номері";
    }
    return "Невірний формат телефону";
  };

  // Валідація всієї форми
  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Обов'язкові поля
    if (!formData.contact_name || formData.contact_name.trim() === "") {
      newErrors.contact_name = "Ім'я контакту обов'язкове";
    }

    if (!formData.contact_phone || formData.contact_phone.trim() === "") {
      newErrors.contact_phone = "Телефон обов'язковий";
    } else if (!validatePhone(formData.contact_phone)) {
      newErrors.contact_phone = getPhoneErrorMessage(formData.contact_phone);
    }

    if (!formData.event_date || formData.event_date.trim() === "") {
      newErrors.event_date = "Дата події обов'язкова";
    }

    // Email валідація (якщо заповнений)
    if (formData.contact_email && !validateEmail(formData.contact_email)) {
      newErrors.contact_email = "Невірний формат email";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Валідація конкретного табу
  const validateTab = (tabIndex: number): boolean => {
    const newErrors: ValidationErrors = {};

    switch (tabIndex) {
      case 0: // Контакт
        if (!formData.contact_name || formData.contact_name.trim() === "") {
          newErrors.contact_name = "Ім'я контакту обов'язкове";
        }
        if (!formData.contact_phone || formData.contact_phone.trim() === "") {
          newErrors.contact_phone = "Телефон обов'язковий";
        } else if (!validatePhone(formData.contact_phone)) {
          newErrors.contact_phone = getPhoneErrorMessage(formData.contact_phone);
        }
        if (formData.contact_email && !validateEmail(formData.contact_email)) {
          newErrors.contact_email = "Невірний формат email";
        }
        break;
      
      case 1: // Подія
        if (!formData.event_date || formData.event_date.trim() === "") {
          newErrors.event_date = "Дата події обов'язкова";
        }
        break;
      
      // Локація та Деталі не мають обов'язкових полів
      case 2:
      case 3:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Скидання форми
  const resetForm = () => {
    setFormData({
      checklist_type: checklistType,
      contact_name: "",
      contact_phone: "",
      contact_email: "",
      event_date: "",
      event_format: "",
      event_reason: "",
      order_number: "",
      delivery_time: "",
      event_duration: "",
      needs_courier: false,
      personnel_notes: "",
      location_address: "",
      location_floor: "",
      location_elevator: false,
      guest_count: undefined,
      budget: "",
      budget_amount: undefined,
      equipment_furniture: false,
      equipment_tablecloths: false,
      equipment_disposable_dishes: false,
      equipment_glass_dishes: false,
      equipment_notes: "",
      food_hot: false,
      food_cold: false,
      food_salads: false,
      food_garnish: false,
      food_sweet: false,
      food_vegetarian: false,
      food_vegan: false,
      food_preference: "",
      food_notes: "",
      general_comment: "",
      drinks_notes: "",
      alcohol_notes: "",
      discount_notes: "",
      surcharge_notes: "",
      status: "draft",
    });
    setErrors({});
  };

  return {
    formData,
    errors,
    updateField,
    validate,
    validateTab,
    resetForm,
  };
}

