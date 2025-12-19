import React, { useState, useRef } from "react";
import { X, Save, Palette, FileText, Settings, Image, Upload, Trash2, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { ColorPicker } from "./ColorPicker";
import { ImageUploader } from "./ImageUploader";
import { TemplatePreview } from "./TemplatePreview";
import { DraggableSectionList } from "./DraggableSectionList";
import { toast } from "sonner";
import { templatesApi, getImageUrl, tokenManager, type Template as ApiTemplate } from "../../lib/api";

interface TemplateEditorProps {
  template?: ApiTemplate | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

// Список доступних шрифтів Google Fonts
const AVAILABLE_FONTS = [
  { name: "Montserrat", value: "Montserrat, Arial, sans-serif" },
  { name: "Inter", value: "Inter, Arial, sans-serif" },
  { name: "Roboto", value: "Roboto, Arial, sans-serif" },
  { name: "Open Sans", value: "Open Sans, Arial, sans-serif" },
  { name: "Playfair Display", value: "Playfair Display, Georgia, serif" },
  { name: "Oswald", value: "Oswald, Arial, sans-serif" },
  { name: "Lora", value: "Lora, Georgia, serif" },
  { name: "Raleway", value: "Raleway, Arial, sans-serif" },
  { name: "PT Sans", value: "PT Sans, Arial, sans-serif" },
  { name: "Nunito", value: "Nunito, Arial, sans-serif" },
  { name: "Source Sans 3", value: "Source Sans 3, Arial, sans-serif" },
  { name: "Merriweather", value: "Merriweather, Georgia, serif" },
  { name: "Poppins", value: "Poppins, Arial, sans-serif" },
  { name: "Ubuntu", value: "Ubuntu, Arial, sans-serif" },
  { name: "Gilroy", value: "Gilroy, Arial, sans-serif" },
];

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
  category_separator_image: File | string | null;
  // Заголовок КП
  title_text: string;
  company_name: string;
  // Шрифти для різних елементів
  title_font: string;
  header_font: string;
  body_font: string;
  table_font: string;
  // Кольори елементів PDF
  format_bg_color: string;
  table_header_bg_color: string;
  category_bg_color: string;
  summary_bg_color: string;
  total_bg_color: string;
  // Налаштування тексту категорій та страв
  category_text_align: string;  // left, center, right
  category_text_color: string;
  dish_text_align: string;  // left, center, right
  dish_text_color: string;
  // Налаштування таблиці
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
  gallery_photos: string[];
  booking_terms: string;
};

// Компонент для завантаження галереї фото (9 фото по 3 в рядок)
function GalleryUploader({
  templateId,
  photos,
  onPhotosChange,
}: {
  templateId?: number;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}) {
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    if (photos.length >= 9) {
      toast.error("Максимум 9 фото");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валідація типу файлу
    if (!file.type.startsWith("image/")) {
      toast.error("Дозволені лише зображення");
      return;
    }

    // Валідація розміру (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл занадто великий (максимум 5MB)");
      return;
    }

    if (!templateId) {
      // Якщо шаблон ще не збережений - показуємо попередження
      toast.error("Спочатку збережіть шаблон, потім додайте фото галереї");
      return;
    }

    setUploading(photos.length);

    try {
      const result = await templatesApi.uploadGalleryPhoto(templateId, file);
      onPhotosChange(result.gallery_photos);
      toast.success("Фото додано");
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Помилка завантаження фото");
    } finally {
      setUploading(null);
      // Очищаємо input для можливості повторного вибору того ж файлу
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeletePhoto = async (index: number) => {
    if (!templateId) return;

    try {
      const result = await templatesApi.deleteGalleryPhoto(templateId, index);
      onPhotosChange(result.gallery_photos);
      toast.success("Фото видалено");
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast.error("Помилка видалення фото");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Галерея фото ({photos.length}/9)
        </h3>
        <span className="text-xs text-gray-500">3×3</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Фото для PDF (по 3 в рядок)
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Компактна сітка 3x3 */}
      <div className="grid grid-cols-3 gap-2" style={{ maxWidth: '280px' }}>
        {/* Існуючі фото */}
        {photos.map((photo, index) => (
          <div
            key={index}
            className="relative bg-gray-100 rounded-lg overflow-hidden group"
            style={{ width: '85px', height: '85px' }}
          >
            <img
              src={getImageUrl(photo)}
              alt={`Gallery ${index + 1}`}
              className="object-cover"
              style={{ width: '85px', height: '85px' }}
            />
            <button
              onClick={() => handleDeletePhoto(index)}
              className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-sm"
              title="Видалити фото"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <div className="absolute bottom-0.5 left-0.5 bg-black/50 text-white text-[9px] px-1 py-0.5 rounded">
              {index + 1}
            </div>
          </div>
        ))}

        {/* Слот для завантаження */}
        {photos.length < 9 && (
          <button
            onClick={handleUploadClick}
            disabled={uploading !== null}
            className="border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-orange-400 hover:bg-orange-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ width: '85px', height: '85px' }}
          >
            {uploading !== null ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-500 border-t-transparent" />
            ) : (
              <>
                <Plus className="w-5 h-5 text-gray-400" />
                <span className="text-[10px] text-gray-500">Додати</span>
              </>
            )}
          </button>
        )}

        {/* Порожні слоти - тільки якщо менше 9 фото */}
        {Array.from({ length: Math.max(0, 8 - photos.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="border border-dashed border-gray-200 rounded-lg flex items-center justify-center"
            style={{ width: '85px', height: '85px' }}
          >
            <Image className="w-4 h-4 text-gray-300" />
          </div>
        ))}
      </div>

      {!templateId && (
        <p className="text-xs text-amber-600 mt-2 p-2 bg-amber-50 rounded">
          💡 Збережіть шаблон, щоб додати фото
        </p>
      )}
    </div>
  );
}

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

      {/* Основні кольори */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Основні кольори</h3>
        <div className="space-y-4">
          <ColorPicker
            label="Основний колір (акценти, заголовки)"
            value={design.primary_color}
            onChange={(color) => setDesign({ ...design, primary_color: color })}
            presets={["#FF5A00", "#FF8C00", "#2563EB", "#10B981", "#8B5CF6"]}
          />
          <ColorPicker
            label="Колір тексту"
            value={design.text_color}
            onChange={(color) => setDesign({ ...design, text_color: color })}
            presets={["#1A1A1A", "#374151", "#6B7280", "#000000"]}
          />
        </div>
      </div>

      {/* Кольори елементів PDF */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Кольори елементів PDF</h3>
        <div className="space-y-4">
          <ColorPicker
            label="Фон формату заходу (ФУРШЕТ 13:30-14:30)"
            value={design.format_bg_color}
            onChange={(color) => setDesign({ ...design, format_bg_color: color })}
            presets={["#FF8C00", "#FF5A00", "#FFA500", "#2563EB", "#10B981"]}
          />
          <ColorPicker
            label="Фон шапки таблиці (НАЗВА, ФОТО, ВАГА...)"
            value={design.table_header_bg_color}
            onChange={(color) => setDesign({ ...design, table_header_bg_color: color })}
            presets={["#FFA500", "#FF8C00", "#FFB84D", "#2563EB", "#10B981"]}
          />
          <ColorPicker
            label="Фон категорій страв (ХОЛОДНІ ЗАКУСКИ...)"
            value={design.category_bg_color}
            onChange={(color) => setDesign({ ...design, category_bg_color: color })}
            presets={["#FFB84D", "#FFA500", "#FFCC80", "#93C5FD", "#6EE7B7"]}
          />
          <ColorPicker
            label="Фон підсумку (ДО СПЛАТИ ЗА...)"
            value={design.summary_bg_color}
            onChange={(color) => setDesign({ ...design, summary_bg_color: color })}
            presets={["#F3F4F6", "#E5E7EB", "#FEF3C7", "#DBEAFE", "#D1FAE5"]}
          />
          <ColorPicker
            label="Фон ВСЬОГО ДО СПЛАТИ"
            value={design.total_bg_color}
            onChange={(color) => setDesign({ ...design, total_bg_color: color })}
            presets={["#FF8C00", "#FF5A00", "#FFA500", "#2563EB", "#10B981"]}
          />
        </div>
      </div>

      {/* Налаштування тексту категорій та страв */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Текст категорій та страв</h3>
        <div className="space-y-4">
          {/* Вирівнювання тексту категорій */}
          <div>
            <label className="block text-xs text-gray-600 mb-2">Вирівнювання тексту категорій</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDesign({ ...design, category_text_align: "left" })}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  design.category_text_align === "left"
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Ліворуч
              </button>
              <button
                type="button"
                onClick={() => setDesign({ ...design, category_text_align: "center" })}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  design.category_text_align === "center"
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                По центру
              </button>
              <button
                type="button"
                onClick={() => setDesign({ ...design, category_text_align: "right" })}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  design.category_text_align === "right"
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                Праворуч
              </button>
            </div>
          </div>
          
          {/* Колір тексту категорій */}
          <ColorPicker
            label="Колір тексту категорій"
            value={design.category_text_color}
            onChange={(color) => setDesign({ ...design, category_text_color: color })}
            presets={["#FFFFFF", "#000000", "#333333", "#FF8C00", "#2563EB"]}
          />
        </div>
      </div>

      {/* Заголовок КП */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Заголовок КП</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Текст заголовка</label>
            <input
              type="text"
              value={design.title_text}
              onChange={(e) => setDesign({ ...design, title_text: e.target.value })}
              placeholder="КОМЕРЦІЙНА ПРОПОЗИЦІЯ"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Назва компанії</label>
            <input
              type="text"
              value={design.company_name}
              onChange={(e) => setDesign({ ...design, company_name: e.target.value })}
              placeholder="ДЗИҐА КЕЙТЕРІНҐ"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Шрифти */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Шрифти</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Заголовок (КОМЕРЦІЙНА ПРОПОЗИЦІЯ)</label>
            <select
              value={design.title_font}
              onChange={(e) => setDesign({ ...design, title_font: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            >
              {AVAILABLE_FONTS.map((font) => (
                <option key={font.value} value={font.value}>{font.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Секції (ФУРШЕТ, ОБЛАДНАННЯ...)</label>
            <select
              value={design.header_font}
              onChange={(e) => setDesign({ ...design, header_font: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            >
              {AVAILABLE_FONTS.map((font) => (
                <option key={font.value} value={font.value}>{font.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Основний текст</label>
            <select
              value={design.body_font}
              onChange={(e) => setDesign({ ...design, body_font: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            >
              {AVAILABLE_FONTS.map((font) => (
                <option key={font.value} value={font.value}>{font.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Таблиця меню</label>
            <select
              value={design.table_font}
              onChange={(e) => setDesign({ ...design, table_font: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
            >
              {AVAILABLE_FONTS.map((font) => (
                <option key={font.value} value={font.value}>{font.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Зображення */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Зображення</h3>

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
          label="Розділювач категорій страв (опціонально)"
          currentImage={design.category_separator_image}
          onUpload={(file) => setDesign({ ...design, category_separator_image: file })}
          onRemove={() => setDesign({ ...design, category_separator_image: null })}
          helperText="PNG зображення на всю ширину сторінки (вузьке, але широке) • Рекомендовано: 800px × 40px • Максимум 2MB • Додається ПЕРЕД кожною категорією страв"
          aspectRatio="auto"
          maxSize="2MB"
          compactPreview={true}
        />
      </div>
    </div>
  );
}

// Компонент ContentTab
function ContentTab({
  design,
  setDesign,
  templateId,
}: {
  design: TemplateDesign;
  setDesign: (d: TemplateDesign) => void;
  templateId?: number;
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

      {/* Умови бронювання */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Умови бронювання</h3>
        <p className="text-xs text-gray-500 mb-3">
          Кожен пункт з нового рядка. Буде відображено зі списком (•) в PDF.
        </p>
        <Textarea
          value={design.booking_terms}
          onChange={(e) => setDesign({ ...design, booking_terms: e.target.value })}
          className="resize-none font-mono text-sm"
          rows={10}
          placeholder={`Дата бронюється після передоплати за захід
Передоплата сплачується в розмірі 50%, залишок сплачується в день заходу
Передоплата повертається у розмірі 30% при повідомленні про відміну заходу за 5 днів до броньованої дати
Передоплата не повертається при повідомленні про відміну заходу за 3 дні добронбованої дати
Оплата можлива готівкою або оплатою на рахунок ФОП 3-ї групи
У разі продовження заходу на 1 годину оплата буде становити 5% від загальної суми заходу
Бій/втрата одиниці посуду - 150 грн/шт`}
        />
      </div>

      {/* Галерея фото */}
      <GalleryUploader
        templateId={templateId}
        photos={design.gallery_photos}
        onPhotosChange={(photos) => setDesign({ ...design, gallery_photos: photos })}
      />

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
    // Основні кольори
    primary_color: template?.primary_color ?? "#FF5A00",
    secondary_color: template?.secondary_color ?? "#FFFFFF",
    text_color: template?.text_color ?? "#1A1A1A",
    font_family: template?.font_family ?? "Inter, sans-serif",
    // Заголовок КП
    title_text: template?.title_text ?? "КОМЕРЦІЙНА ПРОПОЗИЦІЯ",
    company_name: template?.company_name ?? "ДЗИҐА КЕЙТЕРІНҐ",
    // Шрифти для різних елементів
    title_font: template?.title_font ?? "Montserrat, Arial, sans-serif",
    header_font: template?.header_font ?? "Montserrat, Arial, sans-serif",
    body_font: template?.body_font ?? "Inter, Arial, sans-serif",
    table_font: template?.table_font ?? "Inter, Arial, sans-serif",
    // Зображення (зберігаємо URL якщо вже завантажено, інакше null для нового файлу)
    logo_image: (template?.preview_image_url ? template.preview_image_url : null) as File | string | null,
    header_image: (template?.header_image_url ? template.header_image_url : null) as File | string | null,
    category_separator_image: (template?.category_separator_image_url ? template.category_separator_image_url : null) as File | string | null,
    // Кольори елементів PDF
    format_bg_color: template?.format_bg_color ?? "#FF8C00",
    table_header_bg_color: template?.table_header_bg_color ?? "#FFA500",
    category_bg_color: template?.category_bg_color ?? "#FFB84D",
    summary_bg_color: template?.summary_bg_color ?? "#F3F4F6",
    total_bg_color: template?.total_bg_color ?? "#FF8C00",
    // Налаштування тексту категорій та страв
    category_text_align: template?.category_text_align ?? "center",
    category_text_color: template?.category_text_color !== undefined && template?.category_text_color !== null ? template.category_text_color : "#FFFFFF",
    dish_text_align: template?.dish_text_align ?? "left",
    dish_text_color: template?.dish_text_color !== undefined && template?.dish_text_color !== null ? template.dish_text_color : "#333333",
    // Структура таблиці
    show_item_photo: template?.show_item_photo ?? true,
    show_item_weight: template?.show_item_weight ?? true,
    show_item_quantity: template?.show_item_quantity ?? true,
    show_item_price: template?.show_item_price ?? true,
    show_item_total: template?.show_item_total ?? true,
    show_item_description: template?.show_item_description ?? false,
    // Секції меню (зберігаємо порядок)
    menu_sections: Array.isArray(template?.menu_sections) ? template.menu_sections : (template?.menu_sections ? [template.menu_sections] : ["Холодні закуски", "Салати", "Гарячі страви", "Гарнір", "Десерти", "Напої"]),
    // Підсумки
    show_weight_summary: template?.show_weight_summary ?? true,
    show_weight_per_person: template?.show_weight_per_person ?? true,
    show_equipment_block: template?.show_equipment_block ?? true,
    show_service_block: template?.show_service_block ?? true,
    show_transport_block: template?.show_transport_block ?? true,
    show_discount_block: template?.show_discount_block ?? false,
    // Тексти
    menu_title: template?.menu_title ?? "Меню",
    summary_title: template?.summary_title ?? "Підсумок",
    footer_text: template?.footer_text ?? "",
    // Layout
    page_orientation: template?.page_orientation ?? "portrait",
    items_per_page: template?.items_per_page ?? 20,
    // Галерея фото
    gallery_photos: template?.gallery_photos || [],
    // Умови бронювання
    booking_terms: template?.booking_terms || "",
  });

  const uploadImages = async () => {
    const uploads: Record<string, string> = {};

    // Мапінг типів зображень до ключів у formData
    const imageMappings: Record<string, keyof typeof formData> = {
      header: "header_image",
      logo: "logo_image",
      separator: "category_separator_image",
    };

    for (const [type, imageKey] of Object.entries(imageMappings)) {
      const file = formData[imageKey];

      if (file instanceof File) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);

        try {
          // Отримуємо токен для авторизації через tokenManager
          const token = tokenManager.getToken();
          const headers: HeadersInit = {};
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
          
          // Додаємо image_type до FormData (бекенд очікує Form параметр, а не query)
          formDataUpload.append("image_type", type);
          
          const response = await fetch(
            `/api/templates/upload-image`,
            {
              method: "POST",
              headers,
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
        // Якщо є новий завантажений файл - використовуємо його URL, інакше зберігаємо існуючий URL
        header_image: uploadedImages.header ? undefined : (typeof formData.header_image === "string" ? formData.header_image : undefined),
        header_image_url: uploadedImages.header || (typeof formData.header_image === "string" ? formData.header_image : (template?.header_image_url ?? "")),
        logo_image: uploadedImages.logo ? undefined : (typeof formData.logo_image === "string" ? formData.logo_image : undefined),
        preview_image_url: uploadedImages.logo || (typeof formData.logo_image === "string" ? formData.logo_image : (template?.preview_image_url ?? "")),
        category_separator_image: uploadedImages.separator ? undefined : (typeof formData.category_separator_image === "string" ? formData.category_separator_image : undefined),
        category_separator_image_url: uploadedImages.separator || (typeof formData.category_separator_image === "string" ? formData.category_separator_image : (template?.category_separator_image_url ?? "")),
      };

      // 3. Збереження через callback
      await onSave(templateData);
      
      // 4. Показуємо успішне повідомлення та закриваємо редактор
      console.log("Template saved successfully!");

    } catch (error) {
      console.error("Error saving template:", error);
      alert("Помилка збереження шаблону");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header - sticky з тінню */}
      <div className="sticky top-0 z-20 h-16 border-b bg-white shadow-md flex items-center justify-between px-6">
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
          variant="default"
          size="lg"
          className="!bg-[#FF5A00] hover:!bg-[#FF5A00]/90 text-white font-semibold px-6 py-3 shadow-lg"
        >
          <Save className="w-5 h-5 mr-2" />
          {isSaving ? "Збереження..." : "Зберегти шаблон"}
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
              <ContentTab design={formData} setDesign={setFormData} templateId={template?.id} />
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
