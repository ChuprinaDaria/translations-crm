import React, { useState, useEffect } from "react";
import {
  Languages,
  Plus,
  Edit,
  Trash2,
  Search,
  Mail,
  Phone,
  MessageCircle,
  Star,
  MoreVertical,
  Check,
  X,
  Loader2,
  FileText,
  StickyNote,
  Settings,
} from "lucide-react";
import { SideTabs, SidePanel, type SideTab, type QuickAction } from "../../../components/ui";

// Конфігурація табів для Translators
const TRANSLATORS_SIDE_TABS: SideTab[] = [
  { id: 'info', icon: FileText, label: 'Інформація', color: 'blue' },
  { id: 'notes', icon: StickyNote, label: 'Нотатки', color: 'green' },
  { id: 'settings', icon: Settings, label: 'Налаштування', color: 'gray' },
];
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { toast } from "sonner";
import { translatorsApi, type Translator, type TranslatorCreate } from "../api/translators";
import { 
  languagesApi, 
  specializationsApi, 
  translatorRatesApi,
  type Language,
  type Specialization,
  type TranslatorLanguageRate 
} from "../api/languages";

interface TranslatorLanguageForm {
  language: string;
  rate_per_page: number;
  specializations: string[];
}

interface TranslatorForm {
  name: string;
  email: string;
  phone: string;
  telegram_id?: string;
  whatsapp?: string;
  status?: "active" | "inactive" | "busy";
  languages: TranslatorLanguageForm[];
}

// LANGUAGES та SPECIALIZATIONS тепер завантажуються з API

const STATUS_LABELS = {
  active: { label: "Активний", color: "bg-green-100 text-green-700" },
  inactive: { label: "Неактивний", color: "bg-gray-100 text-gray-700" },
  busy: { label: "Зайнятий", color: "bg-yellow-100 text-yellow-700" },
};

