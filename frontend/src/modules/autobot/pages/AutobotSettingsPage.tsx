import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Badge } from '../../../components/ui/badge';
import { toast } from 'sonner';
import { 
  Bot, 
  Clock, 
  Calendar, 
  MessageSquare, 
  Save,
  Power,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { WorkingHoursEditor } from '../components/WorkingHoursEditor';
import { HolidaysCalendar } from '../components/HolidaysCalendar';
import { MessageEditor } from '../components/MessageEditor';
import { autobotApi, type AutobotSettings, type AutobotStatus } from '../api/autobot.api';
import { officesApi } from '../../crm/api/offices';

export function AutobotSettingsPage() {
  const [officeId, setOfficeId] = useState<number | null>(null);
  const [settings, setSettings] = useState<AutobotSettings | null>(null);
  const [status, setStatus] = useState<AutobotStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadDefaultOffice();
  }, []);

  const loadDefaultOffice = async () => {
    try {
      const defaultOffice = await officesApi.getDefaultOffice();
      setOfficeId(defaultOffice.id);
    } catch (error: any) {
      console.error('Error loading default office:', error);
      // Не встановлюємо officeId якщо офіс не знайдено
      // Користувач побачить повідомлення про помилку
      setOfficeId(null);
      toast.error(
        error?.detail || error?.message || 'Не вдалося завантажити офіс. Будь ласка, створіть офіс в налаштуваннях.'
      );
    }
  };

  useEffect(() => {
    if (officeId) {
      loadData();
    }
  }, [officeId]);

  const loadData = async () => {
    if (!officeId) return;

    try {
      const [settingsData, statusData] = await Promise.all([
        autobotApi.getSettings(officeId).catch(() => null),
        autobotApi.getStatus(officeId).catch(() => null),
      ]);
      setSettings(settingsData);
      setStatus(statusData);
    } catch (error: any) {
      if (error.status === 404) {
        // Settings not found - this is OK, user can create them
        setSettings(null);
      } else {
        toast.error('Помилка завантаження налаштувань');
        console.error(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSettings = async () => {
    if (!officeId) {
      toast.error('Офіс не вибрано. Будь ласка, створіть офіс в налаштуваннях.');
      return;
    }

    setIsSaving(true);
    try {
      const defaultSettings: Partial<AutobotSettings> = {
        office_id: officeId,
        enabled: true,
        auto_reply_message: `Добрий день! 👋

Це Бюро перекладів MT.

На жаль, зараз неробочий час, але ви можете:
- Написати ваше питання тут
- Відправити документ для перевірки

Наш менеджер зв'яжеться з вами в робочий час.

З цінами наших послуг ви можете ознайомитися на нашому сайті:
https://www.tlumaczeniamt.pl/cennik/

Для точної оцінки вартості, будь ласка, надішліть якісні фото або скани усіх сторінок документа.

Гарного дня! ☀️`,
        auto_create_client: true,
        auto_create_order: true,
        auto_save_files: true,
      };
      const created = await autobotApi.createSettings(defaultSettings);
      setSettings(created);
      toast.success('Налаштування створено!');
      loadData(); // Оновити статус
    } catch (error: any) {
      const errorMessage = error?.detail || error?.message || 'Помилка створення налаштувань';
      toast.error(errorMessage);
      console.error('Error creating autobot settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!settings || !officeId) return;

    setIsSaving(true);
    try {
      await autobotApi.updateSettings(officeId, settings);
      toast.success('Налаштування збережено!');
      loadData(); // Оновити статус
    } catch (error: any) {
      toast.error('Помилка збереження');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    if (!settings || !officeId) return;

    try {
      const updated = await autobotApi.updateSettings(officeId, { enabled });
      setSettings(updated);
      toast.success(enabled ? 'Бот увімкнено' : 'Бот вимкнено');
      loadData(); // Оновити статус
    } catch (error: any) {
      toast.error('Помилка зміни статусу');
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!officeId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Bot className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold mb-2">Офіс не знайдено</h3>
            <p className="text-sm text-slate-600 mb-4">
              Для налаштування автобота потрібен активний офіс. Будь ласка, створіть офіс в налаштуваннях системи.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <Bot className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold mb-2">Налаштування не знайдено</h3>
            <p className="text-sm text-slate-600 mb-4">
              Створіть налаштування автобота для початку роботи
            </p>
            <Button 
              onClick={handleCreateSettings}
              disabled={isSaving}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Створення...
                </>
              ) : (
                'Створити налаштування'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Bot className="w-8 h-8 text-orange-500" />
            Автобот для Inbox
          </h1>
          <p className="text-base text-slate-600 mt-1">
            Автоматичні відповіді поза робочим часом
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Статус */}
          {status && (
            <Badge 
              variant="outline"
              className={status.is_working_hours 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-slate-50 text-slate-700 border-slate-200"
              }
            >
              {status.is_working_hours ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Робочий час
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Неробочий час
                </>
              )}
            </Badge>
          )}

          {/* Вкл/Викл */}
          <div className="flex items-center gap-3 px-4 py-2 bg-white border-2 border-slate-200 rounded-xl">
            <Label htmlFor="bot-enabled" className="text-sm font-semibold cursor-pointer">
              {settings.enabled ? 'Увімкнено' : 'Вимкнено'}
            </Label>
            <Switch
              id="bot-enabled"
              checked={settings.enabled}
              onCheckedChange={handleToggleEnabled}
            />
          </div>

          {/* Зберегти */}
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Збереження...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Зберегти
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Таби */}
      <Tabs defaultValue="hours" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="hours">
            <Clock className="w-4 h-4 mr-2" />
            Робочі години
          </TabsTrigger>
          <TabsTrigger value="holidays">
            <Calendar className="w-4 h-4 mr-2" />
            Свята
          </TabsTrigger>
          <TabsTrigger value="message">
            <MessageSquare className="w-4 h-4 mr-2" />
            Повідомлення
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hours">
          <WorkingHoursEditor
            settings={settings}
            onChange={setSettings}
          />
        </TabsContent>

        <TabsContent value="holidays">
          <HolidaysCalendar
            settingsId={settings.id}
          />
        </TabsContent>

        <TabsContent value="message">
          <MessageEditor
            message={settings.auto_reply_message}
            onChange={(message) => setSettings({ ...settings, auto_reply_message: message })}
          />
        </TabsContent>
      </Tabs>

      {/* Додаткові налаштування */}
      <Card>
        <CardHeader>
          <CardTitle>Додаткові налаштування</CardTitle>
          <CardDescription>
            Налаштуйте автоматичні дії бота
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">Автоматично створювати клієнта</Label>
              <p className="text-sm text-slate-600 mt-1">
                Бот створить клієнта з даних відправника
              </p>
            </div>
            <Switch
              checked={settings.auto_create_client}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, auto_create_client: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">Автоматично створювати замовлення</Label>
              <p className="text-sm text-slate-600 mt-1">
                Бот створить нове замовлення для кожного повідомлення
              </p>
            </div>
            <Switch
              checked={settings.auto_create_order}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, auto_create_order: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">Зберігати файли автоматично</Label>
              <p className="text-sm text-slate-600 mt-1">
                Файли з повідомлень будуть збережені до замовлення
              </p>
            </div>
            <Switch
              checked={settings.auto_save_files}
              onCheckedChange={(checked) => 
                setSettings({ ...settings, auto_save_files: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

