import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Switch } from '../../../components/ui/switch';
import { Clock } from 'lucide-react';
import { cn } from '../../../components/ui/utils';
import type { AutobotSettings, WorkingHours } from '../api/autobot.api';

interface WorkingHoursEditorProps {
  settings: AutobotSettings;
  onChange: (settings: AutobotSettings) => void;
}

const DAYS = [
  { key: 'monday', label: 'Понеділок', shortLabel: 'Пн' },
  { key: 'tuesday', label: 'Вівторок', shortLabel: 'Вт' },
  { key: 'wednesday', label: 'Середа', shortLabel: 'Ср' },
  { key: 'thursday', label: 'Четвер', shortLabel: 'Чт' },
  { key: 'friday', label: 'П\'ятниця', shortLabel: 'Пт' },
  { key: 'saturday', label: 'Субота', shortLabel: 'Сб' },
  { key: 'sunday', label: 'Неділя', shortLabel: 'Нд' },
] as const;

export function WorkingHoursEditor({ settings, onChange }: WorkingHoursEditorProps) {
  const handleDayToggle = (dayKey: string, enabled: boolean) => {
    const currentDay = settings[dayKey as keyof AutobotSettings] as WorkingHours | null;
    
    onChange({
      ...settings,
      [dayKey]: enabled
        ? {
            start: currentDay?.start || '09:00',
            end: currentDay?.end || '18:00',
            is_working_day: true,
          }
        : null,
    });
  };

  const handleTimeChange = (
    dayKey: string,
    field: 'start' | 'end',
    value: string
  ) => {
    const currentDay = settings[dayKey as keyof AutobotSettings] as WorkingHours | null;
    
    if (!currentDay) return;
    
    onChange({
      ...settings,
      [dayKey]: {
        ...currentDay,
        [field]: value,
      },
    });
  };

  // Швидкі шаблони
  const applyTemplate = (template: 'standard' | 'extended' | 'weekend') => {
    const templates = {
      standard: {
        // Пн-Пт: 9:00-18:00
        monday: { start: '09:00', end: '18:00', is_working_day: true },
        tuesday: { start: '09:00', end: '18:00', is_working_day: true },
        wednesday: { start: '09:00', end: '18:00', is_working_day: true },
        thursday: { start: '09:00', end: '18:00', is_working_day: true },
        friday: { start: '09:00', end: '18:00', is_working_day: true },
        saturday: null,
        sunday: null,
      },
      extended: {
        // Пн-Пт: 8:00-20:00, Сб: 10:00-16:00
        monday: { start: '08:00', end: '20:00', is_working_day: true },
        tuesday: { start: '08:00', end: '20:00', is_working_day: true },
        wednesday: { start: '08:00', end: '20:00', is_working_day: true },
        thursday: { start: '08:00', end: '20:00', is_working_day: true },
        friday: { start: '08:00', end: '20:00', is_working_day: true },
        saturday: { start: '10:00', end: '16:00', is_working_day: true },
        sunday: null,
      },
      weekend: {
        // 7 днів: 9:00-21:00
        monday: { start: '09:00', end: '21:00', is_working_day: true },
        tuesday: { start: '09:00', end: '21:00', is_working_day: true },
        wednesday: { start: '09:00', end: '21:00', is_working_day: true },
        thursday: { start: '09:00', end: '21:00', is_working_day: true },
        friday: { start: '09:00', end: '21:00', is_working_day: true },
        saturday: { start: '09:00', end: '21:00', is_working_day: true },
        sunday: { start: '09:00', end: '21:00', is_working_day: true },
      },
    };

    onChange({
      ...settings,
      ...templates[template],
    });
  };

  return (
    <div className="space-y-6">
      {/* Швидкі шаблони */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Швидкі шаблони</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => applyTemplate('standard')}
              className="p-4 text-left border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <div className="font-semibold text-slate-900 mb-1">
                Стандартний
              </div>
              <div className="text-sm text-slate-600">
                Пн-Пт: 9:00-18:00
              </div>
            </button>

            <button
              onClick={() => applyTemplate('extended')}
              className="p-4 text-left border-2 border-slate-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-all"
            >
              <div className="font-semibold text-slate-900 mb-1">
                Розширений
              </div>
              <div className="text-sm text-slate-600">
                Пн-Пт: 8:00-20:00<br />
                Сб: 10:00-16:00
              </div>
            </button>

            <button
              onClick={() => applyTemplate('weekend')}
              className="p-4 text-left border-2 border-slate-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all"
            >
              <div className="font-semibold text-slate-900 mb-1">
                7 днів на тиждень
              </div>
              <div className="text-sm text-slate-600">
                Щодня: 9:00-21:00
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Детальні налаштування */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Робочі години по днях</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((day) => {
            const dayData = settings[day.key as keyof AutobotSettings] as WorkingHours | null;
            const isEnabled = dayData !== null;

            return (
              <div
                key={day.key}
                className={cn(
                  "p-4 border-2 rounded-xl transition-all",
                  isEnabled
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
                )}
              >
                <div className="flex items-center gap-4">
                  {/* День тижня */}
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm",
                        isEnabled
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-300 text-slate-600"
                      )}
                    >
                      {day.shortLabel}
                    </div>
                    <Label className="text-base font-semibold text-slate-900">
                      {day.label}
                    </Label>
                  </div>

                  {/* Вмикач */}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleDayToggle(day.key, checked)}
                  />

                  {/* Час початку */}
                  {isEnabled && (
                    <>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-slate-600">Початок:</Label>
                        <Input
                          type="time"
                          value={dayData?.start || '09:00'}
                          onChange={(e) =>
                            handleTimeChange(day.key, 'start', e.target.value)
                          }
                          className="w-32"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-slate-600">Кінець:</Label>
                        <Input
                          type="time"
                          value={dayData?.end || '18:00'}
                          onChange={(e) =>
                            handleTimeChange(day.key, 'end', e.target.value)
                          }
                          className="w-32"
                        />
                      </div>

                      {/* Тривалість */}
                      <div className="ml-auto text-sm text-slate-600 font-medium">
                        {calculateDuration(dayData?.start, dayData?.end)}
                      </div>
                    </>
                  )}

                  {!isEnabled && (
                    <div className="ml-auto text-sm text-slate-500 italic">
                      Неробочий день
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// Допоміжна функція для розрахунку тривалості
function calculateDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '';

  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  const duration = endMinutes - startMinutes;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  if (minutes === 0) {
    return `${hours} год`;
  }
  return `${hours} год ${minutes} хв`;
}