export function TranslatorsPage() {
  const [translators, setTranslators] = useState<Translator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sidePanelTab, setSidePanelTab] = useState<string | null>(null);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTranslator, setEditingTranslator] = useState<Translator | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete confirmation
  const [deletingTranslator, setDeletingTranslator] = useState<Translator | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form state
  const [form, setForm] = useState<TranslatorForm>({
    name: "",
    email: "",
    phone: "",
    telegram_id: "",
    whatsapp: "",
    status: "active",
    languages: [], // Стара система мов більше не використовується
  });

  // New API-based state for languages and rates
  const [apiLanguages, setApiLanguages] = useState<Language[]>([]);
  const [apiSpecializations, setApiSpecializations] = useState<Specialization[]>([]);
  const [translatorRates, setTranslatorRates] = useState<TranslatorLanguageRate[]>([]);
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [newSpecName, setNewSpecName] = useState('');

  useEffect(() => {
    loadTranslators();
    loadLanguages();
    loadSpecializations();
  }, []);

  const loadLanguages = async () => {
    try {
      const data = await languagesApi.getLanguages();
      setApiLanguages(data);
    } catch (error: any) {
      console.error('Error loading languages:', error);
    }
  };

  const loadSpecializations = async () => {
    try {
      const data = await specializationsApi.getSpecializations();
      setApiSpecializations(data);
    } catch (error: any) {
      console.error('Error loading specializations:', error);
    }
  };

  const loadTranslators = async () => {
    setIsLoading(true);
    try {
      const data = await translatorsApi.getTranslators();
      setTranslators(data);
    } catch (error: any) {
      toast.error(`Помилка завантаження: ${error?.message || "Невідома помилка"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingTranslator(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      telegram_id: "",
      whatsapp: "",
      status: "active",
      languages: [],
    });
    setTranslatorRates([]);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = async (translator: Translator) => {
    setEditingTranslator(translator);
    setForm({
      name: translator.name,
      email: translator.email,
      phone: translator.phone,
      telegram_id: translator.telegram_id || "",
      whatsapp: translator.whatsapp || "",
      status: translator.status,
      languages: [], // Стара система мов більше не використовується
    });
    
    // Load translator rates if editing
    try {
      const rates = await translatorRatesApi.getTranslatorRates(translator.id);
      setTranslatorRates(rates);
    } catch (error: any) {
      console.error('Error loading translator rates:', error);
      setTranslatorRates([]);
    }
    
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    // Validation
    if (!form.name.trim()) {
      toast.error("Введіть ім'я перекладача");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Введіть email перекладача");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("Введіть телефон перекладача");
      return;
    }
    if (translatorRates.length === 0 || translatorRates.every(r => !r.language_id || r.language_id === 0)) {
      toast.error("Додайте хоча б одну мову та ставку");
      return;
    }

    setIsSaving(true);
    try {
      const payload: TranslatorCreate = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        telegram_id: form.telegram_id?.trim() || undefined,
        whatsapp: form.whatsapp?.trim() || undefined,
        status: form.status,
        languages: [], // Стара система мов більше не використовується
      };

      let savedTranslator: Translator;
      if (editingTranslator) {
        savedTranslator = await translatorsApi.updateTranslator(editingTranslator.id, payload);
        toast.success("Перекладача оновлено");
      } else {
        savedTranslator = await translatorsApi.createTranslator(payload);
        toast.success("Перекладача додано");
      }

      // Зберегти ставки після створення/оновлення перекладача
      if (savedTranslator && translatorRates.length > 0) {
        try {
          for (const rate of translatorRates) {
            if (rate.language_id && rate.language_id > 0) {
              if (rate.id) {
                // Оновити існуючу ставку
                await translatorRatesApi.updateTranslatorRate(rate.id, {
                  language_id: rate.language_id,
                  specialization_id: rate.specialization_id,
                  translator_rate: rate.translator_rate,
                  custom_client_price: rate.custom_client_price,
                  notes: rate.notes,
                });
              } else {
                // Створити нову ставку
                await translatorRatesApi.createTranslatorRate(savedTranslator.id, {
                  language_id: rate.language_id,
                  specialization_id: rate.specialization_id,
                  translator_rate: rate.translator_rate,
                  custom_client_price: rate.custom_client_price,
                  notes: rate.notes,
                });
              }
            }
          }
        } catch (rateError: any) {
          console.error('Error saving rates:', rateError);
          // Не блокуємо збереження перекладача, якщо ставки не збереглися
          toast.warning("Перекладача збережено, але деякі ставки не вдалося зберегти");
        }
      }

      setIsDialogOpen(false);
      setTranslatorRates([]);
      loadTranslators();
    } catch (error: any) {
      // Обробка конкретних помилок
      const errorMessage = error?.data?.detail || error?.message || "Невідома помилка";
      
      if (errorMessage.includes("email already exists") || errorMessage.includes("email вже існує")) {
        toast.error("Перекладач з таким email вже існує. Будь ласка, використайте інший email або відредагуйте існуючого перекладача.");
      } else {
        toast.error(`Помилка: ${errorMessage}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTranslator) return;
    
    setIsDeleting(true);
    try {
      await translatorsApi.deleteTranslator(deletingTranslator.id);
      toast.success("Перекладача видалено");
      setDeletingTranslator(null);
      loadTranslators();
    } catch (error: any) {
      toast.error(`Помилка видалення: ${error?.message || "Невідома помилка"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusChange = async (translator: Translator, newStatus: "active" | "inactive" | "busy") => {
    try {
      await translatorsApi.updateTranslator(translator.id, { status: newStatus });
      toast.success(`Статус змінено на "${STATUS_LABELS[newStatus].label}"`);
      loadTranslators();
    } catch (error: any) {
      toast.error(`Помилка: ${error?.message || "Невідома помилка"}`);
    }
  };

  // API-based rate functions
  const addLanguageRate = () => {
    const newRate: TranslatorLanguageRate = {
      translator_id: editingTranslator?.id || 0,
      language_id: 0,
      specialization_id: undefined,
      translator_rate: 0,
      custom_client_price: undefined,
      notes: '',
    };
    setTranslatorRates([...translatorRates, newRate]);
  };

  const updateRate = (index: number, field: keyof TranslatorLanguageRate, value: any) => {
    const updated = [...translatorRates];
    updated[index] = { 
      ...updated[index], 
      [field]: value,
      translator_id: editingTranslator?.id || updated[index].translator_id || 0
    };
    setTranslatorRates(updated);
  };

  const saveRate = async (index: number) => {
    const rate = translatorRates[index];
    if (!rate.language_id || rate.language_id === 0) {
      toast.error('Оберіть мову');
      return;
    }

    // Якщо перекладач ще не збережений, просто оновлюємо локальний стан
    if (!editingTranslator || !editingTranslator.id) {
      // При створенні нового перекладача - просто оновлюємо локальний стан
      // Ставки будуть збережені після збереження перекладача
      toast.success('Ставку додано (буде збережено після збереження перекладача)');
      return;
    }

    try {
      if (rate.id) {
        // Update existing
        await translatorRatesApi.updateTranslatorRate(rate.id, rate);
        toast.success('Ставку оновлено');
      } else {
        // Create new
        const res = await translatorRatesApi.createTranslatorRate(editingTranslator.id, rate);
        const updated = [...translatorRates];
        updated[index] = res;
        setTranslatorRates(updated);
        toast.success('Ставку додано');
      }
    } catch (error: any) {
      toast.error(`Помилка: ${error?.message || 'Невідома помилка'}`);
    }
  };

  const deleteRate = async (index: number) => {
    const rate = translatorRates[index];
    if (rate.id) {
      try {
        await translatorRatesApi.deleteTranslatorRate(rate.id);
        toast.success('Ставку видалено');
      } catch (error: any) {
        toast.error(`Помилка видалення: ${error?.message || 'Невідома помилка'}`);
        return;
      }
    }
    setTranslatorRates(translatorRates.filter((_, i) => i !== index));
  };

  const getClientPrice = (rate: TranslatorLanguageRate): number => {
    if (rate.custom_client_price) {
      return rate.custom_client_price;
    }
    const lang = apiLanguages.find(l => l.id === rate.language_id);
    return lang ? lang.base_client_price : 0;
  };

  const getProfit = (rate: TranslatorLanguageRate): number => {
    return getClientPrice(rate) - (rate.translator_rate || 0);
  };

  const addCustomSpecialization = async () => {
    if (!newSpecName.trim()) {
      toast.error('Введіть назву спеціалізації');
      return;
    }

    try {
      const res = await specializationsApi.createSpecialization({
        name: newSpecName.trim(),
        description: 'Кастомна спеціалізація',
      });
      setApiSpecializations([...apiSpecializations, res]);
      setShowSpecModal(false);
      setNewSpecName('');
      toast.success('Спеціалізацію додано');
    } catch (error: any) {
      toast.error(`Помилка: ${error?.message || 'Невідома помилка'}`);
    }
  };

  // Filter translators
  const filteredTranslators = translators.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.phone.includes(searchQuery);
    
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Languages className="w-6 h-6 text-gray-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Перекладачі</h1>
            <p className="text-sm text-gray-500">Управління базою перекладачів</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Пошук по імені, email або телефону..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всі статуси</SelectItem>
            <SelectItem value="active">Активні</SelectItem>
            <SelectItem value="inactive">Неактивні</SelectItem>
            <SelectItem value="busy">Зайняті</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Translators Grid */}
      {filteredTranslators.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <Languages className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Немає перекладачів</p>
              <p className="text-sm mt-1">
                {searchQuery ? "Спробуйте змінити критерії пошуку" : "Додайте першого перекладача"}
              </p>
              {!searchQuery && (
                <Button onClick={handleOpenCreate} className="mt-4" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Додати перекладача
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTranslators.map((translator) => (
            <Card key={translator.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <Languages className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{translator.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={STATUS_LABELS[translator.status].color}>
                          {STATUS_LABELS[translator.status].label}
                        </Badge>
                        {translator.rating > 0 && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            {translator.rating.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenEdit(translator)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Редагувати
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleStatusChange(translator, "active")}>
                        <Check className="w-4 h-4 mr-2 text-green-600" />
                        Активувати
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(translator, "busy")}>
                        <Languages className="w-4 h-4 mr-2 text-yellow-600" />
                        Позначити зайнятим
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(translator, "inactive")}>
                        <X className="w-4 h-4 mr-2 text-gray-600" />
                        Деактивувати
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeletingTranslator(translator)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Видалити
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Contact Info */}
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{translator.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{translator.phone}</span>
                  </div>
                  {translator.telegram_id && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MessageCircle className="w-4 h-4" />
                      <span>{translator.telegram_id}</span>
                    </div>
                  )}
                </div>
                
                {/* Languages */}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">Мови та ставки:</div>
                  <div className="flex flex-wrap gap-1">
                    {translator.languages.map((lang, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {lang.language}: {lang.rate_per_page} zł
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                  <span>Виконано: {translator.completed_orders} замовлень</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTranslator ? "Редагувати перекладача" : "Додати перекладача"}
            </DialogTitle>
            <DialogDescription>
              {editingTranslator 
                ? "Оновіть інформацію про перекладача" 
                : "Заповніть інформацію про нового перекладача"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ім'я *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Олена Коваленко"
                />
              </div>
              <div className="space-y-2">
                <Label>Статус</Label>
                <Select 
                  value={form.status} 
                  onValueChange={(v) => setForm(prev => ({ ...prev, status: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Активний</SelectItem>
                    <SelectItem value="inactive">Неактивний</SelectItem>
                    <SelectItem value="busy">Зайнятий</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="olena@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Телефон *</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+48 500 123 456"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telegram</Label>
                <Input
                  value={form.telegram_id || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, telegram_id: e.target.value }))}
                  placeholder="@username"
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input
                  value={form.whatsapp || ""}
                  onChange={(e) => setForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                  placeholder="+48 500 123 456"
                />
              </div>
            </div>
            
            {/* Languages and Rates Section */}
            <div className="space-y-4 pt-6 border-t">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Мови та ставки *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLanguageRate}>
                    <Plus className="w-4 h-4 mr-1" />
                    Додати мову/тип
                  </Button>
                </div>

                {translatorRates.map((rate, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Мова #{index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRate(index)}
                        className="text-red-600 h-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Мова:</Label>
                        <Select
                          value={rate.language_id?.toString() || ''}
                          onValueChange={(v) => updateRate(index, 'language_id', v ? parseInt(v) : 0)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Оберіть мову" />
                          </SelectTrigger>
                          <SelectContent>
                            {apiLanguages.map(lang => (
                              <SelectItem key={lang.id} value={lang.id.toString()}>
                                {lang.name_pl} ({lang.base_client_price} zł)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Спеціалізація:</Label>
                        <div className="flex gap-2">
                          <Select
                            value={rate.specialization_id?.toString() || ''}
                            onValueChange={(v) => updateRate(index, 'specialization_id', v ? parseInt(v) : undefined)}
                            className="flex-1"
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Оберіть тип" />
                            </SelectTrigger>
                            <SelectContent>
                              {apiSpecializations.map(spec => (
                                <SelectItem key={spec.id} value={spec.id.toString()}>
                                  {spec.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => setShowSpecModal(true)}
                            className="text-xs"
                          >
                            + Додати свою
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Ставка перекладача (zł):</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={rate.translator_rate || ''}
                          onChange={(e) => updateRate(index, 'translator_rate', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Ціна для клієнта (zł):</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={`Базова: ${getClientPrice(rate)} zł`}
                          value={rate.custom_client_price || ''}
                          onChange={(e) => updateRate(index, 'custom_client_price', e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                        <p className="text-xs text-gray-500">Залиште порожнім для базової ціни</p>
                      </div>
                    </div>

                    <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💰</span>
                        <span className="font-semibold text-green-700">
                          Прибуток: {getProfit(rate).toFixed(2)} zł/переклад
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Примітки:</Label>
                      <Textarea
                        value={rate.notes || ''}
                        onChange={(e) => updateRate(index, 'notes', e.target.value)}
                        placeholder="Наприклад: тільки медичні тексти, мінімум 2 дні"
                        rows={2}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => saveRate(index)}
                        className="flex-1 bg-orange-500 hover:bg-orange-600"
                      >
                        Зберегти
                      </Button>
                    </div>
                  </div>
                ))}

                {translatorRates.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Немає доданих мов та ставок. Натисніть "Додати мову/тип" щоб додати.
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Скасувати
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-orange-500 hover:bg-orange-600">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Збереження...
                </>
              ) : (
                editingTranslator ? "Зберегти зміни" : "Додати"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deletingTranslator} onOpenChange={() => setDeletingTranslator(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити перекладача?</DialogTitle>
            <DialogDescription>
              Ви впевнені, що хочете видалити перекладача{" "}
              <strong>{deletingTranslator?.name}</strong>? Цю дію неможливо скасувати.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingTranslator(null)} disabled={isDeleting}>
              Скасувати
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Видалення..." : "Видалити"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Specialization Modal */}
      <Dialog open={showSpecModal} onOpenChange={setShowSpecModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Додати спеціалізацію</DialogTitle>
            <DialogDescription>
              Створіть нову спеціалізацію для перекладачів
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="spec-name">Назва спеціалізації</Label>
              <Input
                id="spec-name"
                type="text"
                value={newSpecName}
                onChange={(e) => setNewSpecName(e.target.value)}
                placeholder="Наприклад: Медичні тексти"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomSpecialization();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowSpecModal(false);
              setNewSpecName('');
            }}>
              Скасувати
            </Button>
            <Button onClick={addCustomSpecialization} className="bg-orange-500 hover:bg-orange-600">
              Додати
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SideTabs - Vertical colored tabs on the right */}
      <SideTabs
        tabs={TRANSLATORS_SIDE_TABS}
        activeTab={sidePanelTab}
        onTabChange={setSidePanelTab}
        position="right"
        quickActions={[
          {
            id: 'add-translator',
            icon: Plus,
            label: 'Додати перекладача',
            onClick: handleOpenCreate,
          },
        ]}
      />

      {/* SidePanel - Бокова панель з контентом */}
      <SidePanel
        open={sidePanelTab !== null}
        onClose={() => setSidePanelTab(null)}
        title={TRANSLATORS_SIDE_TABS.find(t => t.id === sidePanelTab)?.label}
        width="md"
      >
        {sidePanelTab === 'info' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Інформація про перекладачів</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Всього перекладачів:</span>
                <span className="ml-2 font-medium text-gray-900">{translators.length}</span>
              </div>
              <div>
                <span className="text-gray-500">Активних:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {translators.filter(t => t.status === 'active').length}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {sidePanelTab === 'notes' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Нотатки</h4>
            <p className="text-sm text-gray-500">Функціонал нотаток буде додано пізніше</p>
          </div>
        )}
        
        {sidePanelTab === 'settings' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Налаштування</h4>
            <p className="text-sm text-gray-500">Налаштування перекладачів</p>
          </div>
        )}
      </SidePanel>
    </div>
  );
}

