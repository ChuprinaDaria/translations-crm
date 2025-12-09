import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { ChevronRight, Check, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import type { ClientCreate, ClientQuestionnaireUpdate, Item } from "../../lib/api";

interface Step10PreviewProps {
  clientData: ClientCreate;
  formData: ClientQuestionnaireUpdate;
  selectedEquipment: Item[];
  dishServingEquipment: Item[];
  hotSnacksEquipment: Item[];
  saladEquipment: Item[];
  customEquipmentNote: string;
  customDishServing: string;
  customHotSnacks: string;
  customSalad: string;
  onNavigateToStep: (stepIndex: number) => void;
}

export function Step10Preview({
  clientData,
  formData,
  selectedEquipment,
  dishServingEquipment,
  hotSnacksEquipment,
  saladEquipment,
  customEquipmentNote,
  customDishServing,
  customHotSnacks,
  customSalad,
  onNavigateToStep,
}: Step10PreviewProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return "—";
    return timeString;
  };

  // Парсинг форматів з JSON рядка або старого формату
  const parseEventFormats = (eventTypeStr?: string): Array<{ format: string; time?: string }> => {
    if (!eventTypeStr) return [];
    
    try {
      const parsed = JSON.parse(eventTypeStr);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      if (eventTypeStr.trim()) {
        return [{ format: eventTypeStr }];
      }
    }
    
    return [];
  };

  // Перевірка обов'язкових полів
  const getValidationStatus = () => {
    const errors: string[] = [];
    
    if (!clientData.name || !clientData.phone) {
      errors.push("Дані клієнта не заповнені");
    }
    const formats = parseEventFormats(formData.event_type);
    if (!formData.event_date || formats.length === 0) {
      errors.push("Дані заходу не заповнені");
    }
    if (!formData.location || !formData.contact_person || !formData.contact_phone) {
      errors.push("Дані локації не заповнені");
    }
    if (!formData.event_start_time || !formData.event_end_time) {
      errors.push("Тайминг не заповнений");
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const validation = getValidationStatus();

  const PreviewSection: React.FC<{
    title: string;
    stepIndex: number;
    children: React.ReactNode;
    hasError?: boolean;
  }> = ({
    title,
    stepIndex,
    children,
    hasError = false,
  }) => (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        hasError ? "border-red-300 bg-red-50/50" : "border-gray-200"
      }`}
      onClick={() => onNavigateToStep(stepIndex)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {hasError ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : (
              <Check className="w-5 h-5 text-green-500" />
            )}
            {title}
          </CardTitle>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );

  const InfoRow = ({ label, value }: { label: string; value: string | number | undefined | null }) => (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">
        {value || "—"}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Перевірте дані</h2>
        <p className="text-sm text-gray-600">
          Перевірте всі дані перед збереженням. Натисніть на секцію, щоб перейти до редагування.
        </p>
      </div>

      {!validation.isValid && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900 mb-1">
                Є незаповнені обов'язкові поля:
              </p>
              <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Крок 1: Клієнт */}
        <PreviewSection
          title="1. Дані клієнта"
          stepIndex={0}
          hasError={!clientData.name || !clientData.phone}
        >
          <div className="space-y-1">
            <InfoRow label="Ім'я" value={clientData.name} />
            <InfoRow label="Телефон" value={clientData.phone} />
            <InfoRow label="Email" value={clientData.email} />
            <InfoRow label="Компанія" value={clientData.company_name} />
          </div>
        </PreviewSection>

        {/* Крок 2: Захід */}
        <PreviewSection
          title="2. Захід"
          stepIndex={1}
          hasError={!formData.event_date || !formData.event_type}
        >
          <div className="space-y-1">
            {(() => {
              const formats = parseEventFormats(formData.event_type);
              if (formats.length > 0) {
                return (
                  <div className="py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Формати заходу:</span>
                    <div className="space-y-2 mt-2">
                      {formats.map((eventFormat, index) => (
                        <div key={index} className="pl-2 border-l-2 border-[#FF5A00]">
                          <div className="font-medium text-gray-900">{eventFormat.format}</div>
                          {eventFormat.time && (
                            <div className="text-sm text-gray-600 mt-1">⏰ {eventFormat.time}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            <InfoRow label="Дата заходу" value={formatDate(formData.event_date)} />
            <InfoRow
              label="Кількість гостей"
              value={(formData as any).guest_count || (formData as any).people_count}
            />
            {(formData as any).budget && (
              <InfoRow label="Бюджет" value={(formData as any).budget} />
            )}
          </div>
        </PreviewSection>

        {/* Крок 3: Локація */}
        <PreviewSection
          title="3. Локація"
          stepIndex={2}
          hasError={!formData.location || !formData.contact_person || !formData.contact_phone}
        >
          <div className="space-y-1">
            <InfoRow label="Точна локація" value={formData.location} />
            <InfoRow label="Контакт замовника" value={formData.contact_person} />
            <InfoRow label="Телефон контакту" value={formData.contact_phone} />
            <InfoRow label="Головний на локації" value={formData.on_site_contact} />
            <InfoRow label="Телефон на локації" value={formData.on_site_phone} />
          </div>
        </PreviewSection>

        {/* Крок 4: Тайминг */}
        <PreviewSection
          title="4. Тайминг"
          stepIndex={3}
          hasError={!formData.event_start_time || !formData.event_end_time}
        >
          <div className="space-y-1">
            <InfoRow label="Час початку" value={formatTime(formData.event_start_time)} />
            <InfoRow label="Час кінця" value={formatTime(formData.event_end_time)} />
            {formData.arrival_time && (
              <InfoRow label="Час заїзду" value={formData.arrival_time} />
            )}
            {formData.additional_services_timing && (
              <InfoRow
                label="Додаткові таймінги"
                value={formData.additional_services_timing}
              />
            )}
          </div>
        </PreviewSection>

        {/* Крок 5: Деталі */}
        <PreviewSection title="5. Деталі" stepIndex={4}>
          <div className="space-y-1">
            {selectedEquipment.length > 0 && (
              <div className="py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Обладнання:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedEquipment.map((eq) => (
                    <Badge
                      key={eq.id}
                      variant="outline"
                      className="bg-[#FF5A00]/10 text-[#FF5A00] border-[#FF5A00]"
                    >
                      {eq.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {customEquipmentNote && (
              <InfoRow label="Коментар до обладнання" value={customEquipmentNote} />
            )}
            <InfoRow label="Спосіб оплати" value={formData.payment_method} />
            <InfoRow label="Колір текстилю" value={formData.textile_color} />
            <InfoRow label="Колір оформлення лінії" value={formData.banquet_line_color} />
          </div>
        </PreviewSection>

        {/* Крок 6: Кухня */}
        <PreviewSection title="6. Кухня" stepIndex={5}>
          <div className="space-y-1">
            {dishServingEquipment.length > 0 && (
              <div className="py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Посуд для подачі:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {dishServingEquipment.map((eq) => (
                    <Badge key={eq.id} variant="outline" className="bg-blue-50 text-blue-700">
                      {eq.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {customDishServing && (
              <InfoRow label="Коментар до посуду" value={customDishServing} />
            )}
            {hotSnacksEquipment.length > 0 && (
              <div className="py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Гарячі закуски:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {hotSnacksEquipment.map((eq) => (
                    <Badge key={eq.id} variant="outline" className="bg-green-50 text-green-700">
                      {eq.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {customHotSnacks && (
              <InfoRow label="Коментар до закусок" value={customHotSnacks} />
            )}
            {saladEquipment.length > 0 && (
              <div className="py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Салати:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {saladEquipment.map((eq) => (
                    <Badge key={eq.id} variant="outline" className="bg-purple-50 text-purple-700">
                      {eq.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {customSalad && <InfoRow label="Коментар до салатів" value={customSalad} />}
            <InfoRow label="Алергії" value={formData.product_allergy} />
            <InfoRow label="Приготування закусок" value={formData.hot_snacks_prep} />
            <InfoRow label="Коментар до меню" value={formData.menu_notes} />
            <InfoRow label="Напої від замовника" value={formData.client_drinks_notes} />
            <InfoRow label="Їжа від замовника" value={formData.client_order_notes} />
          </div>
        </PreviewSection>

        {/* Крок 7: Заїзд */}
        <PreviewSection title="7. Заїзд" stepIndex={6}>
          <div className="space-y-1">
            <InfoRow label="Складність заїзду" value={formData.venue_complexity} />
            <InfoRow label="Поверх" value={formData.floor_number} />
            <InfoRow 
              label="Ліфт" 
              value={formData.elevator_available ? "Є" : formData.elevator_available === false ? "Немає" : undefined} 
            />
            <InfoRow label="Технічне приміщення" value={formData.technical_room} />
            <InfoRow label="Кухня" value={formData.kitchen_available} />
            <InfoRow 
              label="Фото локації" 
              value={formData.venue_photos ? "Є" : formData.venue_photos === false ? "Немає" : undefined} 
            />
            <InfoRow 
              label="Фото заїзду" 
              value={formData.arrival_photos ? "Є" : formData.arrival_photos === false ? "Немає" : undefined} 
            />
          </div>
        </PreviewSection>

        {/* Крок 8: Контент */}
        <PreviewSection title="8. Контент" stepIndex={7}>
          <div className="space-y-1">
            <InfoRow label="Фотозйомка" value={formData.photo_allowed} />
            <InfoRow label="Відеозйомка" value={formData.video_allowed} />
            <InfoRow label="Брендована продукція" value={formData.branded_products} />
          </div>
        </PreviewSection>

        {/* Крок 9: Замовник */}
        <PreviewSection title="9. Замовник" stepIndex={8}>
          <div className="space-y-1">
            <InfoRow label="Назва компанії" value={formData.client_company_name} />
            <InfoRow label="Вид діяльності" value={formData.client_activity_type} />
          </div>
        </PreviewSection>

        {/* Крок 10: Коментарі */}
        <PreviewSection title="10. Коментарі" stepIndex={9}>
          <div className="space-y-1">
            {formData.special_notes ? (
              <div className="py-2">
                <p className="text-sm text-gray-600 mb-1">Спеціальні примітки:</p>
                <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                  {formData.special_notes}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Немає коментарів</p>
            )}
          </div>
        </PreviewSection>
      </div>

      {/* Підказка */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          💡 Натисніть на будь-яку секцію вище, щоб перейти до редагування відповідного кроку.
        </p>
      </div>

      {/* Hidden validator for wizard */}
      <div style={{ display: 'none' }} data-valid={validation.isValid} />
    </div>
  );
}

