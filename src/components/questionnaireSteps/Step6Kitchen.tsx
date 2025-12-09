import React, { useState } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "../ui/command";
import { Check, Plus } from "lucide-react";
import type { Item } from "../../lib/api";

interface Step6KitchenProps {
  dishServingEquipment: Item[];
  hotSnacksEquipment: Item[];
  saladEquipment: Item[];
  allEquipment: Item[];
  customDishServing: string;
  customHotSnacks: string;
  customSalad: string;
  allergies: string;
  hotSnacksPrep: string;
  menuNotes: string;
  clientDrinksNotes: string;
  clientOrderNotes: string;
  onDishServingChange: (equipment: Item[]) => void;
  onHotSnacksChange: (equipment: Item[]) => void;
  onSaladChange: (equipment: Item[]) => void;
  onCustomDishServingChange: (value: string) => void;
  onCustomHotSnacksChange: (value: string) => void;
  onCustomSaladChange: (value: string) => void;
  onFieldChange: (field: string, value: string) => void;
}

export function Step6Kitchen({
  dishServingEquipment,
  hotSnacksEquipment,
  saladEquipment,
  allEquipment,
  customDishServing,
  customHotSnacks,
  customSalad,
  allergies,
  hotSnacksPrep,
  menuNotes,
  clientDrinksNotes,
  clientOrderNotes,
  onDishServingChange,
  onHotSnacksChange,
  onSaladChange,
  onCustomDishServingChange,
  onCustomHotSnacksChange,
  onCustomSaladChange,
  onFieldChange,
}: Step6KitchenProps) {
  const [dishServingOpen, setDishServingOpen] = useState(false);
  const [hotSnacksOpen, setHotSnacksOpen] = useState(false);
  const [saladOpen, setSaladOpen] = useState(false);

  const isValid = () => {
    return true; // Всі поля опціональні
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Кухня</h2>
        <p className="text-sm text-gray-600">Деталі про подачу страв та особливості</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Посуд для подачі страв</Label>
          <Popover open={dishServingOpen} onOpenChange={setDishServingOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-12 text-base"
              >
                <div className="flex flex-wrap gap-1 flex-1">
                  {dishServingEquipment.length > 0 ? (
                    dishServingEquipment.map((item) => (
                      <span
                        key={item.id}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium"
                      >
                        {item.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">Виберіть посуд...</span>
                  )}
                </div>
                <Plus className="ml-2 h-5 w-5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" sideOffset={4}>
              <Command className="max-h-[400px]">
                <CommandInput placeholder="Пошук посуду..." className="h-12" />
                <CommandEmpty>Посуд не знайдено</CommandEmpty>
                <CommandGroup className="max-h-[350px] overflow-y-auto">
                  {allEquipment.map((item) => {
                    const isSelected = dishServingEquipment.some((eq) => eq.id === item.id);
                    return (
                      <CommandItem
                        key={item.id}
                        onSelect={() => {
                          if (isSelected) {
                            onDishServingChange(dishServingEquipment.filter((eq) => eq.id !== item.id));
                          } else {
                            onDishServingChange([...dishServingEquipment, item]);
                          }
                        }}
                        className="h-auto min-h-[48px] py-2 px-3 cursor-pointer"
                      >
                        <Check
                          className={`mr-3 h-5 w-5 shrink-0 ${
                            isSelected ? "opacity-100 text-blue-600" : "opacity-0"
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
          <Input
            value={customDishServing}
            onChange={(e) => onCustomDishServingChange(e.target.value)}
            placeholder="Додатковий коментар..."
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Подача гарячих закусок</Label>
          <Popover open={hotSnacksOpen} onOpenChange={setHotSnacksOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-12 text-base"
              >
                <div className="flex flex-wrap gap-1 flex-1">
                  {hotSnacksEquipment.length > 0 ? (
                    hotSnacksEquipment.map((item) => (
                      <span
                        key={item.id}
                        className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium"
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
                    const isSelected = hotSnacksEquipment.some((eq) => eq.id === item.id);
                    return (
                      <CommandItem
                        key={item.id}
                        onSelect={() => {
                          if (isSelected) {
                            onHotSnacksChange(hotSnacksEquipment.filter((eq) => eq.id !== item.id));
                          } else {
                            onHotSnacksChange([...hotSnacksEquipment, item]);
                          }
                        }}
                        className="h-auto min-h-[48px] py-2 px-3 cursor-pointer"
                      >
                        <Check
                          className={`mr-3 h-5 w-5 shrink-0 ${
                            isSelected ? "opacity-100 text-green-600" : "opacity-0"
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
          <Input
            value={customHotSnacks}
            onChange={(e) => onCustomHotSnacksChange(e.target.value)}
            placeholder="Додатковий коментар..."
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Подання салатів</Label>
          <Popover open={saladOpen} onOpenChange={setSaladOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between h-12 text-base"
              >
                <div className="flex flex-wrap gap-1 flex-1">
                  {saladEquipment.length > 0 ? (
                    saladEquipment.map((item) => (
                      <span
                        key={item.id}
                        className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium"
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
                    const isSelected = saladEquipment.some((eq) => eq.id === item.id);
                    return (
                      <CommandItem
                        key={item.id}
                        onSelect={() => {
                          if (isSelected) {
                            onSaladChange(saladEquipment.filter((eq) => eq.id !== item.id));
                          } else {
                            onSaladChange([...saladEquipment, item]);
                          }
                        }}
                        className="h-auto min-h-[48px] py-2 px-3 cursor-pointer"
                      >
                        <Check
                          className={`mr-3 h-5 w-5 shrink-0 ${
                            isSelected ? "opacity-100 text-purple-600" : "opacity-0"
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
          <Input
            value={customSalad}
            onChange={(e) => onCustomSaladChange(e.target.value)}
            placeholder="Додатковий коментар..."
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="allergies" className="text-sm">
            Чи є алергії <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Textarea
            id="allergies"
            value={allergies}
            onChange={(e) => onFieldChange('product_allergy', e.target.value)}
            placeholder="Алергія на горіхи, морепродукти..."
            rows={2}
            className="text-base min-h-[60px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hot-snacks-prep" className="text-sm">
            Приготування гарячих закусок <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Textarea
            id="hot-snacks-prep"
            value={hotSnacksPrep}
            onChange={(e) => onFieldChange('hot_snacks_prep', e.target.value)}
            placeholder="Деталі приготування..."
            rows={2}
            className="text-base min-h-[60px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="menu-notes" className="text-sm">
            Коментар до позицій меню <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Textarea
            id="menu-notes"
            value={menuNotes}
            onChange={(e) => onFieldChange('menu_notes', e.target.value)}
            placeholder="Особливості меню..."
            rows={3}
            className="text-base min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-drinks" className="text-sm">
            Напої від замовника <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Textarea
            id="client-drinks"
            value={clientDrinksNotes}
            onChange={(e) => onFieldChange('client_drinks_notes', e.target.value)}
            placeholder="Які напої надає замовник..."
            rows={2}
            className="text-base min-h-[60px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-order" className="text-sm">
            Їжа від замовника <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Textarea
            id="client-order"
            value={clientOrderNotes}
            onChange={(e) => onFieldChange('client_order_notes', e.target.value)}
            placeholder="Яка їжа надається замовником..."
            rows={2}
            className="text-base min-h-[60px]"
          />
        </div>
      </div>

      {/* Hidden validator for wizard */}
      <div style={{ display: 'none' }} data-valid={isValid()} />
    </div>
  );
}

