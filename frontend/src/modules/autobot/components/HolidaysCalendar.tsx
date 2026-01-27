import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { Badge } from '../../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../components/ui/dialog';
import { Calendar as CalendarIcon, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../components/ui/utils';
import { autobotApi, type Holiday } from '../api/autobot.api';

interface HolidaysCalendarProps {
  settingsId: number;
}

export function HolidaysCalendar({ settingsId }: HolidaysCalendarProps) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Нове свято
  const [newHoliday, setNewHoliday] = useState({
    date: '',
    name: '',
    is_recurring: false,
  });

  useEffect(() => {
    loadHolidays();
  }, [settingsId]);

  const loadHolidays = async () => {
    try {
      const data = await autobotApi.getHolidays(settingsId);
      setHolidays(data);
    } catch (error) {
      toast.error('Помилка завантаження свят');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name) {
      toast.error('Заповніть всі поля');
      return;
    }

    try {
      await autobotApi.addHoliday(settingsId, newHoliday);
      toast.success('Свято додано!');
      setIsDialogOpen(false);
      setNewHoliday({ date: '', name: '', is_recurring: false });
      loadHolidays();
    } catch (error) {
      toast.error('Помилка додавання свята');
      console.error(error);
    }
  };

  const handleDeleteHoliday = async (holidayId: number) => {
    try {
      await autobotApi.deleteHoliday(holidayId);
      toast.success('Свято видалено');
      loadHolidays();
    } catch (error) {
      toast.error('Помилка видалення');
      console.error(error);
    }
  };

  // Популярні свята для швидкого додавання
  const addQuickHoliday = async (date: string, name: string, recurring: boolean = true) => {
    try {
      await autobotApi.addHoliday(settingsId, {
        date,
        name,
        is_recurring: recurring,
      });
      toast.success(`Свято "${name}" додано!`);
      loadHolidays();
    } catch (error) {
      toast.error('Помилка додавання');
    }
  };

  // Групування свят по місяцях
  const groupedHolidays = holidays.reduce((acc, holiday) => {
    const date = new Date(holiday.date);
    const monthKey = date.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(holiday);
    return acc;
  }, {} as Record<string, Holiday[]>);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Швидке додавання популярних свят */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Популярні свята</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-01-01', 'Nowy Rok', true)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">1 stycznia</span>
              <span className="text-xs text-slate-600">Nowy Rok</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-01-06', 'Święto Trzech Króli', true)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">6 stycznia</span>
              <span className="text-xs text-slate-600">Święto Trzech Króli</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-04-05', 'Wielkanoc', false)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">5 kwietnia</span>
              <span className="text-xs text-slate-600">Wielkanoc</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-04-06', 'Poniedziałek Wielkanocny', false)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">6 kwietnia</span>
              <span className="text-xs text-slate-600">Poniedziałek Wielkanocny</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-05-01', 'Święto Pracy', true)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">1 maja</span>
              <span className="text-xs text-slate-600">Święto Pracy</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-05-03', 'Święto Narodowe Trzeciego Maja', true)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">3 maja</span>
              <span className="text-xs text-slate-600">Święto Narodowe Trzeciego Maja</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-05-24', 'Zielone Świątki', false)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">24 maja</span>
              <span className="text-xs text-slate-600">Zielone Świątki</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-06-04', 'Boże Ciało', false)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">4 czerwca</span>
              <span className="text-xs text-slate-600">Boże Ciało</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-08-15', 'Wniebowzięcie NMP i Święto Wojska Polskiego', true)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">15 sierpnia</span>
              <span className="text-xs text-slate-600">Wniebowzięcie NMP</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-11-01', 'Wszystkich Świętych', true)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">1 listopada</span>
              <span className="text-xs text-slate-600">Wszystkich Świętych</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-11-11', 'Narodowe Święto Niepodległości', true)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">11 listopada</span>
              <span className="text-xs text-slate-600">Święto Niepodległości</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-12-24', 'Wigilia Bożego Narodzenia', true)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">24 grudnia</span>
              <span className="text-xs text-slate-600">Wigilia</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-12-25', 'Boże Narodzenie I dzień', true)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">25 grudnia</span>
              <span className="text-xs text-slate-600">Boże Narodzenie I</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => addQuickHoliday('2026-12-26', 'Boże Narodzenie II dzień', true)}
              className="h-auto py-3 flex flex-col items-start"
            >
              <span className="text-sm font-semibold">26 grudnia</span>
              <span className="text-xs text-slate-600">Boże Narodzenie II</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Список свят */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Ваші свята</CardTitle>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Додати свято
          </Button>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600">Свят ще не додано</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedHolidays).map(([month, monthHolidays]) => (
                <div key={month}>
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                    {month}
                  </h4>
                  <div className="space-y-2">
                    {monthHolidays.map((holiday) => (
                      <div
                        key={holiday.id}
                        className="flex items-center justify-between p-3 bg-white border-2 border-slate-200 rounded-lg hover:border-orange-300 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                            <CalendarIcon className="w-6 h-6 text-orange-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {holiday.name}
                            </div>
                            <div className="text-sm text-slate-600">
                              {new Date(holiday.date).toLocaleDateString('uk-UA', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </div>
                          </div>
                          {holiday.is_recurring && (
                            <Badge variant="secondary" className="ml-2">
                              Щорічно
                            </Badge>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Діалог додавання свята */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Додати свято</DialogTitle>
            <DialogDescription>
              Додайте неробочий день або свято
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Назва свята</Label>
              <Input
                id="holiday-name"
                placeholder="Наприклад: Новий Рік"
                value={newHoliday.name}
                onChange={(e) =>
                  setNewHoliday({ ...newHoliday, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="holiday-date">Дата</Label>
              <Input
                id="holiday-date"
                type="date"
                value={newHoliday.date}
                onChange={(e) =>
                  setNewHoliday({ ...newHoliday, date: e.target.value })
                }
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="recurring"
                checked={newHoliday.is_recurring}
                onCheckedChange={(checked) =>
                  setNewHoliday({ ...newHoliday, is_recurring: checked })
                }
              />
              <Label htmlFor="recurring" className="cursor-pointer">
                Повторювати щорічно
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Скасувати
            </Button>
            <Button onClick={handleAddHoliday}>Додати</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

