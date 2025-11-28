import { useState } from "react";
import { Plus, FileText, Edit, Trash2, Copy, Eye } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  usageCount: number;
  content: {
    header: string;
    footer: string;
    showPhotos: boolean;
    showPrices: boolean;
  };
}

export function KPTemplates() {
  const [templates, setTemplates] = useState<Template[]>([
    {
      id: "1",
      name: "Класичний шаблон",
      description: "Стандартний формат КП з логотипом та детальним описом",
      createdAt: "2025-10-01",
      usageCount: 45,
      content: {
        header: "Комерційна пропозиція від компанії [Назва]",
        footer: "Дякуємо за вибір нашої компанії!",
        showPhotos: true,
        showPrices: true,
      },
    },
    {
      id: "2",
      name: "Преміум шаблон",
      description: "Елегантний дизайн для VIP клієнтів з фотографіями страв",
      createdAt: "2025-09-15",
      usageCount: 28,
      content: {
        header: "Ексклюзивна пропозиція для [Клієнт]",
        footer: "З повагою, команда [Компанія]",
        showPhotos: true,
        showPrices: true,
      },
    },
    {
      id: "3",
      name: "Мінімалістичний",
      description: "Лаконічний формат зі списком та цінами",
      createdAt: "2025-08-20",
      usageCount: 67,
      content: {
        header: "Пропозиція",
        footer: "Контакти: info@company.com",
        showPhotos: false,
        showPrices: true,
      },
    },
  ]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    header: "",
    footer: "",
    showPhotos: true,
    showPrices: true,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      header: "",
      footer: "",
      showPhotos: true,
      showPrices: true,
    });
    setEditingTemplate(null);
    setIsAddDialogOpen(false);
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error("Будь ласка, введіть назву шаблону");
      return;
    }

    const templateData: Template = {
      id: editingTemplate?.id || Date.now().toString(),
      name: formData.name,
      description: formData.description,
      createdAt: editingTemplate?.createdAt || new Date().toISOString().split("T")[0],
      usageCount: editingTemplate?.usageCount || 0,
      content: {
        header: formData.header,
        footer: formData.footer,
        showPhotos: formData.showPhotos,
        showPrices: formData.showPrices,
      },
    };

    if (editingTemplate) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === editingTemplate.id ? templateData : t))
      );
      toast.success("Шаблон оновлено");
    } else {
      setTemplates((prev) => [...prev, templateData]);
      toast.success("Шаблон створено");
    }

    resetForm();
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description,
      header: template.content.header,
      footer: template.content.footer,
      showPhotos: template.content.showPhotos,
      showPrices: template.content.showPrices,
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Шаблон видалено");
  };

  const handleDuplicate = (template: Template) => {
    const duplicated: Template = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (копія)`,
      createdAt: new Date().toISOString().split("T")[0],
      usageCount: 0,
    };
    setTemplates((prev) => [...prev, duplicated]);
    toast.success("Шаблон продубльовано");
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl text-gray-900 mb-2">Шаблони КП</h1>
          <p className="text-sm md:text-base text-gray-600">
            Керуйте шаблонами комерційних пропозицій для швидкого створення
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Додати шаблон
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Редагувати шаблон" : "Створити новий шаблон"}
              </DialogTitle>
              <DialogDescription>
                {editingTemplate ? "Змініть налаштування шаблону КП" : "Налаштуйте новий шаблон для комерційних пропозицій"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">
                  Назва шаблону <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="template-name"
                  placeholder="Наприклад: Корпоративний шаблон"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-description">Опис шаблону</Label>
                <Textarea
                  id="template-description"
                  placeholder="Короткий опис призначення шаблону..."
                  rows={2}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="header">Заголовок КП</Label>
                <Input
                  id="header"
                  placeholder="Текст заголовка (можна використовувати змінні [Клієнт], [Дата])"
                  value={formData.header}
                  onChange={(e) => setFormData((prev) => ({ ...prev, header: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="footer">Футер КП</Label>
                <Textarea
                  id="footer"
                  placeholder="Текст внизу КП (контакти, подяка тощо)"
                  rows={2}
                  value={formData.footer}
                  onChange={(e) => setFormData((prev) => ({ ...prev, footer: e.target.value }))}
                />
              </div>

              <div className="space-y-3">
                <Label>Налаштування відображення</Label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showPhotos}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, showPhotos: e.target.checked }))
                      }
                      className="w-4 h-4 text-[#FF5A00] border-gray-300 rounded focus:ring-[#FF5A00]"
                    />
                    <span className="text-sm text-gray-700">Показувати фото страв</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showPrices}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, showPrices: e.target.checked }))
                      }
                      className="w-4 h-4 text-[#FF5A00] border-gray-300 rounded focus:ring-[#FF5A00]"
                    />
                    <span className="text-sm text-gray-700">Показувати ціни</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                >
                  {editingTemplate ? "Зберегти зміни" : "Створити шаблон"}
                </Button>
                <Button onClick={resetForm} variant="outline" className="flex-1">
                  Скасувати
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <FileText className="w-8 h-8 text-[#FF5A00]" />
                <Badge variant="secondary" className="text-xs">
                  Використано: {template.usageCount}
                </Badge>
              </div>
              <CardTitle className="mt-4">{template.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Прев'ю шаблону КП */}
              <div className="mb-3 h-24 rounded-md bg-gradient-to-br from-gray-50 to-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-500 text-center px-2">
                Прев'ю шаблону КП
                <br />
                (умовний макет вигляду комерційної пропозиції)
              </div>

              <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
                {template.description}
              </p>

              <div className="space-y-2 mb-4 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span>Дата створення:</span>
                  <span className="text-gray-900">{template.createdAt}</span>
                </div>
                <div className="flex gap-2">
                  {template.content.showPhotos && (
                    <Badge variant="outline" className="text-xs">
                      З фото
                    </Badge>
                  )}
                  {template.content.showPrices && (
                    <Badge variant="outline" className="text-xs">
                      З цінами
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs md:text-sm"
                  onClick={() => handleEdit(template)}
                >
                  <Edit className="w-3 h-3 md:mr-1" />
                  <span className="hidden md:inline">Редагувати</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDuplicate(template)}
                  title="Дублювати"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(template.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Видалити"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">Шаблони відсутні</h3>
            <p className="text-gray-600 mb-4">
              Створіть перший шаблон для швидкого формування КП
            </p>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Додати шаблон
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="text-sm text-gray-600">
        Всього шаблонів: {templates.length}
      </div>
    </div>
  );
}