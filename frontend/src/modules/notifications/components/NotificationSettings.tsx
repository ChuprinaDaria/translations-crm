/**
 * NotificationSettings - компонент для налаштування нотифікацій
 */
import React, { useState, useEffect } from 'react';
import { Settings, Bell, Volume2, Monitor, Smartphone, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { notificationApi } from '../api';
import type { NotificationSettings, NotificationSettingsUpdate, NotificationType } from '../types';
import { Loader2 } from 'lucide-react';

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  new_message: 'Нові повідомлення',
  payment_received: 'Оплати',
  translator_accepted: 'Відповіді перекладачів (прийнято)',
  translator_rejected: 'Відповіді перекладачів (відхилено)',
  translation_ready: 'Готові переклади',
  internal_note: 'Internal Notes',
  deadline_warning: 'Дедлайни (попередження)',
  deadline_passed: 'Дедлайни (прострочені)',
};

interface NotificationSettingsProps {
  userId: string;
}

export function NotificationSettings({ userId }: NotificationSettingsProps) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Завантажити налаштування
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await notificationApi.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const update: NotificationSettingsUpdate = {
        enabled: settings.enabled,
        sound: settings.sound,
        desktop: settings.desktop,
        vibration: settings.vibration,
        types_enabled: settings.types_enabled,
        do_not_disturb: settings.do_not_disturb,
      };

      const updated = await notificationApi.updateSettings(update);
      setSettings(updated);
      setOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const updateTypeEnabled = (type: NotificationType, enabled: boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      types_enabled: { ...settings.types_enabled, [type]: enabled },
    });
  };

  if (!settings) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            ⚙️ Налаштування нотифікацій
          </DialogTitle>
          <DialogDescription>
            Налаштуйте типи нотифікацій та режим "Не турбувати"
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Загальні налаштування */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Загальні налаштування</h3>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-gray-500" />
                  <Label htmlFor="enabled">Увімкнути нотифікації</Label>
                </div>
                <Switch
                  id="enabled"
                  checked={settings.enabled}
                  onCheckedChange={(checked) => updateSetting('enabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-gray-500" />
                  <Label htmlFor="sound">🔔 Звук</Label>
                </div>
                <Switch
                  id="sound"
                  checked={settings.sound}
                  onCheckedChange={(checked) => updateSetting('sound', checked)}
                  disabled={!settings.enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-gray-500" />
                  <Label htmlFor="desktop">🖥️ Desktop notifications</Label>
                </div>
                <Switch
                  id="desktop"
                  checked={settings.desktop}
                  onCheckedChange={(checked) => updateSetting('desktop', checked)}
                  disabled={!settings.enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-gray-500" />
                  <Label htmlFor="vibration">📳 Вібрація (mobile)</Label>
                </div>
                <Switch
                  id="vibration"
                  checked={settings.vibration}
                  onCheckedChange={(checked) => updateSetting('vibration', checked)}
                  disabled={!settings.enabled}
                />
              </div>
            </div>

            {/* Типи нотифікацій */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Типи нотифікацій</h3>
              <div className="space-y-3">
                {(Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]).map((type) => (
                  <div key={type} className="flex items-center justify-between">
                    <Label htmlFor={`type-${type}`} className="font-normal">
                      {NOTIFICATION_TYPE_LABELS[type]}
                    </Label>
                    <Switch
                      id={`type-${type}`}
                      checked={settings.types_enabled[type] ?? true}
                      onCheckedChange={(checked) => updateTypeEnabled(type, checked)}
                      disabled={!settings.enabled}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Do Not Disturb */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Moon className="h-4 w-4" />
                Не турбувати
              </h3>
              
              <div className="space-y-3">
                <div>
                  <Label>Будні дні</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="time"
                      value={settings.do_not_disturb.weekdays?.[0] || ''}
                      onChange={(e) => {
                        const weekdays = settings.do_not_disturb.weekdays || [null, null];
                        updateSetting('do_not_disturb', {
                          ...settings.do_not_disturb,
                          weekdays: [e.target.value, weekdays[1]] as [string, string],
                        });
                      }}
                      disabled={!settings.enabled}
                    />
                    <span>—</span>
                    <Input
                      type="time"
                      value={settings.do_not_disturb.weekdays?.[1] || ''}
                      onChange={(e) => {
                        const weekdays = settings.do_not_disturb.weekdays || [null, null];
                        updateSetting('do_not_disturb', {
                          ...settings.do_not_disturb,
                          weekdays: [weekdays[0], e.target.value] as [string, string],
                        });
                      }}
                      disabled={!settings.enabled}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="weekend-dnd">Вихідні (весь день)</Label>
                  <Switch
                    id="weekend-dnd"
                    checked={settings.do_not_disturb.weekend === 'all_day'}
                    onCheckedChange={(checked) =>
                      updateSetting('do_not_disturb', {
                        ...settings.do_not_disturb,
                        weekend: checked ? 'all_day' : null,
                      })
                    }
                    disabled={!settings.enabled}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Скасувати
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Збереження...
                  </>
                ) : (
                  'Зберегти'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

