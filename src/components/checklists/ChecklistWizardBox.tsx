import { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Package,
  User,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Utensils,
  MessageSquare,
  Truck,
  Loader2,
  Save,
  X
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Switch } from "../ui/switch";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { checklistsApi, Checklist, ChecklistCreate, ChecklistUpdate } from "../../lib/api";

interface ChecklistWizardBoxProps {
  checklist?: Checklist | null;
  onSave: () => void;
  onCancel: () => void;
}

const STEPS = [
  { id: 1, title: "Контакт", icon: User },
  { id: 2, title: "Подія", icon: Calendar },
  { id: 3, title: "Локація", icon: MapPin },
  { id: 4, title: "Деталі", icon: Users },
  { id: 5, title: "Страви", icon: Utensils },
  { id: 6, title: "Додатково", icon: MessageSquare },
];

const EVENT_REASONS = [
  "Корпоратив",
  "День народження",
  "Весілля",
  "Ювілей",
  "Конференція",
  "Тренінг",
  "Презентація",
  "Нетворкінг",
  "Свято",
  "Інше",
];

export function ChecklistWizardBox({ checklist, onSave, onCancel }: ChecklistWizardBoxProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<ChecklistCreate>({
    checklist_type: "box",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    event_date: "",
    event_format: "Доставка боксів",
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

  useEffect(() => {
    if (checklist) {
      setFormData({
        ...formData,
        ...checklist,
        checklist_type: "box",
      });
    }
  }, [checklist]);

  const updateField = (field: keyof ChecklistCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      
      if (checklist?.id) {
        await checklistsApi.update(checklist.id, formData as ChecklistUpdate);
      } else {
        await checklistsApi.create(formData);
      }
      
      onSave();
    } catch (error) {
      console.error("Error saving checklist:", error);
      toast.error("Помилка збереження чекліста");
    } finally {
      setIsSaving(false);
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepContact formData={formData} updateField={updateField} />;
      case 2:
        return <StepEvent formData={formData} updateField={updateField} />;
      case 3:
        return <StepLocation formData={formData} updateField={updateField} />;
      case 4:
        return <StepDetails formData={formData} updateField={updateField} />;
      case 5:
        return <StepFood formData={formData} updateField={updateField} />;
      case 6:
        return <StepAdditional formData={formData} updateField={updateField} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-6 flex-shrink-0">
        <div className="flex items-center justify-between text-white mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {checklist ? "Редагування чекліста" : "Новий чекліст на доставку боксів"}
              </h2>
              <p className="text-amber-100">Крок {currentStep} з {STEPS.length}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-white/20 rounded-full h-2.5">
          <div
            className="bg-white h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="px-8 py-5 border-b bg-gray-50 overflow-x-auto flex-shrink-0">
        <div className="flex gap-3 min-w-max">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all font-medium ${
                  isActive
                    ? "bg-amber-500 text-white shadow-lg scale-105"
                    : isCompleted
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  isCompleted ? "bg-green-500 text-white" : isActive ? "bg-white/20" : ""
                }`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span>{step.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-4xl mx-auto">
          {renderStep()}
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-5 border-t bg-white flex justify-between items-center flex-shrink-0 shadow-lg">
        <Button
          variant="outline"
          size="lg"
          onClick={currentStep === 1 ? onCancel : handlePrev}
          className="px-6"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          {currentStep === 1 ? "Скасувати" : "Назад"}
        </Button>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Save className="w-5 h-5 mr-2" />
            )}
            Зберегти чернетку
          </Button>
          
          {currentStep < STEPS.length ? (
            <Button
              size="lg"
              onClick={handleNext}
              className="bg-amber-500 hover:bg-amber-600 text-white px-8 shadow-lg"
            >
              Далі
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-green-500 hover:bg-green-600 text-white px-8 shadow-lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Збереження...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Завершити і зберегти
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Step Components
interface StepProps {
  formData: ChecklistCreate;
  updateField: (field: keyof ChecklistCreate, value: any) => void;
}

function StepContact({ formData, updateField }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
          <User className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Контактна інформація</h3>
          <p className="text-sm text-gray-500">Введіть дані контактної особи</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact_name">Ім'я контакту *</Label>
          <Input
            id="contact_name"
            value={formData.contact_name || ""}
            onChange={(e) => updateField("contact_name", e.target.value)}
            placeholder="Прізвище Ім'я"
            className="h-12"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="contact_phone">Телефон *</Label>
          <Input
            id="contact_phone"
            value={formData.contact_phone || ""}
            onChange={(e) => updateField("contact_phone", e.target.value)}
            placeholder="+380 XX XXX XX XX"
            className="h-12"
          />
        </div>
        
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="contact_email">Email</Label>
          <Input
            id="contact_email"
            type="email"
            value={formData.contact_email || ""}
            onChange={(e) => updateField("contact_email", e.target.value)}
            placeholder="email@example.com"
            className="h-12"
          />
        </div>
      </div>
    </div>
  );
}

function StepEvent({ formData, updateField }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
          <Calendar className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Інформація про подію</h3>
          <p className="text-sm text-gray-500">Дата, формат та привід заходу</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="event_date">Дата заходу *</Label>
          <Input
            id="event_date"
            type="date"
            value={formData.event_date || ""}
            onChange={(e) => updateField("event_date", e.target.value)}
            className="h-12"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="order_number">Номер замовлення</Label>
          <Input
            id="order_number"
            value={formData.order_number || ""}
            onChange={(e) => updateField("order_number", e.target.value)}
            placeholder="Напр.: BOX-001"
            className="h-12"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="event_format">Формат</Label>
          <Input
            id="event_format"
            value={formData.event_format || ""}
            onChange={(e) => updateField("event_format", e.target.value)}
            placeholder="Доставка боксів"
            className="h-12"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="event_reason">Привід / причина святкування</Label>
          <Select
            value={formData.event_reason || ""}
            onValueChange={(v) => updateField("event_reason", v)}
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Оберіть привід" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_REASONS.map((reason) => (
                <SelectItem key={reason} value={reason}>
                  {reason}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="delivery_time">Час доставки</Label>
          <Input
            id="delivery_time"
            value={formData.delivery_time || ""}
            onChange={(e) => updateField("delivery_time", e.target.value)}
            placeholder="Напр.: 10:00-11:00"
            className="h-12"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="event_duration">Тривалість заходу</Label>
          <Input
            id="event_duration"
            value={formData.event_duration || ""}
            onChange={(e) => updateField("event_duration", e.target.value)}
            placeholder="Напр.: 2 години"
            className="h-12"
          />
        </div>
      </div>
    </div>
  );
}

function StepLocation({ formData, updateField }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
          <MapPin className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Локація доставки</h3>
          <p className="text-sm text-gray-500">Адреса та деталі місця доставки</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="location_address">Адреса *</Label>
          <Textarea
            id="location_address"
            value={formData.location_address || ""}
            onChange={(e) => updateField("location_address", e.target.value)}
            placeholder="Вулиця, номер будинку, офіс/квартира"
            rows={3}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="location_floor">Поверх</Label>
            <Input
              id="location_floor"
              value={formData.location_floor || ""}
              onChange={(e) => updateField("location_floor", e.target.value)}
              placeholder="Напр.: 5"
              className="h-12"
            />
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base">Наявність ліфта</Label>
              <p className="text-sm text-gray-500">Чи є ліфт у будівлі?</p>
            </div>
            <Switch
              checked={formData.location_elevator || false}
              onCheckedChange={(checked) => updateField("location_elevator", checked)}
            />
          </div>
        </div>
        
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-medium">Потрібен кур'єр / персонал?</Label>
                  <Switch
                    checked={formData.needs_courier || false}
                    onCheckedChange={(checked) => updateField("needs_courier", checked)}
                  />
                </div>
                {formData.needs_courier && (
                  <Textarea
                    value={formData.personnel_notes || ""}
                    onChange={(e) => updateField("personnel_notes", e.target.value)}
                    placeholder="Опишіть потреби: кількість персоналу, час роботи..."
                    rows={2}
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StepDetails({ formData, updateField }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Деталі замовлення</h3>
          <p className="text-sm text-gray-500">Кількість гостей та бюджет</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600" />
              Кількість гостей
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              value={formData.guest_count || ""}
              onChange={(e) => updateField("guest_count", parseInt(e.target.value) || undefined)}
              placeholder="0"
              className="h-14 text-2xl font-bold text-center"
            />
            <p className="text-sm text-gray-500 text-center mt-2">осіб</p>
          </CardContent>
        </Card>
        
        <Card className="border-2 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Бюджет
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              value={formData.budget_amount || ""}
              onChange={(e) => updateField("budget_amount", parseFloat(e.target.value) || undefined)}
              placeholder="0"
              className="h-14 text-2xl font-bold text-center"
            />
            <p className="text-sm text-gray-500 text-center mt-2">грн</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="budget_notes">Коментар до бюджету</Label>
        <Textarea
          id="budget_notes"
          value={formData.budget || ""}
          onChange={(e) => updateField("budget", e.target.value)}
          placeholder="Напр.: до 500 грн на особу, або загальний бюджет..."
          rows={2}
        />
      </div>
    </div>
  );
}

function StepFood({ formData, updateField }: StepProps) {
  const foodOptions = [
    { key: "food_hot", label: "Гарячі страви", emoji: "🍲" },
    { key: "food_cold", label: "Холодні закуски", emoji: "🥗" },
    { key: "food_salads", label: "Салати", emoji: "🥬" },
    { key: "food_garnish", label: "Гарнір", emoji: "🍚" },
    { key: "food_sweet", label: "Солодке", emoji: "🍰" },
    { key: "food_vegetarian", label: "Вегетаріанське", emoji: "🥦" },
    { key: "food_vegan", label: "Веганське", emoji: "🌱" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
          <Utensils className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Побажання щодо страв</h3>
          <p className="text-sm text-gray-500">Оберіть категорії страв</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {foodOptions.map((option) => (
          <label
            key={option.key}
            className={`flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
              formData[option.key as keyof ChecklistCreate]
                ? "border-amber-500 bg-amber-50"
                : "border-gray-200 hover:border-amber-300"
            }`}
          >
            <span className="text-3xl mb-2">{option.emoji}</span>
            <span className="text-sm font-medium text-gray-700">{option.label}</span>
            <Checkbox
              checked={formData[option.key as keyof ChecklistCreate] as boolean || false}
              onCheckedChange={(checked) => updateField(option.key as keyof ChecklistCreate, checked)}
              className="mt-2"
            />
          </label>
        ))}
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Перевага: м'ясне чи рибне?</Label>
          <Select
            value={formData.food_preference || ""}
            onValueChange={(v) => updateField("food_preference", v)}
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Оберіть перевагу" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="meat">Більше м'ясного 🥩</SelectItem>
              <SelectItem value="fish">Більше рибного 🐟</SelectItem>
              <SelectItem value="mixed">Збалансовано</SelectItem>
              <SelectItem value="none">Без переваг</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="food_notes">Додаткові побажання щодо меню</Label>
          <Textarea
            id="food_notes"
            value={formData.food_notes || ""}
            onChange={(e) => updateField("food_notes", e.target.value)}
            placeholder="Алергії, обмеження, особливі побажання..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}

function StepAdditional({ formData, updateField }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Додаткова інформація</h3>
          <p className="text-sm text-gray-500">Напої, знижки та коментарі</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="drinks_notes">Напої</Label>
            <Textarea
              id="drinks_notes"
              value={formData.drinks_notes || ""}
              onChange={(e) => updateField("drinks_notes", e.target.value)}
              placeholder="Чай, кава, соки, вода..."
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="alcohol_notes">Алкоголь</Label>
            <Textarea
              id="alcohol_notes"
              value={formData.alcohol_notes || ""}
              onChange={(e) => updateField("alcohol_notes", e.target.value)}
              placeholder="Вино, шампанське, пиво..."
              rows={3}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="discount_notes">Знижка</Label>
            <Input
              id="discount_notes"
              value={formData.discount_notes || ""}
              onChange={(e) => updateField("discount_notes", e.target.value)}
              placeholder="Напр.: 10% для постійного клієнта"
              className="h-12"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="surcharge_notes">Націнка</Label>
            <Input
              id="surcharge_notes"
              value={formData.surcharge_notes || ""}
              onChange={(e) => updateField("surcharge_notes", e.target.value)}
              placeholder="Напр.: +15% за терміновість"
              className="h-12"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="general_comment">Загальний коментар</Label>
          <Textarea
            id="general_comment"
            value={formData.general_comment || ""}
            onChange={(e) => updateField("general_comment", e.target.value)}
            placeholder="Будь-яка додаткова інформація..."
            rows={4}
          />
        </div>
      </div>
      
      {/* Summary Preview */}
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            Підсумок чекліста
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Контакт:</span>
              <p className="font-medium">{formData.contact_name || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500">Телефон:</span>
              <p className="font-medium">{formData.contact_phone || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500">Дата:</span>
              <p className="font-medium">{formData.event_date || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500">Гостей:</span>
              <p className="font-medium">{formData.guest_count || "—"}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Адреса:</span>
              <p className="font-medium">{formData.location_address || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

