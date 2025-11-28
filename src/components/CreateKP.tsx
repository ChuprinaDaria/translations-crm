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
  getImageUrl,
  type Item,
  type Category,
  type Template as ApiTemplate,
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

export function CreateKP() {
  const [step, setStep] = useState(1);
  const [selectedDishes, setSelectedDishes] = useState<number[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [clientName, setClientName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [sendTelegram, setSendTelegram] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState("");
  
  // State for dishes from API
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

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

  // Load templates from API
  useEffect(() => {
    const loadTemplates = async () => {
      setTemplatesLoading(true);
      try {
        const data = await templatesApi.getTemplates();
        setTemplates(data);

        // Автовибір шаблону:
        // 1) якщо є шаблон за замовчуванням (is_default === true) – беремо його
        // 2) інакше беремо перший у списку
        if (data.length > 0) {
          const defaultTemplate = data.find((t) => t.is_default) || data[0];
          setSelectedTemplateId(defaultTemplate.id);
        }
      } catch (error: any) {
        console.error("Error loading templates", error);
        toast.error("Помилка завантаження шаблонів КП");
      } finally {
        setTemplatesLoading(false);
      }
    };

    loadTemplates();
  }, []);


  const allTags = Array.from(new Set(dishes.flatMap((dish) => dish.category)));

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
    setSelectedDishes((prev) =>
      prev.includes(dishId) ? prev.filter((id) => id !== dishId) : [...prev, dishId]
    );
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
    return getSelectedDishesData().reduce((sum, dish) => sum + dish.price, 0);
  };

  const [creatingKP, setCreatingKP] = useState(false);

  const handleCreateKP = async () => {
    if (!clientName || !eventDate || !guestCount) {
      toast.error("Будь ласка, заповніть всі дані клієнта");
      return;
    }
    if (selectedDishes.length === 0) {
      toast.error("Будь ласка, оберіть хоча б одну страву");
      return;
    }
    if (!selectedTemplateId) {
      toast.error("Будь ласка, оберіть шаблон КП");
      return;
    }
    if (sendEmail && !clientEmail) {
      toast.error("Вкажіть email клієнта для відправки КП");
      return;
    }

    const peopleCountNum = parseInt(guestCount, 10) || 0;
    const totalPrice = getTotalPrice();
    const title =
      clientName ||
      `КП від ${new Date(eventDate || Date.now()).toLocaleDateString("uk-UA")}`;

    const itemsPayload = getSelectedDishesData().map((dish) => ({
      item_id: dish.id,
      quantity: 1,
    }));

    setCreatingKP(true);
    try {
      const kp = await kpApi.createKP({
        title,
        people_count: peopleCountNum,
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
      });

      toast.success(
        sendEmail || sendTelegram
          ? "КП створено та відправлено клієнту"
          : "КП створено успішно"
      );

      // Відкриваємо PDF у новій вкладці для перегляду
      try {
        const blob = await kpApi.generateKPPDF(kp.id, selectedTemplateId || undefined);
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } catch (pdfError) {
        console.error("Помилка генерації PDF:", pdfError);
      }

      // Reset form
      setStep(1);
      setSelectedDishes([]);
      setSelectedTemplateId(null);
      setClientName("");
      setEventDate("");
      setGuestCount("");
      setClientEmail("");
      setSendEmail(false);
      setEmailMessage("");
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
        <h1 className="text-xl md:text-2xl text-gray-900 mb-2">Створити КП</h1>
        <p className="text-sm md:text-base text-gray-600">Створення нової комерційної пропозиції для клієнта</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 md:gap-4 overflow-x-auto pb-2">
        {[
          { num: 1, label: "Дані клієнта" },
          { num: 2, label: "Вибір страв" },
          { num: 3, label: "Шаблон та відправка" },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm ${
                  step >= s.num
                    ? "bg-[#FF5A00] text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {s.num}
              </div>
              <span
                className={`text-xs md:text-sm whitespace-nowrap ${
                  step >= s.num ? "text-gray-900" : "text-gray-600"
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < 2 && <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />}
          </div>
        ))}
      </div>

      {/* Step 1: Client Data */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Крок 1: Дані клієнта та події</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 md:space-y-6">
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
                  />
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
              </div>
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
                  onClick={() => setStep(2)}
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 w-full md:w-auto"
                >
                  Далі: Вибір страв
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Dishes */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Крок 2: Виберіть страви для меню</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => setStep(1)} variant="outline" className="w-full sm:w-auto">
              Назад
            </Button>
            <Button
              onClick={() => setStep(3)}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 w-full sm:w-auto"
              disabled={selectedDishes.length === 0 || loading}
            >
              Далі: Вибір шаблону
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Template Selection and Send */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Крок 3: Вибір шаблону та відправка</CardTitle>
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
                      <div className="border-t mt-4 pt-4 flex justify-between">
                        <span className="text-gray-900">Загальна сума:</span>
                        <span className="text-gray-900">{getTotalPrice()} грн</span>
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