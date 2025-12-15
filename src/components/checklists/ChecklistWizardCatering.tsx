import { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  ChefHat,
  User,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Utensils,
  MessageSquare,
  Loader2,
  Save,
  Armchair,
  Wine
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

interface ChecklistWizardCateringProps {
  checklist?: Checklist | null;
  onSave: () => void;
  onCancel: () => void;
}

const STEPS = [
  { id: 1, title: "Контакт", icon: User },
  { id: 2, title: "Подія", icon: Calendar },
  { id: 3, title: "Локація", icon: MapPin },
  { id: 4, title: "Деталі", icon: Users },
  { id: 5, title: "Обладнання", icon: Armchair },
  { id: 6, title: "Страви", icon: Utensils },
  { id: 7, title: "Додатково", icon: MessageSquare },
];

const EVENT_FORMATS = [
  "Фуршет",
  "Кава-пауза",
  "Банкет",
  "Коктейль",
  "Бранч",
  "Бізнес-ланч",
  "Пікнік",
  "Барбекю",
  "Інше",
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

export function ChecklistWizardCatering({ checklist, onSave, onCancel }: ChecklistWizardCateringProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<ChecklistCreate>({
    checklist_type: "catering",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    event_date: "",
    event_format: "",
    event_reason: "",
    delivery_time: "",
    event_duration: "",
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

  useEffect(() => {
    if (checklist) {
      setFormData({
        ...formData,
        ...checklist,
        checklist_type: "catering",
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
        return <StepEquipment formData={formData} updateField={updateField} />;
      case 6:
        return <StepFood formData={formData} updateField={updateField} />;
      case 7:
        return <StepAdditional formData={formData} updateField={updateField} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF5A00] to-orange-500 p-6 rounded-t-lg">
        <div className="flex items-center gap-3 text-white mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {checklist ? "Редагування чекліста" : "Новий чекліст на кейтеринг"}
            </h2>
            <p className="text-orange-100 text-sm">Крок {currentStep} з {STEPS.length}</p>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-white/20 rounded-full h-2">
          <div
            className="bg-white h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="px-6 py-4 border-b overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
                  isActive
                    ? "bg-[#FF5A00] text-white"
                    : isCompleted
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  isCompleted ? "bg-green-500 text-white" : ""
                }`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className="hidden md:inline">{step.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 min-h-[400px]">
        {renderStep()}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t bg-gray-50 rounded-b-lg flex justify-between">
        <Button
          variant="outline"
          onClick={currentStep === 1 ? onCancel : handlePrev}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          {currentStep === 1 ? "Скасувати" : "Назад"}
        </Button>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            Зберегти
          </Button>
          
          {currentStep < STEPS.length ? (
            <Button
              onClick={handleNext}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            >
              Далі
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-green-500 hover:bg-green-600"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Збереження...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Завершити
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
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <User className="w-5 h-5 text-orange-600" />
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
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <Calendar className="w-5 h-5 text-orange-600" />
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
          <Label htmlFor="event_format">Формат заходу *</Label>
          <Select
            value={formData.event_format || ""}
            onValueChange={(v) => updateField("event_format", v)}
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Оберіть формат" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_FORMATS.map((format) => (
                <SelectItem key={format} value={format}>
                  {format}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Label htmlFor="delivery_time">Час / тривалість заходу</Label>
          <Input
            id="delivery_time"
            value={formData.delivery_time || ""}
            onChange={(e) => updateField("delivery_time", e.target.value)}
            placeholder="Напр.: 14:00-18:00"
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
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <MapPin className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Локація</h3>
          <p className="text-sm text-gray-500">Адреса та деталі місця проведення</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="location_address">Адреса *</Label>
          <Textarea
            id="location_address"
            value={formData.location_address || ""}
            onChange={(e) => updateField("location_address", e.target.value)}
            placeholder="Вулиця, номер будинку, офіс/зал"
            rows={3}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="location_floor">Поверх (обов'язково)</Label>
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
      </div>
    </div>
  );
}

function StepDetails({ formData, updateField }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Деталі заходу</h3>
          <p className="text-sm text-gray-500">Кількість гостей та бюджет</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
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

function StepEquipment({ formData, updateField }: StepProps) {
  const equipmentOptions = [
    { key: "equipment_furniture", label: "Меблі", emoji: "🪑", description: "Столи, стільці, барні стійки" },
    { key: "equipment_tablecloths", label: "Скатертини", emoji: "🎀", description: "Текстиль для столів" },
    { key: "equipment_disposable_dishes", label: "Одноразовий посуд", emoji: "🥤", description: "Пластик, папір" },
    { key: "equipment_glass_dishes", label: "Скляний посуд", emoji: "🍷", description: "Тарілки, бокали, чашки" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <Armchair className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Обладнання</h3>
          <p className="text-sm text-gray-500">Оберіть необхідне обладнання</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {equipmentOptions.map((option) => (
          <label
            key={option.key}
            className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              formData[option.key as keyof ChecklistCreate]
                ? "border-orange-500 bg-orange-50"
                : "border-gray-200 hover:border-orange-300"
            }`}
          >
            <span className="text-3xl">{option.emoji}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{option.label}</span>
                <Checkbox
                  checked={formData[option.key as keyof ChecklistCreate] as boolean || false}
                  onCheckedChange={(checked) => updateField(option.key as keyof ChecklistCreate, checked)}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">{option.description}</p>
            </div>
          </label>
        ))}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="equipment_notes">Додаткові коментарі щодо обладнання</Label>
        <Textarea
          id="equipment_notes"
          value={formData.equipment_notes || ""}
          onChange={(e) => updateField("equipment_notes", e.target.value)}
          placeholder="Кількість столів, стільців, особливі побажання..."
          rows={3}
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
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <Utensils className="w-5 h-5 text-orange-600" />
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
                ? "border-orange-500 bg-orange-50"
                : "border-gray-200 hover:border-orange-300"
            }`}
          >
            <span className="text-3xl mb-2">{option.emoji}</span>
            <span className="text-sm font-medium text-gray-700 text-center">{option.label}</span>
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
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Додаткова інформація</h3>
          <p className="text-sm text-gray-500">Напої, знижки та коментарі</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="drinks_notes" className="flex items-center gap-2">
              <span>☕</span> Напої
            </Label>
            <Textarea
              id="drinks_notes"
              value={formData.drinks_notes || ""}
              onChange={(e) => updateField("drinks_notes", e.target.value)}
              placeholder="Чай, кава, соки, вода..."
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="alcohol_notes" className="flex items-center gap-2">
              <Wine className="w-4 h-4" /> Алкоголь
            </Label>
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
      <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
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
              <span className="text-gray-500">Формат:</span>
              <p className="font-medium">{formData.event_format || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500">Дата:</span>
              <p className="font-medium">{formData.event_date || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500">Гостей:</span>
              <p className="font-medium">{formData.guest_count || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500">Бюджет:</span>
              <p className="font-medium">{formData.budget_amount ? `${formData.budget_amount} грн` : "—"}</p>
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

