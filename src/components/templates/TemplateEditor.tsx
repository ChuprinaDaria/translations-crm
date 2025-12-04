import React, { useState } from "react";
import { X, Save, Palette, FileText, Settings } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { ColorPicker } from "./ColorPicker";
import { ImageUploader } from "./ImageUploader";
import { TemplatePreview } from "./TemplatePreview";
import { DraggableSectionList } from "./DraggableSectionList";
import type { Template as ApiTemplate } from "../../lib/api";

interface TemplateEditorProps {
  template?: ApiTemplate | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

type TemplateDesign = {
  name: string;
  description: string;
  is_default: boolean;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  font_family: string;
  logo_image: File | string | null;
  header_image: File | string | null;
  background_image: File | string | null;
  show_item_photo: boolean;
  show_item_weight: boolean;
  show_item_quantity: boolean;
  show_item_price: boolean;
  show_item_total: boolean;
  show_item_description: boolean;
  menu_sections: string[];
  show_weight_summary: boolean;
  show_weight_per_person: boolean;
  show_equipment_block: boolean;
  show_service_block: boolean;
  show_transport_block: boolean;
  show_discount_block: boolean;
  menu_title: string;
  summary_title: string;
  footer_text: string;
  page_orientation: string;
  items_per_page: number;
};

// Компонент DesignTab
function DesignTab({
  design,
  setDesign,
}: {
  design: TemplateDesign;
  setDesign: (d: TemplateDesign) => void;
}) {
  return (
    <div className="p-6 space-y-8">
      {/* Назва шаблону */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Назва шаблону <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={design.name}
          onChange={(e) => setDesign({ ...design, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="Наприклад: Корпоративний шаблон"
        />
      </div>

      {/* Опис */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Опис
        </label>
        <textarea
          value={design.description}
          onChange={(e) => setDesign({ ...design, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          rows={2}
          placeholder="Короткий опис призначення шаблону"
        />
      </div>

      {/* Кольорова палітра */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Кольорова палітра</h3>
        <div className="space-y-4">
          <ColorPicker
            label="Основний колір (акценти, заголовки)"
            value={design.primary_color}
            onChange={(color) => setDesign({ ...design, primary_color: color })}
            presets={["#FF5A00", "#2563EB", "#10B981", "#8B5CF6", "#F59E0B"]}
          />
          <ColorPicker
            label="Колір тексту"
            value={design.text_color}
            onChange={(color) => setDesign({ ...design, text_color: color })}
            presets={["#1A1A1A", "#374151", "#6B7280", "#000000"]}
          />
          <ColorPicker
            label="Колір фону"
            value={design.secondary_color}
            onChange={(color) => setDesign({ ...design, secondary_color: color })}
            presets={["#FFFFFF", "#F9FAFB", "#FEF3F2", "#FFFBEB"]}
          />
        </div>
      </div>

      {/* Шрифт */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Шрифт
        </label>
        <select
          value={design.font_family}
          onChange={(e) => setDesign({ ...design, font_family: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        >
          <option value="Inter, sans-serif">Inter (сучасний)</option>
          <option value="Roboto, Arial, sans-serif">Roboto (класичний)</option>
          <option value="'Playfair Display', serif">Playfair Display (елегантний)</option>
          <option value="'Open Sans', sans-serif">Open Sans (універсальний)</option>
        </select>
      </div>

      {/* Зображення */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Зображення</h3>

        <ImageUploader
          label="Логотип компанії (лівий верхній кут)"
          currentImage={design.logo_image}
          onUpload={(file) => setDesign({ ...design, logo_image: file })}
          onRemove={() => setDesign({ ...design, logo_image: null })}
          helperText="Співвідношення 16:9 • Максимум 2MB"
          aspectRatio="16:9"
          maxSize="2MB"
        />

        <ImageUploader
          label="Зображення шапки (опціонально)"
          currentImage={design.header_image}
          onUpload={(file) => setDesign({ ...design, header_image: file })}
          onRemove={() => setDesign({ ...design, header_image: null })}
          helperText="Широка картинка шапки • Максимум 2MB"
          aspectRatio="21:9"
          maxSize="2MB"
        />

        <ImageUploader
          label="Фонове зображення (опціонально)"
          currentImage={design.background_image}
          onUpload={(file) => setDesign({ ...design, background_image: file })}
          onRemove={() => setDesign({ ...design, background_image: null })}
          helperText="Буде розміщено як watermark • Максимум 2MB"
          aspectRatio="free"
          maxSize="2MB"
        />
      </div>
    </div>
  );
}

// Компонент ContentTab
function ContentTab({
  design,
  setDesign,
}: {
  design: TemplateDesign;
  setDesign: (d: TemplateDesign) => void;
}) {
  return (
    <div className="p-6 space-y-6">
      {/* Назви секцій */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Заголовки</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1">Заголовок секції меню</label>
            <Input
              type="text"
              value={design.menu_title}
              onChange={(e) => setDesign({ ...design, menu_title: e.target.value })}
              placeholder="Меню"
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Заголовок підсумку</label>
            <Input
              type="text"
              value={design.summary_title}
              onChange={(e) => setDesign({ ...design, summary_title: e.target.value })}
              placeholder="Підсумок"
            />
          </div>
        </div>
      </div>

      {/* Секції меню */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Секції меню</h3>
        <p className="text-xs text-gray-500 mb-3">
          Страви будуть згруповані за цими категоріями в PDF
        </p>

        <DraggableSectionList
          sections={design.menu_sections}
          onChange={(newSections) => setDesign({ ...design, menu_sections: newSections })}
        />
      </div>

      {/* Футер */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Текст внизу PDF</h3>
        <Textarea
          value={design.footer_text}
          onChange={(e) => setDesign({ ...design, footer_text: e.target.value })}
          className="resize-none"
          rows={3}
          placeholder="Дякуємо за вибір нашої компанії!&#10;Контакти: +380..."
        />
      </div>
    </div>
  );
}

// Компонент StructureTab
function StructureTab({
  design,
  setDesign,
}: {
  design: TemplateDesign;
  setDesign: (d: TemplateDesign) => void;
}) {
  return (
    <div className="p-6 space-y-6">
      {/* Колонки таблиці */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Колонки таблиці меню</h3>
        <div className="space-y-2">
          {[
            { key: "show_item_photo", label: "Показувати фото" },
            { key: "show_item_weight", label: "Показувати вагу" },
            { key: "show_item_quantity", label: "Показувати кількість" },
            { key: "show_item_price", label: "Показувати ціну" },
            { key: "show_item_total", label: "Показувати суму" },
            { key: "show_item_description", label: "Показувати опис" },
          ].map((item) => (
            <label key={item.key} className="flex items-center gap-2 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={design[item.key as keyof TemplateDesign] as boolean}
                onChange={(e) =>
                  setDesign({ ...design, [item.key]: e.target.checked })
                }
                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm">{item.label}</span>
            </label>
          ))}
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
                checked={design[item.key as keyof TemplateDesign] as boolean}
                onChange={(e) =>
                  setDesign({ ...design, [item.key]: e.target.checked })
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
              checked={design.page_orientation === "portrait"}
              onChange={(e) => setDesign({ ...design, page_orientation: e.target.value })}
              className="mr-2"
            />
            <span className="text-sm">Книжкова</span>
          </label>
          <label className="flex-1 cursor-pointer">
            <input
              type="radio"
              name="orientation"
              value="landscape"
              checked={design.page_orientation === "landscape"}
              onChange={(e) => setDesign({ ...design, page_orientation: e.target.value })}
              className="mr-2"
            />
            <span className="text-sm">Альбомна</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export function TemplateEditor({ template, onSave, onClose }: TemplateEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"design" | "content" | "structure">("design");
  const [formData, setFormData] = useState<TemplateDesign>({
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

      {/* Main content: Preview + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Preview (ліворуч) - 65% ширини */}
        <div className="flex-1 bg-gray-100 p-6 overflow-auto">
          <TemplatePreview
            design={formData}
            templateName={formData.name}
          />
        </div>

        {/* Sidebar (праворуч) - фіксована ширина 450px */}
        <div className="w-[450px] border-l bg-white flex flex-col">
          {/* Tabs */}
          <div className="border-b px-6 pt-4">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab("design")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                  activeTab === "design"
                    ? "bg-white text-orange-600 border-t-2 border-orange-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Palette className="w-4 h-4 inline mr-2" />
                Дизайн
              </button>
              <button
                onClick={() => setActiveTab("content")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                  activeTab === "content"
                    ? "bg-white text-orange-600 border-t-2 border-orange-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Контент
              </button>
              <button
                onClick={() => setActiveTab("structure")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                  activeTab === "structure"
                    ? "bg-white text-orange-600 border-t-2 border-orange-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Settings className="w-4 h-4 inline mr-2" />
                Структура
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "design" && (
              <DesignTab design={formData} setDesign={setFormData} />
            )}
            {activeTab === "content" && (
              <ContentTab design={formData} setDesign={setFormData} />
            )}
            {activeTab === "structure" && (
              <StructureTab design={formData} setDesign={setFormData} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
