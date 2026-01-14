import React, { useState, useEffect } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { X, Plus, Clock } from "lucide-react";
import { getDefaultEventDate } from "../../utils/questionnaireValidation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const EVENT_FORMATS = [
  "Фуршет",
  "Банкет",
  "Доставка обідів",
  "Корпоратив",
  "Весілля",
  "День народження",
  "Кава-брейк",
  "Welcome drink",
  "Комплексне обслуговування",
];

interface EventFormat {
  format: string;
  time?: string;
}

interface Step2EventProps {
  eventDate: string;
  eventType: string;
  guestCount: string;
  budget?: string;
  onChange: (field: string, value: string) => void;
}

// Парсинг бюджету з рядка "10000-15000" в масив [10000, 15000]
const parseBudget = (budgetStr?: string): [number, number] => {
  if (!budgetStr) return [0, 50000];
  const parts = budgetStr.split('-').map(p => parseInt(p.trim()) || 0);
  if (parts.length === 2) {
    return [parts[0], parts[1]];
  }
  return [0, 50000];
};

// Парсинг форматів з JSON рядка або старого формату
const parseEventFormats = (eventTypeStr?: string): EventFormat[] => {
  if (!eventTypeStr) return [];
  
  try {
    // Спробуємо розпарсити як JSON
    const parsed = JSON.parse(eventTypeStr);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Якщо не JSON, то це старий формат - один рядок
    if (eventTypeStr.trim()) {
      return [{ format: eventTypeStr }];
    }
  }
  
  return [];
};

// Серіалізація форматів в JSON рядок
const serializeEventFormats = (formats: EventFormat[]): string => {
  if (formats.length === 0) return "";
  return JSON.stringify(formats);
};

