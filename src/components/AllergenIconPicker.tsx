import React, { useState } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { X } from "lucide-react";

interface AllergenIconPickerProps {
  value?: string;
  onChange: (icon: string) => void;
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

  const handleSelectIcon = (iconId: string) => {
    onChange(iconId);
    setIsOpen(false);
  };

  const selectedAllergen = ALLERGEN_ICONS.find(a => a.id === value);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-16 h-16 p-0 text-2xl flex items-center justify-center border-2 hover:border-[#FF5A00] transition-colors"
            >
              {selectedAllergen ? selectedAllergen.icon : "➕"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4" align="start">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Оберіть іконку алергену</h4>
              <div className="grid grid-cols-2 gap-2">
                {ALLERGEN_ICONS.map((allergen) => (
                  <button
                    key={allergen.id}
                    type="button"
                    onClick={() => handleSelectIcon(allergen.id)}
                    className={`p-3 rounded-lg border-2 transition-all hover:bg-gray-50 flex flex-col items-center gap-2 ${
                      value === allergen.id 
                        ? "border-[#FF5A00] bg-[#FF5A00]/10" 
                        : "border-gray-200"
                    }`}
                  >
                    <span className="text-3xl">{allergen.icon}</span>
                    <span className="text-xs text-center text-gray-700 leading-tight">
                      {allergen.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        {value && (
          <div className="flex-1">
            <div className="text-sm text-gray-600">
              {selectedAllergen?.name}
            </div>
          </div>
        )}
        
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Функція для отримання іконки алергену за ID
export function getAllergenIcon(allergenId?: string): string | undefined {
  if (!allergenId) return undefined;
  const allergen = ALLERGEN_ICONS.find(a => a.id === allergenId);
  return allergen?.icon;
}

// Функція для отримання назви алергену за ID
export function getAllergenName(allergenId?: string): string | undefined {
  if (!allergenId) return undefined;
  const allergen = ALLERGEN_ICONS.find(a => a.id === allergenId);
  return allergen?.name;
}

