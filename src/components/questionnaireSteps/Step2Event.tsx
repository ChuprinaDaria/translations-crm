import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { getDefaultEventDate, calculateEndTime } from "../../utils/questionnaireValidation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useState, useEffect } from "react";

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

interface Step2EventProps {
  eventDate: string;
  eventType: string;
  guestCount: string;
  budget?: string;
  onChange: (field: string, value: string) => void;
}

export function Step2Event({ eventDate, eventType, guestCount, budget, onChange }: Step2EventProps) {
  const [recentFormats, setRecentFormats] = useState<string[]>([]);

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

  const handleFormatSelect = (format: string) => {
    onChange('event_type', format);
    // Зберігаємо в недавні формати
    const updated = [format, ...recentFormats.filter(f => f !== format)].slice(0, 3);
    setRecentFormats(updated);
    localStorage.setItem('recentEventFormats', JSON.stringify(updated));
  };

  const isValid = () => {
    return !!(eventDate && eventType && guestCount && parseInt(guestCount) > 0);
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
                variant={eventType === format ? "default" : "outline"}
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
        <div className="space-y-2">
          <Label htmlFor="event-type" className="text-sm font-semibold">
            Формат заходу <span className="text-red-500">*</span>
          </Label>
          <Select value={eventType} onValueChange={(value) => onChange('event_type', value)}>
            <SelectTrigger id="event-type" className="h-12 text-base">
              <SelectValue placeholder="Оберіть формат" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_FORMATS.map((format) => (
                <SelectItem key={format} value={format}>
                  {format}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            onChange={(e) => onChange('people_count', e.target.value)}
            placeholder="50"
            className="h-12 text-base"
            inputMode="numeric"
          />
        </div>

        {budget !== undefined && (
          <div className="space-y-2">
            <Label htmlFor="budget" className="text-sm">
              Бюджет <span className="text-gray-400 text-xs">(опціонально)</span>
            </Label>
            <Input
              id="budget"
              type="text"
              value={budget || ""}
              onChange={(e) => onChange('budget', e.target.value)}
              placeholder="10000-15000 грн"
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

