import React, { useState } from "react";
import { X, Save, Palette, FileText, Settings } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ColorPicker } from "./ColorPicker";
import { ImageUploader } from "./ImageUploader";
import { TemplatePreview } from "./TemplatePreview";
import { DraggableSectionList } from "./DraggableSectionList";
import { SwitchRow } from "./SwitchRow";
import type { Template as ApiTemplate } from "../../lib/api";

interface TemplateEditorProps {
  template?: ApiTemplate | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

export function TemplateEditor({ template, onSave, onClose }: TemplateEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: template?.name || "",
    description: template?.description || "",
    is_default: template?.is_default || false,
    // Дизайн
    primary_color: template?.primary_color || "#FF5A00",
    secondary_color: template?.secondary_color || "#FFFFFF",
    text_color: template?.text_color || "#1A1A1A",
    font_family: template?.font_family || "Inter, sans-serif",
    // Зображення
    logo_image: null as File | null,
    header_image: null as File | null,
    background_image: null as File | null,
    // Структура таблиці
    show_item_photo: template?.show_item_photo ?? true,
    show_item_weight: template?.show_item_weight ?? true,
    show_item_quantity: template?.show_item_quantity ?? true,
    show_item_price: template?.show_item_price ?? true,
    show_item_total: template?.show_item_total ?? true,
    show_item_description: template?.show_item_description ?? false,
    // Секції меню
    menu_sections: template?.menu_sections || ["Холодні закуски", "Салати", "Гарячі страви", "Гарнір", "Десерти", "Напої"],
    // Підсумки
    show_weight_summary: template?.show_weight_summary ?? true,
    show_weight_per_person: template?.show_weight_per_person ?? true,
    show_equipment_block: template?.show_equipment_block ?? true,
    show_service_block: template?.show_service_block ?? true,
    show_transport_block: template?.show_transport_block ?? true,
    show_discount_block: template?.show_discount_block ?? false,
    // Тексти
    menu_title: template?.menu_title || "Меню",
    summary_title: template?.summary_title || "Підсумок",
    footer_text: template?.footer_text || "",
    // Layout
    page_orientation: template?.page_orientation || "portrait",
    items_per_page: template?.items_per_page || 20,
  });

  const uploadImages = async () => {
    const uploads: Record<string, string> = {};

    for (const type of ["header", "background", "logo"]) {
      const imageKey = `${type}_image` as keyof typeof formData;
      const file = formData[imageKey];

      if (file instanceof File) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);

        try {
          const response = await fetch(
            `/api/templates/upload-image?image_type=${type}`,
            {
              method: "POST",
              body: formDataUpload,
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to upload ${type} image`);
          }

          const data = await response.json();
          uploads[type] = data.url;
        } catch (error) {
          console.error(`Error uploading ${type} image:`, error);
        }
      }
    }

    return uploads;
  };

  const handleSave = async () => {
    // Валідація
    if (!formData.name) {
      alert("Будь ласка, введіть назву шаблону");
      return;
    }

    setIsSaving(true);

    try {
      // 1. Upload зображень (якщо є нові File)
      const uploadedImages = await uploadImages();

      // 2. Підготовка даних для збереження
      const templateData = {
        ...formData,
        header_image: uploadedImages.header || (typeof formData.header_image === "string" ? formData.header_image : undefined),
        background_image: uploadedImages.background || (typeof formData.background_image === "string" ? formData.background_image : undefined),
        logo_image: uploadedImages.logo || (typeof formData.logo_image === "string" ? formData.logo_image : undefined),
      };

      // 3. Збереження через callback
      await onSave(templateData);

    } catch (error) {
      console.error("Error saving template:", error);
      alert("Помилка збереження шаблону");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="h-16 border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">
              {template ? "Редагувати шаблон" : "Новий шаблон"}
            </h2>
            <p className="text-xs text-gray-500">{formData.name || "Без назви"}</p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Збереження..." : "Зберегти"}
        </Button>
      </div>

      {/* Split Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* Preview (ліворуч, займає максимум простору) */}
        <div className="flex-1 min-w-[720px] border-r bg-gray-100">
          <TemplatePreview
            design={formData}
            templateName={formData.name}
          />
        </div>

        {/* Settings Panel (праворуч, фіксована ширина) */}
        <div className="w-full max-w-md flex flex-col">
          <Tabs defaultValue="design" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start px-4 border-b rounded-none">
              <TabsTrigger value="design" className="gap-2">
                <Palette className="w-4 h-4" />
                Дизайн
              </TabsTrigger>
              <TabsTrigger value="content" className="gap-2">
                <FileText className="w-4 h-4" />
                Контент
              </TabsTrigger>
              <TabsTrigger value="structure" className="gap-2">
                <Settings className="w-4 h-4" />
                Структура
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              {/* Tab 1: Дизайн */}
              <TabsContent value="design" className="p-6 space-y-6 m-0">
                {/* Назва та опис */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Назва шаблону <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Наприклад: Корпоративний шаблон"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Опис</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      placeholder="Короткий опис призначення шаблону"
                    />
                  </div>
                </div>

                {/* Кольорова схема */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Кольорова палітра</h3>
                  <div className="space-y-4">
                    <ColorPicker
                      label="Основний колір (акценти, заголовки)"
                      value={formData.primary_color}
                      onChange={(color) => setFormData({ ...formData, primary_color: color })}
                      presets={["#FF5A00", "#2563EB", "#10B981", "#8B5CF6", "#F59E0B"]}
                    />
                    <ColorPicker
                      label="Колір тексту"
                      value={formData.text_color}
                      onChange={(color) => setFormData({ ...formData, text_color: color })}
                      presets={["#1A1A1A", "#374151", "#6B7280", "#111827"]}
                    />
                    <ColorPicker
                      label="Колір фону"
                      value={formData.secondary_color}
                      onChange={(color) => setFormData({ ...formData, secondary_color: color })}
                      presets={["#FFFFFF", "#F9FAFB", "#FEF3F2", "#FFFBEB"]}
                    />
                  </div>
                </div>

                {/* Шрифт */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Шрифт</h3>
                  <Select
                    value={formData.font_family}
                    onValueChange={(value) => setFormData({ ...formData, font_family: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter, sans-serif">Inter (сучасний)</SelectItem>
                      <SelectItem value="Roboto, Arial, sans-serif">Roboto (класичний)</SelectItem>
                      <SelectItem value="'Playfair Display', serif">Playfair Display (елегантний)</SelectItem>
                      <SelectItem value="'Open Sans', sans-serif">Open Sans (універсальний)</SelectItem>
                      <SelectItem value="'Montserrat', sans-serif">Montserrat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Зображення */}
                <div>
                  <h3 className="text-sm font-semibold mb-1">Зображення</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Спочатку завантаж логотип, а нижче — широку картинку шапки PDF (банер над меню).
                  </p>
                  <ImageUploader
                    label="Логотип компанії (лівий верхній кут)"
                    currentImage={template?.header_image_url || formData.logo_image}
                    onUpload={(file) => setFormData({ ...formData, logo_image: file })}
                    onRemove={() => setFormData({ ...formData, logo_image: null })}
                    aspectRatio="16:9"
                    maxSize="2MB"
                  />
                  <ImageUploader
                    label="Зображення шапки сторінки (банер)"
                    currentImage={template?.header_image_url || formData.header_image}
                    onUpload={(file) => setFormData({ ...formData, header_image: file })}
                    onRemove={() => setFormData({ ...formData, header_image: null })}
                    aspectRatio="21:9"
                    maxSize="5MB"
                  />
                  <ImageUploader
                    label="Фонове зображення (опціонально)"
                    currentImage={template?.background_image_url || formData.background_image}
                    onUpload={(file) => setFormData({ ...formData, background_image: file })}
                    onRemove={() => setFormData({ ...formData, background_image: null })}
                    aspectRatio="free"
                    maxSize="5MB"
                  />
                </div>
              </TabsContent>

              {/* Tab 2: Контент */}
              <TabsContent value="content" className="p-6 space-y-6 m-0">
                {/* Назви секцій */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Заголовки</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium block mb-1">Заголовок секції меню</label>
                      <Input
                        type="text"
                        value={formData.menu_title}
                        onChange={(e) => setFormData({ ...formData, menu_title: e.target.value })}
                        placeholder="Меню"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium block mb-1">Заголовок підсумку</label>
                      <Input
                        type="text"
                        value={formData.summary_title}
                        onChange={(e) => setFormData({ ...formData, summary_title: e.target.value })}
                        placeholder="Підсумок"
                      />
                    </div>
                  </div>
                </div>

                {/* Секції меню (редагування списку) */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Секції меню</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Страви будуть згруповані за цими категоріями в PDF
                  </p>

                  <DraggableSectionList
                    sections={formData.menu_sections}
                    onChange={(newSections) => setFormData({ ...formData, menu_sections: newSections })}
                  />
                </div>

                {/* Футер */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Текст внизу PDF</h3>
                  <Textarea
                    value={formData.footer_text}
                    onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })}
                    className="resize-none"
                    rows={3}
                    placeholder="Дякуємо за вибір нашої компанії!&#10;Контакти: +380..."
                  />
                </div>
              </TabsContent>

              {/* Tab 3: Структура */}
              <TabsContent value="structure" className="p-6 space-y-6 m-0">
                {/* Секції меню */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Секції меню</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Страви будуть згруповані за цими категоріями
                  </p>
                  <div className="space-y-2">
                    {formData.menu_sections.map((section, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
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
                          className="text-red-600 hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
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
                          menu_sections: [...formData.menu_sections, "Нова секція"],
                        });
                      }}
                      className="w-full"
                    >
                      + Додати секцію
                    </Button>
                  </div>
                </div>

                {/* Підсумкові блоки */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Показувати в підсумку</h3>
                  <div className="space-y-2">
                    {[
                      { key: "show_weight_summary", label: "Загальна вага" },
                      { key: "show_weight_per_person", label: "Вага на персону" },
                      { key: "show_equipment_block", label: "Оренда обладнання" },
                      { key: "show_service_block", label: "Обслуговування" },
                      { key: "show_transport_block", label: "Доставка" },
                      { key: "show_discount_block", label: "Знижка" },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={formData[item.key as keyof typeof formData] as boolean}
                          onChange={(e) =>
                            setFormData({ ...formData, [item.key]: e.target.checked })
                          }
                          className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <span className="text-sm">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Орієнтація */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Орієнтація сторінки</h3>
                  <div className="flex gap-3">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="orientation"
                        value="portrait"
                        checked={formData.page_orientation === "portrait"}
                        onChange={(e) =>
                          setFormData({ ...formData, page_orientation: e.target.value as "portrait" | "landscape" })
                        }
                        className="peer sr-only"
                      />
                      <div className="border-2 rounded-lg p-4 text-center peer-checked:border-orange-500 peer-checked:bg-orange-50">
                        <div className="w-12 h-16 bg-gray-200 mx-auto mb-2 rounded"></div>
                        <span className="text-sm font-medium">Портретна</span>
                      </div>
                    </label>
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="orientation"
                        value="landscape"
                        checked={formData.page_orientation === "landscape"}
                        onChange={(e) =>
                          setFormData({ ...formData, page_orientation: e.target.value as "portrait" | "landscape" })
                        }
                        className="peer sr-only"
                      />
                      <div className="border-2 rounded-lg p-4 text-center peer-checked:border-orange-500 peer-checked:bg-orange-50">
                        <div className="w-16 h-12 bg-gray-200 mx-auto mb-2 rounded"></div>
                        <span className="text-sm font-medium">Альбомна</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* За замовчуванням */}
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="is-default"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <Label htmlFor="is-default" className="text-sm font-medium cursor-pointer">
                    Зробити шаблоном за замовчуванням
                  </Label>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

