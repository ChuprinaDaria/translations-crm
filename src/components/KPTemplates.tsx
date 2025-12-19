import React, { useEffect, useState } from "react";
import { Plus, FileText, Edit, Trash2, Eye, Upload } from "lucide-react";
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
import { templatesApi, type Template as ApiTemplate, getImageUrl } from "../lib/api";
import { TemplateEditor } from "./templates/TemplateEditor";

export function KPTemplates() {
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApiTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    filename: "",
    is_default: false,
    primary_color: "#FF5A00",
    secondary_color: "#1a1a2e",
    text_color: "#333333",
    font_family: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
    // Налаштування відображення колонок
    show_item_photo: true,
    show_item_weight: true,
    show_item_quantity: true,
    show_item_price: true,
    show_item_total: true,
    show_item_description: false,
    // Налаштування підсумкових блоків
    show_weight_summary: true,
    show_weight_per_person: true,
    show_discount_block: false,
    show_equipment_block: true,
    show_service_block: true,
    show_transport_block: true,
    // Секції меню
    menu_sections: ["Холодні закуски", "Салати", "Гарячі страви", "Гарнір", "Десерти", "Напої"],
    // Текстові налаштування
    menu_title: "Меню",
    summary_title: "Підсумок",
    footer_text: "",
    // Layout
    page_orientation: "portrait",
    items_per_page: 20,
    // Налаштування тексту категорій та страв
    category_text_align: "center",
    category_text_color: "#FFFFFF",
    dish_text_align: "left",
    dish_text_color: "#333333",
  });
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [separatorPreview, setSeparatorPreview] = useState<string | null>(null);

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

  // Ініціалізуємо прев'ю зображень та поля дизайну при відкритті шаблону на редагування
  useEffect(() => {
    if (editingTemplate) {
      // Ініціалізуємо прев'ю з існуючих URL
      if (editingTemplate.header_image_url) {
        setHeaderPreview(editingTemplate.header_image_url);
      }
      if (editingTemplate.category_separator_image_url) {
        setSeparatorPreview(editingTemplate.category_separator_image_url);
      }
      if (editingTemplate.background_image_url) {
        setBackgroundPreview(editingTemplate.background_image_url);
      }
      // Ініціалізуємо поля дизайну
      setFormData((prev) => ({
        ...prev,
        name: editingTemplate.name || "",
        description: editingTemplate.description || "",
        is_default: editingTemplate.is_default || false,
        primary_color: editingTemplate.primary_color || "#FF5A00",
        secondary_color: editingTemplate.secondary_color || "#1a1a2e",
        text_color: editingTemplate.text_color || "#333333",
        font_family: editingTemplate.font_family || "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
        category_text_align: editingTemplate.category_text_align || "center",
        category_text_color: editingTemplate.category_text_color || "#FFFFFF",
        dish_text_align: editingTemplate.dish_text_align || "left",
        dish_text_color: editingTemplate.dish_text_color || "#333333",
        show_item_photo: editingTemplate.show_item_photo ?? true,
        show_item_weight: editingTemplate.show_item_weight ?? true,
        show_item_quantity: editingTemplate.show_item_quantity ?? true,
        show_item_price: editingTemplate.show_item_price ?? true,
        show_item_total: editingTemplate.show_item_total ?? true,
        show_item_description: editingTemplate.show_item_description ?? false,
        show_weight_summary: editingTemplate.show_weight_summary ?? true,
        show_weight_per_person: editingTemplate.show_weight_per_person ?? true,
        show_discount_block: editingTemplate.show_discount_block ?? false,
        show_equipment_block: editingTemplate.show_equipment_block ?? true,
        show_service_block: editingTemplate.show_service_block ?? true,
        show_transport_block: editingTemplate.show_transport_block ?? true,
        menu_sections: Array.isArray(editingTemplate.menu_sections) 
          ? editingTemplate.menu_sections 
          : (editingTemplate.menu_sections ? [editingTemplate.menu_sections] : ["Холодні закуски", "Салати", "Гарячі страви", "Гарнір", "Десерти", "Напої"]),
        menu_title: editingTemplate.menu_title || "Меню",
        summary_title: editingTemplate.summary_title || "Підсумок",
        footer_text: editingTemplate.footer_text || "",
        page_orientation: editingTemplate.page_orientation || "portrait",
        items_per_page: editingTemplate.items_per_page || 20,
      }));
    } else {
      // Скидаємо прев'ю при закритті редактора
      setHeaderPreview(null);
      setSeparatorPreview(null);
      setBackgroundPreview(null);
      setHeaderFile(null);
      setBackgroundFile(null);
    }
  }, [editingTemplate]);

  const autoFilenameFromName = (name: string) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]+/g, "");
    return slug ? `${slug}.html` : "";
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'header' | 'background') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'header') {
      setHeaderFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeaderPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setBackgroundFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBackgroundPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      filename: "",
      is_default: false,
      primary_color: "#FF5A00",
      secondary_color: "#1a1a2e",
      text_color: "#333333",
      font_family: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
      show_item_photo: true,
      show_item_weight: true,
      show_item_quantity: true,
      show_item_price: true,
      show_item_total: true,
      show_item_description: false,
      show_weight_summary: true,
      show_weight_per_person: true,
      show_discount_block: false,
      show_equipment_block: true,
      show_service_block: true,
      show_transport_block: true,
      menu_sections: ["Холодні закуски", "Салати", "Гарячі страви", "Гарнір", "Десерти", "Напої"],
      menu_title: "Меню",
      summary_title: "Підсумок",
      footer_text: "",
      page_orientation: "portrait",
      items_per_page: 20,
      // Налаштування тексту категорій та страв
      category_text_align: "center",
      category_text_color: "#FFFFFF",
      dish_text_align: "left",
      dish_text_color: "#333333",
    });
    setHeaderFile(null);
    setBackgroundFile(null);
    setHeaderPreview(null);
    setSeparatorPreview(null);
    setBackgroundPreview(null);
    setEditingTemplate(null);
    setIsAddDialogOpen(false);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error("Будь ласка, введіть назву шаблону");
      return;
    }

    // Автоматично генеруємо filename з назви шаблону
    const autoFilename = autoFilenameFromName(formData.name);

    try {
      const templateData = {
        name: formData.name,
        description: formData.description,
        filename: autoFilename,
        is_default: formData.is_default,
        header_image: headerFile || undefined,
        background_image: backgroundFile || undefined,
        // URL зображень (якщо не завантажено новий файл, використовуємо існуючий URL)
        header_image_url: headerFile ? undefined : (editingTemplate?.header_image_url || ""),
        background_image_url: backgroundFile ? undefined : (editingTemplate?.background_image_url || ""),
        category_separator_image_url: editingTemplate?.category_separator_image_url || "",
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
        text_color: formData.text_color,
        font_family: formData.font_family,
        // Налаштування тексту категорій та страв
        category_text_align: formData.category_text_align,
        category_text_color: formData.category_text_color,
        dish_text_align: formData.dish_text_align,
        dish_text_color: formData.dish_text_color,
        // Налаштування відображення
        show_item_photo: formData.show_item_photo,
        show_item_weight: formData.show_item_weight,
        show_item_quantity: formData.show_item_quantity,
        show_item_price: formData.show_item_price,
        show_item_total: formData.show_item_total,
        show_item_description: formData.show_item_description,
        show_weight_summary: formData.show_weight_summary,
        show_weight_per_person: formData.show_weight_per_person,
        show_discount_block: formData.show_discount_block,
        show_equipment_block: formData.show_equipment_block,
        show_service_block: formData.show_service_block,
        show_transport_block: formData.show_transport_block,
        // Секції та текст
        menu_sections: formData.menu_sections,
        menu_title: formData.menu_title,
        summary_title: formData.summary_title,
        footer_text: formData.footer_text,
        page_orientation: formData.page_orientation,
        items_per_page: formData.items_per_page,
      };
      
      if (editingTemplate) {
        const updated = await templatesApi.updateTemplate(editingTemplate.id, templateData);
        setTemplates((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        toast.success("Шаблон оновлено");
      } else {
        const created = await templatesApi.createTemplate(templateData);
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
      setIsEditorOpen(true);
    } catch (error) {
      console.error(error);
      toast.error("Не вдалося завантажити шаблон");
    }
  };

  const handleOpenNewEditor = () => {
    setEditingTemplate(null);
    setIsEditorOpen(true);
  };

  const handleSaveTemplate = async (templateData: any) => {
    try {
      // Автоматично генеруємо filename з назви шаблону
      const autoFilename = templateData.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]+/g, "") + ".html";

      const dataToSave = {
        ...templateData,
        filename: autoFilename,
      };

      if (editingTemplate) {
        const updated = await templatesApi.updateTemplate(editingTemplate.id, dataToSave);
        // Оновлюємо список шаблонів та перезавантажуємо для отримання оновленого прев'ю
        await loadTemplates();
        toast.success("Шаблон оновлено");
      } else {
        const created = await templatesApi.createTemplate(dataToSave);
        setTemplates((prev) => [...prev, created]);
        toast.success("Шаблон створено");
      }

      setIsEditorOpen(false);
      setEditingTemplate(null);
    } catch (error: any) {
      console.error("Error saving template:", error);
      
      // Обробка помилок валідації (422) - detail може бути масивом
      let errorMessage = "Сталася помилка при збереженні шаблону";
      if (error?.data?.detail) {
        if (Array.isArray(error.data.detail)) {
          errorMessage = error.data.detail.map((err: any) => {
            if (typeof err === 'string') return err;
            if (err.msg) return `${err.loc?.join('.') || ''}: ${err.msg}`;
            return JSON.stringify(err);
          }).join(', ');
        } else if (typeof error.data.detail === 'string') {
          errorMessage = error.data.detail;
        } else {
          errorMessage = JSON.stringify(error.data.detail);
        }
      } else if (error?.detail) {
        errorMessage = error.detail;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      throw error;
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
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          if (!open) {
            resetForm();
          } else {
            setIsAddDialogOpen(true);
          }
        }}>
          <Button
            onClick={handleOpenNewEditor}
            className="bg-[#FF5A00] hover:bg-[#FF5A00]/90 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Додати шаблон
          </Button>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Редагувати шаблон" : "Створити новий шаблон"}
              </DialogTitle>
              <DialogDescription>
                {editingTemplate ? "Змініть налаштування шаблону КП" : "Налаштуйте новий шаблон для комерційних пропозицій"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Назва та опис */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Назва шаблону <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Назва шаблону"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Опис шаблону</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="Короткий опис шаблону"
                  />
                </div>
              </div>

              {/* Оформлення - сітка 2x2 */}
              <div>
                <h3 className="text-sm font-medium mb-3">Оформлення шаблону</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Оберіть базові кольори та шрифт. Вони автоматично застосуються до PDF.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Основний колір */}
                  <div>
                    <Label className="text-xs font-medium mb-2 block">Основний колір</Label>
                    <div className="relative">
                      <input
                        type="color"
                        value={formData.primary_color}
                        onChange={(e) => setFormData((prev) => ({ ...prev, primary_color: e.target.value }))}
                        className="w-full h-12 rounded-lg border cursor-pointer"
                      />
                      <div className="absolute inset-0 pointer-events-none rounded-lg border-2 border-gray-300"></div>
                    </div>
                  </div>

                  {/* Фон */}
                  <div>
                    <Label className="text-xs font-medium mb-2 block">Фон</Label>
                    <div className="relative">
                      <input
                        type="color"
                        value={formData.secondary_color}
                        onChange={(e) => setFormData((prev) => ({ ...prev, secondary_color: e.target.value }))}
                        className="w-full h-12 rounded-lg border cursor-pointer"
                      />
                      <div className="absolute inset-0 pointer-events-none rounded-lg border-2 border-gray-300"></div>
                    </div>
                  </div>

                  {/* Текст */}
                  <div>
                    <Label className="text-xs font-medium mb-2 block">Текст</Label>
                    <div className="relative">
                      <input
                        type="color"
                        value={formData.text_color}
                        onChange={(e) => setFormData((prev) => ({ ...prev, text_color: e.target.value }))}
                        className="w-full h-12 rounded-lg border cursor-pointer"
                      />
                      <div className="absolute inset-0 pointer-events-none rounded-lg border-2 border-gray-300"></div>
                    </div>
                  </div>

                  {/* Шрифт */}
                  <div>
                    <Label className="text-xs font-medium mb-2 block">Шрифт</Label>
                    <select
                      value={formData.font_family}
                      onChange={(e) => setFormData((prev) => ({ ...prev, font_family: e.target.value }))}
                      className="w-full h-12 px-3 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="Segoe UI, Tahoma, Geneva, Verdana, sans-serif">Segoe UI</option>
                      <option value="Roboto, Arial, sans-serif">Roboto</option>
                      <option value="Montserrat, Arial, sans-serif">Montserrat</option>
                      <option value="'Times New Roman', serif">Times New Roman</option>
                      <option value="'Playfair Display', 'Times New Roman', serif">Playfair Display</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Зображення - сітка 1x2 на desktop, stack на мобілці */}
              <div>
                <h3 className="text-sm font-medium mb-3">Зображення</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Зображення шапки */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium block">Зображення шапки</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 hover:border-orange-500 transition-colors">
                      <input
                        type="file"
                        id="header-upload"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'header')}
                        className="hidden"
                      />
                      <label
                        htmlFor="header-upload"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        {(headerPreview || editingTemplate?.header_image_url) ? (
                          <div className="w-full">
                            <img
                              src={headerPreview || editingTemplate?.header_image_url || ''}
                              alt="Header preview"
                              className="w-full h-24 object-cover rounded mb-2"
                              style={{ maxWidth: '100%', maxHeight: '150px' }}
                            />
                            <p className="text-xs text-gray-500 truncate">
                              {headerFile?.name || editingTemplate?.header_image_url?.split('/').pop() || 'Завантажено'}
                            </p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-gray-400" />
                            <span className="text-sm text-gray-600">Завантажити шапку</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Фонове зображення */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium block">Фонове зображення</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 hover:border-orange-500 transition-colors">
                      <input
                        type="file"
                        id="background-upload"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'background')}
                        className="hidden"
                      />
                      <label
                        htmlFor="background-upload"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        {(backgroundPreview || editingTemplate?.background_image_url) ? (
                          <div className="w-full">
                            <img
                              src={backgroundPreview || editingTemplate?.background_image_url || ''}
                              alt="Background preview"
                              className="w-full h-24 object-cover rounded mb-2"
                              style={{ maxWidth: '100%', maxHeight: '150px' }}
                            />
                            <p className="text-xs text-gray-500 truncate">
                              {backgroundFile?.name || editingTemplate?.background_image_url?.split('/').pop() || 'Завантажено'}
                            </p>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-gray-400" />
                            <span className="text-sm text-gray-600">Завантажити фон</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Налаштування відображення колонок */}
              <div>
                <h3 className="text-sm font-medium mb-3">Колонки таблиці меню</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Оберіть які колонки показувати в таблиці страв у PDF
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_item_photo}
                      onChange={(e) => setFormData((prev) => ({ ...prev, show_item_photo: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm">Фото страви</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_item_weight}
                      onChange={(e) => setFormData((prev) => ({ ...prev, show_item_weight: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm">Вага</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_item_quantity}
                      onChange={(e) => setFormData((prev) => ({ ...prev, show_item_quantity: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm">Кількість</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_item_price}
                      onChange={(e) => setFormData((prev) => ({ ...prev, show_item_price: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm">Ціна</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_item_total}
                      onChange={(e) => setFormData((prev) => ({ ...prev, show_item_total: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm">Сума</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_item_description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, show_item_description: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm">Опис страви</span>
                  </label>
                </div>
              </div>

              {/* Підсумкові блоки */}
              <div>
                <h3 className="text-sm font-medium mb-3">Показувати в підсумку</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Оберіть які блоки відображати в підсумковій секції
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_weight_summary}
                      onChange={(e) => setFormData((prev) => ({ ...prev, show_weight_summary: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm">Загальна вага</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_weight_per_person}
                      onChange={(e) => setFormData((prev) => ({ ...prev, show_weight_per_person: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm">Вага на персону</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_equipment_block}
                      onChange={(e) => setFormData((prev) => ({ ...prev, show_equipment_block: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm">Оренда обладнання</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_service_block}
                      onChange={(e) => setFormData((prev) => ({ ...prev, show_service_block: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm">Обслуговування</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_transport_block}
                      onChange={(e) => setFormData((prev) => ({ ...prev, show_transport_block: e.target.checked }))}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm">Доставка</span>
                  </label>
                </div>
              </div>

              {/* Секції меню */}
              <div>
                <h3 className="text-sm font-medium mb-3">Секції меню</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Страви будуть згруповані за цими категоріями у PDF
                </p>
                <div className="space-y-2">
                  {formData.menu_sections.map((section, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        type="text"
                        value={section}
                        onChange={(e) => {
                          const newSections = [...formData.menu_sections];
                          newSections[idx] = e.target.value;
                          setFormData({ ...formData, menu_sections: newSections });
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newSections = formData.menu_sections.filter((_, i) => i !== idx);
                          setFormData({ ...formData, menu_sections: newSections });
                        }}
                        className="px-3 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        menu_sections: [...formData.menu_sections, "Нова секція"]
                      });
                    }}
                    className="text-orange-600 hover:bg-orange-50"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Додати секцію
                  </Button>
                </div>
              </div>

              {/* Тексти */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Заголовок меню</Label>
                  <Input
                    type="text"
                    value={formData.menu_title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, menu_title: e.target.value }))}
                    placeholder="Меню"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Заголовок підсумку</Label>
                  <Input
                    type="text"
                    value={formData.summary_title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, summary_title: e.target.value }))}
                    placeholder="Підсумок"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Текст внизу PDF (футер)</Label>
                  <Textarea
                    value={formData.footer_text}
                    onChange={(e) => setFormData((prev) => ({ ...prev, footer_text: e.target.value }))}
                    className="resize-none"
                    rows={3}
                    placeholder="Наприклад: контакти, умови оплати, тощо"
                  />
                </div>
              </div>

              {/* Налаштування за замовчуванням */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="default-template"
                  checked={formData.is_default}
                  onChange={(e) => setFormData((prev) => ({ ...prev, is_default: e.target.checked }))}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <Label htmlFor="default-template" className="text-sm font-medium cursor-pointer">
                  Зробити шаблоном за замовчуванням
                </Label>
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
              <Button
                onClick={resetForm}
                variant="outline"
                className="flex-1 sm:flex-none px-6 py-2"
              >
                Скасувати
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 sm:flex-none px-6 py-2 bg-orange-600 text-white hover:bg-orange-700"
              >
                {editingTemplate ? "Зберегти зміни" : "Створити шаблон"}
              </Button>
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
              {template.preview_image_url ? (
                <div className="mb-3 rounded-md border border-gray-200 overflow-hidden bg-gray-50">
                  <img
                    src={`${getImageUrl(template.preview_image_url)}?t=${template.updated_at || Date.now()}`}
                    alt={template.name}
                    className="w-full h-40 object-cover"
                    onError={(e) => {
                      // Якщо картинка не завантажилась – ховаємо її і показуємо плейсхолдер
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="mb-3 h-24 rounded-md bg-gradient-to-br from-gray-50 to-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-500 text-center px-2">
                  Прев'ю шаблону КП
                  <br />
                  (умовний макет вигляду комерційної пропозиції)
                </div>
              )}

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
              onClick={handleOpenNewEditor}
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

      {/* Візуальний редактор шаблонів */}
      {isEditorOpen && (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingTemplate(null);
          }}
        />
      )}
    </div>
  );
}