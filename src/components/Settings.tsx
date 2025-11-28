import React, { useEffect, useState, ChangeEvent } from "react";
import { UploadCloud, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { toast } from "sonner";
import {
  settingsApi,
  getImageUrl,
  type BrandingSettings,
  type TelegramAccount,
  type SmtpSettings,
  type TelegramApiConfig,
} from "../lib/api";

export function Settings() {
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [telegramAccounts, setTelegramAccounts] = useState<TelegramAccount[]>([]);
  const [newTgName, setNewTgName] = useState("");
  const [newTgPhone, setNewTgPhone] = useState("");
  const [newTgSession, setNewTgSession] = useState("");
  const [isSavingTg, setIsSavingTg] = useState(false);

  const [smtp, setSmtp] = useState<SmtpSettings>({
    host: "",
    port: "",
    user: "",
    password: "",
    from_email: "",
    from_name: "",
  });

  const [telegramApi, setTelegramApi] = useState<TelegramApiConfig>({
    api_id: "",
    api_hash: "",
    sender_name: "",
  });

  // CSV import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImportingCsv, setIsImportingCsv] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [brandingData, tgAccounts, smtpSettings, tgConfig] = await Promise.all([
          settingsApi.getBranding(),
          settingsApi.getTelegramAccounts(),
          settingsApi.getSmtpSettings(),
          settingsApi.getTelegramApiConfig(),
        ]);
        setBranding(brandingData);
        setTelegramAccounts(tgAccounts);
        setSmtp(smtpSettings);
        setTelegramApi(tgConfig);
      } catch (error) {
        console.error(error);
      }
    };

    loadData();
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Оберіть, будь ласка, файл зображення");
      return;
    }

    if (file.type !== "image/png") {
      toast.info("Рекомендовано використовувати PNG з прозорим фоном для кращого вигляду в КП");
    }

    setLogoFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!logoFile) {
      toast.error("Оберіть файл лого перед збереженням");
      return;
    }

    setIsUploading(true);
    try {
      const data = await settingsApi.uploadLogo(logoFile);
      setBranding(data);
      toast.success("Лого успішно оновлено");
    } catch (error: any) {
      console.error(error);
      const message =
        error?.detail || error?.message || "Не вдалося завантажити лого";
      toast.error(
        typeof message === "string" ? message : "Не вдалося завантажити лого"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const currentLogoUrl =
    logoPreview || (branding?.logo_url ? getImageUrl(branding.logo_url) : null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl text-gray-900">Налаштування</h1>

      <Card>
        <CardHeader>
          <CardTitle>Брендинг та лого для КП</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Завантажте лого компанії (бажано PNG з прозорим фоном). Воно буде
            автоматично доступне у всіх шаблонах КП як{" "}
            <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">
              {"{{ logo_src }}"}
            </code>{" "}
            і за замовчуванням використовується внизу PDF.
          </p>

          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="flex-1 space-y-2">
              <Label htmlFor="logo-file">Лого компанії</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="logo-file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleUpload}
                  disabled={isUploading || !logoFile}
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                >
                  <UploadCloud className="w-4 h-4 mr-2" />
                  {isUploading ? "Завантаження..." : "Зберегти лого"}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Рекомендовано: PNG, світлий або темний варіант, висота ~60–80px.
              </p>
            </div>

            <div className="w-40 h-28 border border-dashed border-gray-300 rounded-md flex items-center justify-center bg-gray-50 overflow-hidden">
              {currentLogoUrl ? (
                <img
                  src={currentLogoUrl}
                  alt="Logo preview"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 text-xs px-2 text-center">
                  <ImageIcon className="w-6 h-6 mb-1" />
                  <span>Превʼю лого</span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-4 mt-2 text-xs text-gray-600 space-y-1">
            <p className="font-medium">Як використати в HTML шаблоні КП:</p>
            <pre className="bg-gray-50 rounded p-2 overflow-x-auto text-[11px]">
{`{% if logo_src %}
  <div style="margin-top:40px; text-align:center;">
    <img src="{{ logo_src }}" alt="Logo" style="max-height:70px;" />
  </div>
{% endif %}`}
            </pre>
            <p>
              Цей блок автоматично отримає шлях до вашого лого при генерації
              PDF.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Імпорт меню з CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Завантажте CSV, експортований з файлу{" "}
            <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
              Загальне_меню_Dzyga_2025 --3.xlsm
            </span>
            . Система автоматично створить категорії, підкатегорії та страви.
          </p>

          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setCsvFile(file);
              }}
              className="flex-1"
            />
            <Button
              type="button"
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
              disabled={isImportingCsv || !csvFile}
              onClick={async () => {
                if (!csvFile) {
                  toast.error("Оберіть CSV-файл перед імпортом");
                  return;
                }
                setIsImportingCsv(true);
                try {
                  const result = await settingsApi.importMenuCsv(csvFile);
                  toast.success(
                    `Імпорт завершено. Створено страв: ${result.created}`
                  );
                  setCsvFile(null);
                } catch (error: any) {
                  console.error(error);
                  const message =
                    error?.detail ||
                    error?.message ||
                    "Не вдалося імпортувати меню з CSV";
                  toast.error(
                    typeof message === "string"
                      ? message
                      : "Не вдалося імпортувати меню з CSV"
                  );
                } finally {
                  setIsImportingCsv(false);
                }
              }}
            >
              {isImportingCsv ? "Імпорт..." : "Імпортувати меню"}
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            Після імпорту нові страви будуть доступні в розділі «Меню / Страви»
            та при створенні КП.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Telegram API налаштування</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Дані доступу до Telegram API, які використовуються для підключення
            акаунтів (через session string) та відправки КП в Telegram.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tg-api-id">API ID</Label>
              <Input
                id="tg-api-id"
                value={telegramApi.api_id}
                onChange={(e) =>
                  setTelegramApi({ ...telegramApi, api_id: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tg-api-hash">API HASH</Label>
              <Input
                id="tg-api-hash"
                value={telegramApi.api_hash}
                onChange={(e) =>
                  setTelegramApi({ ...telegramApi, api_hash: e.target.value })
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tg-sender-name">Назва відправника</Label>
              <Input
                id="tg-sender-name"
                value={telegramApi.sender_name}
                onChange={(e) =>
                  setTelegramApi({
                    ...telegramApi,
                    sender_name: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
              onClick={async () => {
                try {
                  await settingsApi.updateTelegramApiConfig(telegramApi);
                  toast.success("Telegram API налаштування збережено");
                } catch (error) {
                  console.error(error);
                  toast.error("Не вдалося зберегти Telegram API налаштування");
                }
              }}
            >
              Зберегти Telegram API
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SMTP налаштування для email‑відправки КП</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Ці параметри використовуються для відправки комерційних пропозицій
            на email клієнта. Дані зберігаються у базі даних і не залежать від файлів
            конфігурації на сервері.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input
                id="smtp-host"
                value={smtp.host}
                onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">SMTP Port</Label>
              <Input
                id="smtp-port"
                value={smtp.port}
                onChange={(e) => setSmtp({ ...smtp, port: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-user">SMTP User (логін)</Label>
              <Input
                id="smtp-user"
                value={smtp.user}
                onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-password">SMTP Password</Label>
              <Input
                id="smtp-password"
                type="password"
                value={smtp.password}
                onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-from-email">Відправник (email)</Label>
              <Input
                id="smtp-from-email"
                value={smtp.from_email}
                onChange={(e) =>
                  setSmtp({ ...smtp, from_email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-from-name">Відправник (ім&apos;я)</Label>
              <Input
                id="smtp-from-name"
                value={smtp.from_name}
                onChange={(e) =>
                  setSmtp({ ...smtp, from_name: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
              onClick={async () => {
                try {
                  await settingsApi.updateSmtpSettings(smtp);
                  toast.success("SMTP налаштування збережено");
                } catch (error) {
                  console.error(error);
                  toast.error("Не вдалося зберегти SMTP налаштування");
                }
              }}
            >
              Зберегти SMTP
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Telegram акаунти для відправки КП</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Тут можна додати Telegram акаунти (звичайні, не боти), з яких буде
            відправлятися КП клієнтам. Потрібно попередньо згенерувати{" "}
            <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
              session string
            </span>{" "}
            за допомогою інструменту на базі Telethon.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="tg-name">Назва акаунта в системі</Label>
              <Input
                id="tg-name"
                placeholder="Наприклад: Менеджер Іван"
                value={newTgName}
                onChange={(e) => setNewTgName(e.target.value)}
              />

              <Label htmlFor="tg-phone">Телефон акаунта (опційно)</Label>
              <Input
                id="tg-phone"
                placeholder="+380..."
                value={newTgPhone}
                onChange={(e) => setNewTgPhone(e.target.value)}
              />

              <Label htmlFor="tg-session">Session string (обовʼязково)</Label>
              <textarea
                id="tg-session"
                className="w-full px-3 py-2 border rounded-md text-xs font-mono min-h-[80px]"
                placeholder="Вставте сюди згенерований session string Telethon..."
                value={newTgSession}
                onChange={(e) => setNewTgSession(e.target.value)}
              />

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                  disabled={isSavingTg || !newTgName || !newTgSession}
                  onClick={async () => {
                    setIsSavingTg(true);
                    try {
                      const created = await settingsApi.createTelegramAccount({
                        name: newTgName,
                        phone: newTgPhone || undefined,
                        session_string: newTgSession.trim(),
                      });
                      setTelegramAccounts((prev) => [...prev, created]);
                      setNewTgName("");
                      setNewTgPhone("");
                      setNewTgSession("");
                      toast.success("Telegram акаунт додано");
                    } catch (error: any) {
                      console.error(error);
                      const message =
                        error?.detail ||
                        error?.message ||
                        "Не вдалося додати Telegram акаунт";
                      toast.error(
                        typeof message === "string"
                          ? message
                          : "Не вдалося додати Telegram акаунт"
                      );
                    } finally {
                      setIsSavingTg(false);
                    }
                  }}
                >
                  {isSavingTg ? "Збереження..." : "Додати акаунт"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Поточні акаунти</Label>
              {telegramAccounts.length === 0 ? (
                <p className="text-xs text-gray-500">
                  Ще не додано жодного Telegram акаунта.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                  {telegramAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between gap-2 text-xs border-b last:border-b-0 pb-1 last:pb-0"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {acc.name}
                        </div>
                        {acc.phone && (
                          <div className="text-gray-500">{acc.phone}</div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={async () => {
                          try {
                            await settingsApi.deleteTelegramAccount(acc.id);
                            setTelegramAccounts((prev) =>
                              prev.filter((a) => a.id !== acc.id)
                            );
                            toast.success("Акаунт видалено");
                          } catch (error) {
                            console.error(error);
                            toast.error("Не вдалося видалити акаунт");
                          }
                        }}
                      >
                        Видалити
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Відправка КП в Telegram працює від імені цих акаунтів. Клієнти мають
            бути в контактах або доступні за вказаним номером телефону.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


