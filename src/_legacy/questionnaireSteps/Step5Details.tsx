import React, { useState } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "../ui/command";
import { Check, Plus } from "lucide-react";
import type { Item } from "../../lib/api";

interface Step5DetailsProps {
  selectedEquipment: Item[];
  allEquipment: Item[];
  customEquipmentNote: string;
  paymentMethod: string;
  textileColor: string;
  banquetLineColor: string;
  onEquipmentChange: (equipment: Item[]) => void;
  onCustomEquipmentChange: (note: string) => void;
  onFieldChange: (field: string, value: string) => void;
}

export function Step5Details({
  selectedEquipment,
  allEquipment,
  customEquipmentNote,
  paymentMethod,
  textileColor,
  banquetLineColor,
  onEquipmentChange,
  onCustomEquipmentChange,
  onFieldChange,
}: Step5DetailsProps) {
  const [equipmentOpen, setEquipmentOpen] = useState(false);

  const isValid = () => {
    return true; // Всі поля опціональні
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Деталі</h2>
        <p className="text-sm text-gray-600">Обладнання, оплата та оформлення</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Обладнання</Label>
          <Popover open={equipmentOpen} onOpenChange={setEquipmentOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-12 text-base"
              >
                <div className="flex flex-wrap gap-1 flex-1">
                  {selectedEquipment.length > 0 ? (
                    selectedEquipment.map((item) => (
                      <span
                        key={item.id}
                        className="bg-[#FF5A00]/10 text-[#FF5A00] px-2 py-1 rounded text-xs font-medium"
                      >
                        {item.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">Виберіть обладнання...</span>
                  )}
                </div>
                <Plus className="ml-2 h-5 w-5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" sideOffset={4}>
              <Command className="max-h-[400px]">
                <CommandInput placeholder="Пошук обладнання..." className="h-12" />
                <CommandEmpty>Обладнання не знайдено</CommandEmpty>
                <CommandGroup className="max-h-[350px] overflow-y-auto">
                  {allEquipment.map((item) => {
                    const isSelected = selectedEquipment.some((eq) => eq.id === item.id);
                    return (
                      <CommandItem
                        key={item.id}
                        onSelect={() => {
                          if (isSelected) {
                            onEquipmentChange(selectedEquipment.filter((eq) => eq.id !== item.id));
                          } else {
                            onEquipmentChange([...selectedEquipment, item]);
                          }
                        }}
                        className="h-auto min-h-[48px] py-2 px-3 cursor-pointer"
                      >
                        <Check
                          className={`mr-3 h-5 w-5 shrink-0 ${
                            isSelected ? "opacity-100 text-[#FF5A00]" : "opacity-0"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm leading-tight">{item.name}</div>
                          {item.subcategory?.name && (
                            <div className="text-xs text-gray-500 mt-0.5">{item.subcategory.name}</div>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          
          <Textarea
            value={customEquipmentNote}
            onChange={(e) => onCustomEquipmentChange(e.target.value)}
            placeholder="Додатковий коментар (якщо немає в списку)..."
            rows={2}
            className="text-base min-h-[60px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-method" className="text-sm">
            Спосіб оплати <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Input
            id="payment-method"
            value={paymentMethod}
            onChange={(e) => onFieldChange('payment_method', e.target.value)}
            placeholder="Предоплата/Залишок"
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="textile-color" className="text-sm">
            Колір текстилю <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Input
            id="textile-color"
            value={textileColor}
            onChange={(e) => onFieldChange('textile_color', e.target.value)}
            placeholder="Білий, бежевий..."
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="banquet-line-color" className="text-sm">
            Колір оформлення лінії <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Input
            id="banquet-line-color"
            value={banquetLineColor}
            onChange={(e) => onFieldChange('banquet_line_color', e.target.value)}
            placeholder="Золотий, срібний..."
            className="h-12 text-base"
          />
        </div>
      </div>

      {/* Hidden validator for wizard */}
      <div style={{ display: 'none' }} data-valid={isValid()} />
    </div>
  );
}

