import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, Upload, X, Image as ImageIcon, Check, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { clientsApi, questionnairesApi, itemsApi, type ClientCreate, type ClientQuestionnaireCreate, type ClientQuestionnaireUpdate, type Item } from "../lib/api";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "./ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

interface QuestionnaireFormProps {
  questionnaireId?: number;
  onBack: () => void;
  onSave?: () => void;
}

export function QuestionnaireForm({ questionnaireId, onBack, onSave }: QuestionnaireFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(!questionnaireId);
  
  // Дані клієнта для нового
  const [newClientData, setNewClientData] = useState<ClientCreate>({
    name: "",
    phone: "",
    email: "",
    company_name: "",
  });
  
  // Дані анкети
  const [formData, setFormData] = useState<ClientQuestionnaireUpdate>({
    event_date: new Date().toISOString().split('T')[0],
  });

  // Фото
  const [venuePhotos, setVenuePhotos] = useState<string[]>([]);
  const [arrivalPhotos, setArrivalPhotos] = useState<string[]>([]);

  // Обладнання
  const [allEquipment, setAllEquipment] = useState<Item[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<Item[]>([]);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [customEquipmentNote, setCustomEquipmentNote] = useState("");

  useEffect(() => {
    if (questionnaireId) {
      loadQuestionnaire();
    }
    loadEquipment();
  }, [questionnaireId]);

  const loadEquipment = async () => {
    try {
      const data = await itemsApi.getItems(0, 1000);
      // Фільтруємо тільки обладнання
      const equipment = data.items.filter((item: Item) => 
        item.type === 'equipment' || item.category_name?.toLowerCase().includes('обладнання')
      );
      setAllEquipment(equipment);
    } catch (error) {
      console.error("Error loading equipment:", error);
    }
  };

  // Перевірка клієнта по телефону
  useEffect(() => {
    if (isCreatingNew && newClientData.phone && newClientData.phone.length >= 10) {
      const timeoutId = setTimeout(async () => {
        try {
          const result = await clientsApi.searchByPhone(newClientData.phone);
          if (result.found && result.client) {
            toast.info(`Знайдено клієнта: ${result.client.name}. Дані застосовано.`);
            setNewClientData({
              name: result.client.name,
              phone: result.client.phone,
              email: result.client.email || "",
              company_name: result.client.company_name || "",
            });
            setFormData(prev => ({
              ...prev,
              contact_person: result.client?.name,
              contact_phone: result.client?.phone,
            }));
          }
        } catch (error) {
          console.error("Error searching client:", error);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [newClientData.phone, isCreatingNew]);

  const loadQuestionnaire = async () => {
    if (!questionnaireId) return;
    
    try {
      setIsLoading(true);
      const data = await questionnairesApi.getById(questionnaireId);
      setFormData(data);
      setVenuePhotos(data.venue_photos_urls || []);
      setArrivalPhotos(data.arrival_photos_urls || []);
      
      // Парсимо обладнання якщо є selected_equipment_ids
      if ((data as any).selected_equipment_ids && allEquipment.length > 0) {
        const ids = (data as any).selected_equipment_ids;
        const selected = allEquipment.filter(eq => ids.includes(eq.id));
        setSelectedEquipment(selected);
        
        // Витягуємо кастомний коментар (все після останнього обладнання)
        if (data.equipment_notes) {
          const equipmentNames = selected.map(eq => eq.name);
          const parts = data.equipment_notes.split(';').map(p => p.trim());
          const custom = parts.filter(p => !equipmentNames.includes(p)).join('; ');
          setCustomEquipmentNote(custom);
        }
      } else if (data.equipment_notes) {
        // Старий формат - просто текст
        setCustomEquipmentNote(data.equipment_notes);
      }
      
      setIsCreatingNew(false);
    } catch (error: any) {
      toast.error("Помилка завантаження анкети");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      let clientId: number | undefined;

      // Створюємо клієнта якщо новий
      if (isCreatingNew) {
        if (!newClientData.name || !newClientData.phone) {
          toast.error("Заповніть обов'язкові поля: ім'я та телефон");
          setIsSaving(false);
          return;
        }

        const createdClient = await clientsApi.createClient(newClientData);
        clientId = createdClient.id;
        toast.success("Клієнта створено!");
      }

      // Формуємо текст обладнання
      const equipmentText = [
        ...selectedEquipment.map(eq => eq.name),
        customEquipmentNote
      ].filter(Boolean).join('; ');

      // Додаємо URL фото та обладнання
      const questionnaireData = {
        ...formData,
        venue_photos_urls: venuePhotos,
        arrival_photos_urls: arrivalPhotos,
        equipment_notes: equipmentText,
        selected_equipment_ids: selectedEquipment.map(eq => eq.id), // Зберігаємо ID для подальшого використання в КП
      };

      if (questionnaireId) {
        // Оновлюємо існуючу
        await questionnairesApi.update(questionnaireId, questionnaireData);
        toast.success("Анкету оновлено!");
      } else if (clientId) {
        // Створюємо нову
        await questionnairesApi.create({
          client_id: clientId,
          ...questionnaireData,
        } as ClientQuestionnaireCreate);
        toast.success("Анкету створено!");
      }

      if (onSave) onSave();
      onBack();
    } catch (error: any) {
      toast.error("Помилка збереження");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof ClientQuestionnaireUpdate, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (file: File, type: 'venue' | 'arrival') => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Файл занадто великий. Максимум 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (type === 'venue') {
        setVenuePhotos(prev => [...prev, dataUrl]);
      } else {
        setArrivalPhotos(prev => [...prev, dataUrl]);
      }
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index: number, type: 'venue' | 'arrival') => {
    if (type === 'venue') {
      setVenuePhotos(prev => prev.filter((_, i) => i !== index));
    } else {
      setArrivalPhotos(prev => prev.filter((_, i) => i !== index));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between sticky top-0 bg-white z-10 py-3 border-b">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Назад
        </Button>
        <h1 className="text-lg md:text-xl font-semibold">
          {isCreatingNew ? "Нова анкета" : "Редагування анкети"}
        </h1>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Збереження...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Зберегти
            </>
          )}
        </Button>
      </div>

      {/* Дані клієнта (тільки при створенні) */}
      {isCreatingNew && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Дані клієнта</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="client-name" className="text-sm">Ім'я клієнта *</Label>
                <Input
                  id="client-name"
                  value={newClientData.name}
                  onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                  placeholder="Введіть ім'я"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="client-phone" className="text-sm">Телефон *</Label>
                <Input
                  id="client-phone"
                  value={newClientData.phone}
                  onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                  placeholder="+380..."
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="client-email" className="text-sm">Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={newClientData.email || ""}
                  onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                  placeholder="email@example.com"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="client-company" className="text-sm">Компанія</Label>
                <Input
                  id="client-company"
                  value={newClientData.company_name || ""}
                  onChange={(e) => setNewClientData({ ...newClientData, company_name: e.target.value })}
                  placeholder="Назва компанії"
                  className="h-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* СЕРВІС */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Сервіс</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Дата заходу</Label>
              <Input
                type="date"
                value={formData.event_date || ""}
                onChange={(e) => updateField("event_date", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Точна локація</Label>
              <Input
                value={formData.location || ""}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="м.Київ, вул..."
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Контакт замовника</Label>
              <Input
                value={formData.contact_person || ""}
                onChange={(e) => updateField("contact_person", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Телефон контакту</Label>
              <Input
                value={formData.contact_phone || ""}
                onChange={(e) => updateField("contact_phone", e.target.value)}
                placeholder="+380..."
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Хто буде головним на локації</Label>
              <Input
                value={formData.on_site_contact || ""}
                onChange={(e) => updateField("on_site_contact", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Телефон на локації</Label>
              <Input
                value={formData.on_site_phone || ""}
                onChange={(e) => updateField("on_site_phone", e.target.value)}
                placeholder="+380..."
                className="h-9"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm">Час заїзду на локацію</Label>
              <Textarea
                value={formData.arrival_time || ""}
                onChange={(e) => updateField("arrival_time", e.target.value)}
                placeholder="Заїзд напередодні: з 9:00..."
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Час початку заходу</Label>
              <Input
                value={formData.event_start_time || ""}
                onChange={(e) => updateField("event_start_time", e.target.value)}
                placeholder="10:00"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Час кінця заходу</Label>
              <Input
                value={formData.event_end_time || ""}
                onChange={(e) => updateField("event_end_time", e.target.value)}
                placeholder="18:00"
                className="h-9"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm">Таймінги всіх видач</Label>
              <Textarea
                value={formData.service_type_timing || ""}
                onChange={(e) => updateField("service_type_timing", e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm">Таймінги додаткових видач</Label>
              <Textarea
                value={formData.additional_services_timing || ""}
                onChange={(e) => updateField("additional_services_timing", e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-semibold">Обладнання</Label>
              
              {/* Multi-select обладнання */}
              <Popover open={equipmentOpen} onOpenChange={setEquipmentOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-auto min-h-[2.5rem]"
                  >
                    <div className="flex flex-wrap gap-1">
                      {selectedEquipment.length > 0 ? (
                        selectedEquipment.map((item) => (
                          <span
                            key={item.id}
                            className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs"
                          >
                            {item.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500">Виберіть обладнання...</span>
                      )}
                    </div>
                    <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Пошук обладнання..." />
                    <CommandEmpty>Обладнання не знайдено</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {allEquipment.map((item) => {
                        const isSelected = selectedEquipment.some((eq) => eq.id === item.id);
                        return (
                          <CommandItem
                            key={item.id}
                            onSelect={() => {
                              if (isSelected) {
                                setSelectedEquipment(selectedEquipment.filter((eq) => eq.id !== item.id));
                              } else {
                                setSelectedEquipment([...selectedEquipment, item]);
                              }
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                isSelected ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{item.name}</div>
                              {item.subcategory_name && (
                                <div className="text-xs text-gray-500">{item.subcategory_name}</div>
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Додатковий коментар */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Додатковий коментар (якщо немає в списку)</Label>
                <Textarea
                  value={customEquipmentNote}
                  onChange={(e) => setCustomEquipmentNote(e.target.value)}
                  placeholder="Інше обладнання, особливі вимоги..."
                  rows={2}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Спосіб оплати</Label>
              <Input
                value={formData.payment_method || ""}
                onChange={(e) => updateField("payment_method", e.target.value)}
                placeholder="Предоплата/Залишок"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Колір текстилю</Label>
              <Input
                value={formData.textile_color || ""}
                onChange={(e) => updateField("textile_color", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm">Колір оформлення лінії</Label>
              <Input
                value={formData.banquet_line_color || ""}
                onChange={(e) => updateField("banquet_line_color", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ЗАЇЗД */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Заїзд</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Складність заїзду</Label>
              <Input
                value={formData.venue_complexity || ""}
                onChange={(e) => updateField("venue_complexity", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">На якому поверсі</Label>
              <Input
                value={formData.floor_number || ""}
                onChange={(e) => updateField("floor_number", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                checked={formData.elevator_available || false}
                onCheckedChange={(checked) => updateField("elevator_available", checked)}
              />
              <Label className="text-sm">Чи є ліфт</Label>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Чи є технічне приміщення</Label>
              <Input
                value={formData.technical_room || ""}
                onChange={(e) => updateField("technical_room", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm">Чи є кухня</Label>
              <Input
                value={formData.kitchen_available || ""}
                onChange={(e) => updateField("kitchen_available", e.target.value)}
                className="h-9"
              />
            </div>
            
            {/* Фото локації */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.venue_photos || false}
                  onCheckedChange={(checked) => updateField("venue_photos", checked)}
                />
                <Label className="text-sm font-semibold">Фото локації</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {venuePhotos.map((photo, idx) => (
                  <div key={idx} className="relative group">
                    <img src={photo} alt={`Venue ${idx + 1}`} className="w-20 h-20 object-cover rounded border" />
                    <button
                      onClick={() => removePhoto(idx, 'venue')}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-orange-500 transition">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], 'venue')}
                  />
                  <Upload className="w-6 h-6 text-gray-400" />
                </label>
              </div>
            </div>

            {/* Фото заїзду */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.arrival_photos || false}
                  onCheckedChange={(checked) => updateField("arrival_photos", checked)}
                />
                <Label className="text-sm font-semibold">Фото заїзду</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {arrivalPhotos.map((photo, idx) => (
                  <div key={idx} className="relative group">
                    <img src={photo} alt={`Arrival ${idx + 1}`} className="w-20 h-20 object-cover rounded border" />
                    <button
                      onClick={() => removePhoto(idx, 'arrival')}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-orange-500 transition">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], 'arrival')}
                  />
                  <Upload className="w-6 h-6 text-gray-400" />
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* КУХНЯ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Кухня</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Посуд для подачі страв</Label>
              <Input
                value={formData.dish_serving || ""}
                onChange={(e) => updateField("dish_serving", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Подача гарячих закусок</Label>
              <Input
                value={formData.hot_snacks_serving || ""}
                onChange={(e) => updateField("hot_snacks_serving", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Подання салатів</Label>
              <Input
                value={formData.salad_serving || ""}
                onChange={(e) => updateField("salad_serving", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Чи є алергія на продукти</Label>
              <Input
                value={formData.product_allergy || ""}
                onChange={(e) => updateField("product_allergy", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                checked={formData.vegetarians || false}
                onCheckedChange={(checked) => updateField("vegetarians", checked)}
              />
              <Label className="text-sm">Чи є вегетаріанці</Label>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Приготування гарячих закусок</Label>
              <Input
                value={formData.hot_snacks_prep || ""}
                onChange={(e) => updateField("hot_snacks_prep", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm">Коментарі до позицій меню</Label>
              <Textarea
                value={formData.menu_notes || ""}
                onChange={(e) => updateField("menu_notes", e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm">Їжа від замовника</Label>
              <Textarea
                value={formData.client_order_notes || ""}
                onChange={(e) => updateField("client_order_notes", e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm">Напої від замовника</Label>
              <Textarea
                value={formData.client_drinks_notes || ""}
                onChange={(e) => updateField("client_drinks_notes", e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* КОНТЕНТ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Контент</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Чи можна фотозйомка</Label>
              <Input
                value={formData.photo_allowed || ""}
                onChange={(e) => updateField("photo_allowed", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Чи можна відеозйомка</Label>
              <Input
                value={formData.video_allowed || ""}
                onChange={(e) => updateField("video_allowed", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-sm">Чи можна брендовану продукцію</Label>
              <Input
                value={formData.branded_products || ""}
                onChange={(e) => updateField("branded_products", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ЗАМОВНИК */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Замовник</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Назва компанії</Label>
              <Input
                value={formData.client_company_name || ""}
                onChange={(e) => updateField("client_company_name", e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Вид діяльності компанії</Label>
              <Input
                value={formData.client_activity_type || ""}
                onChange={(e) => updateField("client_activity_type", e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* КОМЕНТАРІ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Коментарі</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.special_notes || ""}
            onChange={(e) => updateField("special_notes", e.target.value)}
            rows={4}
            placeholder="Спеціальні примітки..."
            className="text-sm"
          />
        </CardContent>
      </Card>

      {/* Кнопка збереження внизу */}
      <div className="sticky bottom-0 bg-white border-t py-3">
        <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Збереження...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Зберегти анкету
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

