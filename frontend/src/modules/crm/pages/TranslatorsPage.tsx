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
} from "lucide-react";
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

const LANGUAGES = [
  "Angielski", "Niemiecki", "Francuski", "Włoski", "Hiszpański", 
  "Rosyjski", "Ukraiński", "Duński", "Szwedzki", "Norweski",
  "Holenderski", "Portugalski", "Czeski", "Słowacki", "Węgierski",
  "Rumuński", "Bułgarski", "Chorwacki", "Serbski", "Słoweński",
  "Grecki", "Turecki", "Arabski", "Chiński", "Japoński", "Koreański",
];

const SPECIALIZATIONS = ["TRC", "Umowy", "Szkolne", "Dyplomy", "Medyczne", "Prawne", "Biznesowe", "Techniczne"];

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
    languages: [{ language: "", rate_per_page: 0, specializations: [] }],
  });

  useEffect(() => {
    loadTranslators();
  }, []);

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
      languages: [{ language: "", rate_per_page: 0, specializations: [] }],
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (translator: Translator) => {
    setEditingTranslator(translator);
    setForm({
      name: translator.name,
      email: translator.email,
      phone: translator.phone,
      telegram_id: translator.telegram_id || "",
      whatsapp: translator.whatsapp || "",
      status: translator.status,
      languages: translator.languages.length > 0 
        ? translator.languages.map(lang => ({
            language: lang.language,
            rate_per_page: lang.rate_per_page,
            specializations: lang.specializations || [],
          }))
        : [{ language: "", rate_per_page: 0, specializations: [] }],
    });
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
    if (form.languages.every(l => !l.language)) {
      toast.error("Додайте хоча б одну мову");
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
        languages: form.languages
          .filter(l => l.language)
          .map(l => ({
            language: l.language,
            rate_per_page: l.rate_per_page,
            specializations: l.specializations.length > 0 ? l.specializations : undefined,
          })),
      };

      if (editingTranslator) {
        await translatorsApi.updateTranslator(editingTranslator.id, payload);
        toast.success("Перекладача оновлено");
      } else {
        await translatorsApi.createTranslator(payload);
        toast.success("Перекладача додано");
      }

      setIsDialogOpen(false);
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

  const addLanguage = () => {
    setForm(prev => ({
      ...prev,
      languages: [...prev.languages, { language: "", rate_per_page: 0, specializations: [] }],
    }));
  };

  const removeLanguage = (index: number) => {
    setForm(prev => ({
      ...prev,
      languages: prev.languages.filter((_, i) => i !== index),
    }));
  };

  const updateLanguage = (index: number, field: keyof TranslatorLanguageForm, value: any) => {
    setForm(prev => ({
      ...prev,
      languages: prev.languages.map((lang, i) => 
        i === index ? { ...lang, [field]: value } : lang
      ),
    }));
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
        
        <Button onClick={handleOpenCreate} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4 mr-2" />
          Додати перекладача
        </Button>
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
            
            {/* Languages */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Мови та ставки *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLanguage}>
                  <Plus className="w-4 h-4 mr-1" />
                  Додати мову
                </Button>
              </div>
              
              {form.languages.map((lang, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Мова #{index + 1}</span>
                    {form.languages.length > 1 && (
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeLanguage(index)}
                        className="text-red-600 h-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Мова</Label>
                      <Select 
                        value={lang.language}
                        onValueChange={(v) => updateLanguage(index, "language", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Оберіть мову" />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((l) => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Ставка за сторінку (zł)</Label>
                      <Input
                        type="number"
                        value={lang.rate_per_page}
                        onChange={(e) => updateLanguage(index, "rate_per_page", Number(e.target.value))}
                        placeholder="60"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Спеціалізації</Label>
                    <div className="flex flex-wrap gap-2">
                      {SPECIALIZATIONS.map((spec) => (
                        <Badge
                          key={spec}
                          variant={lang.specializations.includes(spec) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            const newSpecs = lang.specializations.includes(spec)
                              ? lang.specializations.filter(s => s !== spec)
                              : [...lang.specializations, spec];
                            updateLanguage(index, "specializations", newSpecs);
                          }}
                        >
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
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
    </div>
  );
}