export function Step2Event({ eventDate, eventType, guestCount, budget, onChange }: Step2EventProps) {
  const [recentFormats, setRecentFormats] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState<[number, number]>(parseBudget(budget));
  const [eventFormats, setEventFormats] = useState<EventFormat[]>(() => parseEventFormats(eventType));
  const [newFormatInput, setNewFormatInput] = useState("");
  const [newFormatTime, setNewFormatTime] = useState("");
  const [showAddFormat, setShowAddFormat] = useState(false);

  useEffect(() => {
    // Завантажуємо останні формати з localStorage
    const saved = localStorage.getItem('recentEventFormats');
    if (saved) {
      setRecentFormats(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    // Якщо дата не встановлена, встановлюємо дефолтну
    if (!eventDate) {
      onChange('event_date', getDefaultEventDate());
    }
  }, []);

  useEffect(() => {
    // Синхронізуємо budgetRange з budget prop
    setBudgetRange(parseBudget(budget));
  }, [budget]);

  useEffect(() => {
    // Синхронізуємо eventFormats з eventType prop
    const parsed = parseEventFormats(eventType);
    setEventFormats(parsed);
  }, [eventType]);

  // Оновлюємо event_type при зміні форматів
  useEffect(() => {
    const serialized = serializeEventFormats(eventFormats);
    if (serialized !== eventType) {
      onChange('event_type', serialized);
    }
  }, [eventFormats]);

  const handleFormatSelect = (format: string) => {
    const newFormat: EventFormat = { format };
    const updated = [newFormat, ...eventFormats];
    setEventFormats(updated);
    
    // Зберігаємо в недавні формати
    const updatedRecent = [format, ...recentFormats.filter(f => f !== format)].slice(0, 3);
    setRecentFormats(updatedRecent);
    localStorage.setItem('recentEventFormats', JSON.stringify(updatedRecent));
    
    setShowAddFormat(false);
    setNewFormatInput("");
    setNewFormatTime("");
  };

  const handleAddCustomFormat = () => {
    if (!newFormatInput.trim()) return;
    
    const newFormat: EventFormat = {
      format: newFormatInput.trim(),
      time: newFormatTime.trim() || undefined,
    };
    
    setEventFormats([...eventFormats, newFormat]);
    
    // Зберігаємо в недавні формати
    const updatedRecent = [newFormat.format, ...recentFormats.filter(f => f !== newFormat.format)].slice(0, 3);
    setRecentFormats(updatedRecent);
    localStorage.setItem('recentEventFormats', JSON.stringify(updatedRecent));
    
    setNewFormatInput("");
    setNewFormatTime("");
    setShowAddFormat(false);
  };

  const handleRemoveFormat = (index: number) => {
    setEventFormats(eventFormats.filter((_, i) => i !== index));
  };

  const handleUpdateFormatTime = (index: number, time: string) => {
    const updated = [...eventFormats];
    updated[index] = { ...updated[index], time: time.trim() || undefined };
    setEventFormats(updated);
  };

  const isValid = () => {
    return !!(eventDate && eventFormats.length > 0 && guestCount && parseInt(guestCount) > 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Захід</h2>
        <p className="text-sm text-gray-600">Основна інформація про захід</p>
      </div>

      {/* Швидкий вибір останніх форматів */}
      {recentFormats.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-gray-600">Останні формати:</Label>
          <div className="flex flex-wrap gap-2">
            {recentFormats.map((format) => (
              <Button
                key={format}
                type="button"
                variant="outline"
                onClick={() => handleFormatSelect(format)}
                className="h-10"
              >
                {format}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Формати заходу */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">
            Формати заходу <span className="text-red-500">*</span>
          </Label>
          
          {/* Список доданих форматів */}
          {eventFormats.length > 0 && (
            <div className="space-y-2">
              {eventFormats.map((eventFormat, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-3 border rounded-lg bg-gray-50"
                >
                  <div className="flex-1 space-y-2">
                    <div className="font-medium text-gray-900">{eventFormat.format}</div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <Input
                        type="text"
                        value={eventFormat.time || ""}
                        onChange={(e) => handleUpdateFormatTime(index, e.target.value)}
                        placeholder="Час (напр. 12:00-13:00)"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFormat(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Додавання нового формату */}
          {!showAddFormat ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddFormat(true)}
              className="w-full h-12 text-base"
            >
              <Plus className="w-5 h-5 mr-2" />
              Додати формат
            </Button>
          ) : (
            <div className="space-y-2 p-3 border rounded-lg bg-blue-50">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Select
                    value={newFormatInput}
                    onValueChange={(value) => {
                      setNewFormatInput(value);
                      if (value && EVENT_FORMATS.includes(value)) {
                        handleFormatSelect(value);
                      }
                    }}
                  >
                    <SelectTrigger className="h-10 flex-1">
                      <SelectValue placeholder="Оберіть або введіть формат" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_FORMATS.map((format) => (
                        <SelectItem key={format} value={format}>
                          {format}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    value={newFormatInput}
                    onChange={(e) => setNewFormatInput(e.target.value)}
                    placeholder="Або введіть свій формат"
                    className="h-10 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newFormatInput.trim()) {
                        e.preventDefault();
                        handleAddCustomFormat();
                      }
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    value={newFormatTime}
                    onChange={(e) => setNewFormatTime(e.target.value)}
                    placeholder="Час (напр. 12:00-13:00)"
                    className="h-10 flex-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleAddCustomFormat}
                    disabled={!newFormatInput.trim()}
                    className="flex-1 h-10"
                  >
                    Додати
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddFormat(false);
                      setNewFormatInput("");
                      setNewFormatTime("");
                    }}
                    className="h-10"
                  >
                    Скасувати
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="event-date" className="text-sm font-semibold">
            Дата заходу <span className="text-red-500">*</span>
          </Label>
          <Input
            id="event-date"
            type="date"
            value={eventDate || getDefaultEventDate()}
            onChange={(e) => onChange('event_date', e.target.value)}
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="guest-count" className="text-sm font-semibold">
            Кількість гостей <span className="text-red-500">*</span>
          </Label>
          <Input
            id="guest-count"
            type="number"
            min="1"
            value={guestCount}
            onChange={(e) => onChange('guest_count', e.target.value)}
            placeholder="50"
            className="h-12 text-base"
            inputMode="numeric"
          />
        </div>

        {budget !== undefined && (
          <div className="space-y-3">
            <Label htmlFor="budget" className="text-sm">
              Бюджет <span className="text-gray-400 text-xs">(опціонально)</span>
            </Label>
            <div className="space-y-4 px-2">
              <Slider
                id="budget"
                min={0}
                max={200000}
                step={5000}
                value={budgetRange}
                onValueChange={(values) => {
                  setBudgetRange([values[0], values[1]]);
                  onChange('budget', `${values[0]}-${values[1]}`);
                }}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600">
                <span>{budgetRange[0].toLocaleString()} грн</span>
                <span>{budgetRange[1].toLocaleString()} грн</span>
              </div>
            </div>
            <Input
              type="text"
              value={budget || ""}
              onChange={(e) => onChange('budget', e.target.value)}
              placeholder="10000-15000 або використайте слайдер"
              className="h-12 text-base"
            />
          </div>
        )}
      </div>

      {/* Hidden validator for wizard */}
      <div style={{ display: 'none' }} data-valid={isValid()} />
    </div>
  );
}
