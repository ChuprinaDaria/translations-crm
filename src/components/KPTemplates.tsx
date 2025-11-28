import React, { useEffect, useState } from "react";
import { Plus, FileText, Edit, Trash2, Eye } from "lucide-react";
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
import { templatesApi, type Template as ApiTemplate } from "../lib/api";

export function KPTemplates() {
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApiTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    filename: "",
    is_default: false,
    html_content: "",
  });

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await templatesApi.getTemplates();
      setTemplates(data);
    } catch (error: any) {
      console.error(error);
      toast.error("Не вдалося завантажити шаблони КП");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const autoFilenameFromName = (name: string) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]+/g, "");
    return slug ? `${slug}.html` : "";
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      filename: "",
      is_default: false,
      html_content: "",
    });
    setEditingTemplate(null);
    setIsAddDialogOpen(false);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Будь ласка, введіть назву шаблону");
      return;
    }

    if (!formData.filename) {
      toast.error("Вкажіть ім'я файлу шаблону (наприклад, classic.html)");
      return;
    }

    try {
      if (editingTemplate) {
        const updated = await templatesApi.updateTemplate(editingTemplate.id, {
          name: formData.name,
          description: formData.description,
          filename: formData.filename,
          is_default: formData.is_default,
          html_content: formData.html_content,
        });
        setTemplates((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        toast.success("Шаблон оновлено");
      } else {
        const created = await templatesApi.createTemplate({
          name: formData.name,
          description: formData.description,
          filename: formData.filename,
          is_default: formData.is_default,
          html_content: formData.html_content,
        });
        setTemplates((prev) => [...prev, created]);
        toast.success("Шаблон створено");
      }

      resetForm();
    } catch (error: any) {
      console.error(error);
      const message =
        error?.detail ||
        error?.message ||
        "Сталася помилка при збереженні шаблону";
      toast.error(
        typeof message === "string" ? message : "Сталася помилка при збереженні шаблону"
      );
    }
  };

  const handleEdit = async (template: ApiTemplate) => {
    try {
      const fullTemplate = await templatesApi.getTemplate(template.id);
      setEditingTemplate(fullTemplate);
      setFormData({
        name: fullTemplate.name,
        description: fullTemplate.description || "",
        filename: fullTemplate.filename,
        is_default: fullTemplate.is_default,
        html_content: fullTemplate.html_content || "",
      });
      setIsAddDialogOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("Не вдалося завантажити шаблон");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await templatesApi.deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Шаблон видалено");
    } catch (error) {
      console.error(error);
      toast.error("Не вдалося видалити шаблон");
    }
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
          <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
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
                <Label htmlFor="template-filename">
                  Ім&apos;я файлу шаблону (на сервері)
                </Label>
                <Input
                  id="template-filename"
                  placeholder="Наприклад: classic.html"
                  value={formData.filename}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      filename: e.target.value,
                    }))
                  }
                  onBlur={() => {
                    if (!formData.filename && formData.name) {
                      setFormData((prev) => ({
                        ...prev,
                        filename: autoFilenameFromName(formData.name),
                      }));
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="html-content">
                  HTML шаблону (Jinja2) <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="html-content"
                  placeholder="Вставте готовий HTML (можна з змінними {{ kp }}, {{ items }} тощо)..."
                  rows={20}
                  className="min-h-[60vh] font-mono text-xs leading-snug"
                  value={formData.html_content}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, html_content: e.target.value }))
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-default"
                  checked={formData.is_default}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, is_default: e.target.checked }))
                  }
                  className="w-4 h-4 text-[#FF5A00] border-gray-300 rounded focus:ring-[#FF5A00]"
                />
                <Label htmlFor="is-default" className="text-sm text-gray-700">
                  Зробити шаблоном за замовчуванням
                </Label>
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
                {template.is_default && (
                  <Badge variant="secondary" className="text-xs">
                    За замовчуванням
                  </Badge>
                )}
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
                  <span className="text-gray-900">
                    {template.created_at
                      ? new Date(template.created_at).toLocaleDateString()
                      : "-"}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {template.filename && (
                    <Badge variant="outline" className="text-xs">
                      {template.filename}
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