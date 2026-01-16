import React, { useState } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { X } from "lucide-react";

interface AllergenIconPickerProps {
  value?: string; // Рядок з ідентифікаторами через кому, наприклад: "nuts,garlic"
  onChange: (icons: string) => void; // Повертає рядок з ідентифікаторами через кому
  label?: string;
}

// Іконки алергенів
const ALLERGEN_ICONS = [
  {
    id: "nuts",
    name: "Горіхи та продукти з них",
    icon: "🥜",
    description: "Горіхи та продукти з них"
  },
  {
    id: "garlic",
    name: "Часник та продукти з нього",
    icon: "🧄",
    description: "Часник та продукти з нього"
  },
  {
    id: "honey",
    name: "Мед та продукти з нього",
    icon: "🍯",
    description: "Мед та продукти з нього"
  },
  {
    id: "appearance",
    name: "Змінює зовнішній вигляд",
    icon: "⏰",
    description: "Змінює зовнішній вигляд"
  }
];

export function AllergenIconPicker({ value = "", onChange, label = "Іконка алергену" }: AllergenIconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Розбиваємо рядок на масив ідентифікаторів
  const selectedIds = value ? value.split(",").filter(id => id.trim()) : [];
  
  // Перемикання іконки (додавання або видалення)
  const handleToggleIcon = (iconId: string) => {
    const currentIds = selectedIds;
    const newIds = currentIds.includes(iconId)
      ? currentIds.filter(id => id !== iconId) // Видаляємо, якщо вже вибрано
      : [...currentIds, iconId]; // Додаємо, якщо не вибрано
    
    onChange(newIds.join(","));
  };

  const selectedAllergens = ALLERGEN_ICONS.filter(a => selectedIds.includes(a.id));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-2 flex-wrap">
        {/* Вибрані іконки */}
        {selectedAllergens.map((allergen) => (
          <div key={allergen.id} className="flex items-center gap-1 bg-gray-50 rounded-lg p-2 border border-gray-200">
            <span className="text-2xl">{allergen.icon}</span>
            <span className="text-xs text-gray-700 max-w-[120px] truncate" title={allergen.name}>
              {allergen.name}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleToggleIcon(allergen.id)}
              className="h-6 w-6 p-0 ml-1"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        
        {/* Кнопка для відкриття попапу вибору */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-16 h-16 p-0 text-2xl flex items-center justify-center border-2 hover:border-[#FF5A00] transition-colors"
            >
              ➕
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4" align="start">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Оберіть іконки алергенів</h4>
              <div className="grid grid-cols-2 gap-2">
                {ALLERGEN_ICONS.map((allergen) => {
                  const isSelected = selectedIds.includes(allergen.id);
                  return (
                    <button
                      key={allergen.id}
                      type="button"
                      onClick={() => handleToggleIcon(allergen.id)}
                      className={`p-3 rounded-lg border-2 transition-all hover:bg-gray-50 flex flex-col items-center gap-2 ${
                        isSelected 
                          ? "border-[#FF5A00] bg-[#FF5A00]/10" 
                          : "border-gray-200"
                      }`}
                    >
                      <span className="text-3xl">{allergen.icon}</span>
                      <span className="text-xs text-center text-gray-700 leading-tight">
                        {allergen.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// Функція для отримання іконок алергенів за ID (підтримка множинних іконок)
export function getAllergenIcons(allergenIds?: string): string[] {
  if (!allergenIds) return [];
  const ids = allergenIds.split(",").filter(id => id.trim());
  return ALLERGEN_ICONS
    .filter(a => ids.includes(a.id))
    .map(a => a.icon);
}

// Функція для отримання назв алергенів за ID (підтримка множинних іконок)
export function getAllergenNames(allergenIds?: string): string[] {
  if (!allergenIds) return [];
  const ids = allergenIds.split(",").filter(id => id.trim());
  return ALLERGEN_ICONS
    .filter(a => ids.includes(a.id))
    .map(a => a.name);
}

// Функція для отримання першої іконки алергену за ID (для сумісності зі старим кодом)
export function getAllergenIcon(allergenId?: string): string | undefined {
  if (!allergenId) return undefined;
  const ids = allergenId.split(",").filter(id => id.trim());
  if (ids.length === 0) return undefined;
  const allergen = ALLERGEN_ICONS.find(a => a.id === ids[0]);
  return allergen?.icon;
}

// Функція для отримання назви першого алергену за ID (для сумісності зі старим кодом)
export function getAllergenName(allergenId?: string): string | undefined {
  if (!allergenId) return undefined;
  const ids = allergenId.split(",").filter(id => id.trim());
  if (ids.length === 0) return undefined;
  const allergen = ALLERGEN_ICONS.find(a => a.id === ids[0]);
  return allergen?.name;
}
