import React, { useEffect, useState, ChangeEvent } from "react";
import { UploadCloud, Building2, Plus, Trash2, MapPin, Star, Loader2, Image as ImageIcon, MessageSquare, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { toast } from "sonner";
import {
  settingsApi,
  getImageUrl,
  API_BASE_URL,
  type BrandingSettings,
  type TelegramAccount,
  type SmtpSettings,
  type ManagerSmtpAccount,
  type ManagerSmtpAccountCreate,
  type ManagerSmtpAccountUpdate,
  type WhatsAppConfig,
  type InstagramConfig,
  type FacebookConfig,
  type StripeConfig,
  type InPostConfig,
} from "../lib/api";
import { officesApi, type Office, type OfficeCreate } from "../modules/crm/api/offices";

export function Settings() {
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [telegramAccounts, setTelegramAccounts] = useState<TelegramAccount[]>([]);
  const [newTgName, setNewTgName] = useState("");
  const [newTgPhone, setNewTgPhone] = useState("");
  const [newTgApiId, setNewTgApiId] = useState("");
  const [newTgApiHash, setNewTgApiHash] = useState("");
  const [isSavingTg, setIsSavingTg] = useState(false);
  
  // Стани для inline генерації session
  const [isGenerating, setIsGenerating] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [telegramCode, setTelegramCode] = useState("");
  const [telegramPassword, setTelegramPassword] = useState("");
  const [sessionId, setSessionId] = useState("");

  const [smtp, setSmtp] = useState<SmtpSettings>({
    host: "",
    port: "",
    user: "",
    password: "",
    from_email: "",
    from_name: "",
  });

  // Manager SMTP accounts state
  const [managerSmtpAccounts, setManagerSmtpAccounts] = useState<ManagerSmtpAccount[]>([]);
  const [newManagerSmtp, setNewManagerSmtp] = useState<ManagerSmtpAccountCreate>({
    name: "",
    email: "",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    imap_host: null,
    imap_port: 993,
  });
  const [isSavingManagerSmtp, setIsSavingManagerSmtp] = useState(false);

  // WhatsApp state
  const [whatsapp, setWhatsapp] = useState<WhatsAppConfig>({
    access_token: "",
    phone_number_id: "",
    app_secret: "",
    verify_token: "",
  });
  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);

  // Instagram state
  const [instagram, setInstagram] = useState<InstagramConfig>({
    app_id: "",
    access_token: "",
    app_secret: "",
    verify_token: "",
  });
  const [isSavingInstagram, setIsSavingInstagram] = useState(false);

  // Facebook state
  const [facebook, setFacebook] = useState<FacebookConfig>({
    app_id: "",
    access_token: "",
    app_secret: "",
    verify_token: "",
    page_id: "",
  });
  const [isSavingFacebook, setIsSavingFacebook] = useState(false);

  // Stripe state
  const [stripe, setStripe] = useState<StripeConfig>({
    secret_key: "",
  });
  const [isSavingStripe, setIsSavingStripe] = useState(false);

  // InPost state
  const [inpost, setInpost] = useState<InPostConfig>({
    api_key: "",
  });
  const [isSavingInPost, setIsSavingInPost] = useState(false);

  // Offices state
  const [offices, setOffices] = useState<Office[]>([]);
  const [isLoadingOffices, setIsLoadingOffices] = useState(false);

  // Функція для створення акаунта
  const handleCreateAccount = async (sessionString: string) => {
    if (!sessionString) {
      toast.error("Session string не може бути порожнім");
      return;
    }
    if (!newTgName) {
      toast.error("Вкажіть назву акаунта");
      return;
    }
    
    setIsSavingTg(true);
    try {
      const created = await settingsApi.createTelegramAccount({
        name: newTgName,
        phone: newTgPhone || undefined,
        session_string: sessionString.trim(),
        api_id: newTgApiId ? parseInt(newTgApiId) : undefined,
        api_hash: newTgApiHash || undefined,
      });
      setTelegramAccounts((prev) => [...prev, created]);
      // Reset all fields
      setNewTgName("");
      setNewTgPhone("");
      setNewTgApiId("");
      setNewTgApiHash("");
      setCodeSent(false);
      setTelegramCode("");
      setTelegramPassword("");
      setSessionId("");
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
  };
  const [isSavingOffice, setIsSavingOffice] = useState(false);
  const [newOffice, setNewOffice] = useState<OfficeCreate>({
    name: "",
    address: "",
    city: "",
    postal_code: "",
    phone: "",
    email: "",
    working_hours: "",
    is_default: false,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [
          brandingData,
          tgAccounts,
          smtpSettings,
          managerSmtpAccountsData,
          whatsappConfig,
          instagramConfig,
          facebookConfig,
          stripeConfig,
          inpostConfig,
        ] = await Promise.all([
          settingsApi.getBranding(),
          settingsApi.getTelegramAccounts(),
          settingsApi.getSmtpSettings(),
          settingsApi.getManagerSmtpAccounts().catch(() => []),
          settingsApi.getWhatsAppConfig().catch(() => ({ access_token: "", phone_number_id: "", app_secret: "", verify_token: "" })),
          settingsApi.getInstagramConfig().catch(() => ({ app_id: "", access_token: "", app_secret: "", verify_token: "" })),
          settingsApi.getFacebookConfig().catch(() => ({ app_id: "", access_token: "", app_secret: "", verify_token: "", page_id: "" })),
          settingsApi.getStripeConfig().catch(() => ({ secret_key: "" })),
          settingsApi.getInPostConfig().catch(() => ({ api_key: "" })),
        ]);
        setBranding(brandingData);
        setTelegramAccounts(tgAccounts);
        setSmtp(smtpSettings);
        setManagerSmtpAccounts(managerSmtpAccountsData);
        setWhatsapp(whatsappConfig);
        setInstagram(instagramConfig);
        setFacebook(facebookConfig);
        setStripe(stripeConfig);
        setInpost(inpostConfig);
      } catch (error) {
        console.error(error);
      }
    };

    const loadOffices = async () => {
      setIsLoadingOffices(true);
      try {
        const data = await officesApi.getOffices();
        setOffices(data);
      } catch (error) {
        console.error("Failed to load offices:", error);
      } finally {
        setIsLoadingOffices(false);
      }
    };

    loadData();
    loadOffices();
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

      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Брендинг та лого
          </TabsTrigger>
          <TabsTrigger value="offices" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Офіси
          </TabsTrigger>
          <TabsTrigger value="telegram" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Telegram
          </TabsTrigger>
          <TabsTrigger value="smtp" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            SMTP
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="instagram" className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Instagram
          </TabsTrigger>
          <TabsTrigger value="facebook" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Facebook
          </TabsTrigger>
          <TabsTrigger value="stripe" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            Stripe
          </TabsTrigger>
          <TabsTrigger value="inpost" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            InPost
          </TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding" className="mt-0">
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
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        {/* Offices Tab */}
        <TabsContent value="offices" className="mt-0">
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Офіси
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Управління адресами офісів для видачі замовлень клієнтам.
          </p>

          {/* Current Offices */}
          <div className="space-y-2">
            <Label>Поточні офіси</Label>
            {isLoadingOffices ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : offices.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">
                Ще не додано жодного офісу.
              </p>
            ) : (
              <div className="space-y-2">
                {offices.map((office) => (
                  <div
                    key={office.id}
                    className="flex items-center justify-between gap-4 p-3 border rounded-lg bg-gray-50"
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {office.name}
                          </span>
                          {office.is_default && (
                            <Badge className="bg-orange-100 text-orange-700 text-xs">
                              <Star className="w-3 h-3 mr-1" />
                              За замовчуванням
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-gray-600">
                          {office.address}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!office.is_default && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await officesApi.updateOffice(office.id, { is_default: true });
                              const updated = await officesApi.getOffices();
                              setOffices(updated);
                              toast.success("Офіс встановлено за замовчуванням");
                            } catch (error) {
                              toast.error("Не вдалося оновити офіс");
                            }
                          }}
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={async () => {
                          try {
                            await officesApi.deleteOffice(office.id);
                            setOffices((prev) =>
                              prev.filter((o) => o.id !== office.id)
                            );
                            toast.success("Офіс видалено");
                          } catch (error) {
                            toast.error("Не вдалося видалити офіс");
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Office */}
          <div className="border-t pt-4 space-y-4">
            <Label>Додати новий офіс</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="office-name">Назва офісу *</Label>
                <Input
                  id="office-name"
                  placeholder="Наприклад: Офіс в центрі"
                  value={newOffice.name}
                  onChange={(e) =>
                    setNewOffice({ ...newOffice, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="office-address">Адреса *</Label>
                <Input
                  id="office-address"
                  placeholder="вул. Шевченка, 10"
                  value={newOffice.address}
                  onChange={(e) =>
                    setNewOffice({ ...newOffice, address: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="office-city">Місто *</Label>
                <Input
                  id="office-city"
                  placeholder="Київ"
                  value={newOffice.city}
                  onChange={(e) =>
                    setNewOffice({ ...newOffice, city: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="office-postal-code">Поштовий індекс *</Label>
                <Input
                  id="office-postal-code"
                  placeholder="01001"
                  value={newOffice.postal_code}
                  onChange={(e) =>
                    setNewOffice({ ...newOffice, postal_code: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="office-phone">Телефон *</Label>
                <Input
                  id="office-phone"
                  placeholder="+380 12 345 6789"
                  value={newOffice.phone}
                  onChange={(e) =>
                    setNewOffice({ ...newOffice, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="office-email">Email *</Label>
                <Input
                  id="office-email"
                  type="email"
                  placeholder="office@example.com"
                  value={newOffice.email}
                  onChange={(e) =>
                    setNewOffice({ ...newOffice, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="office-working-hours">Години роботи *</Label>
                <Input
                  id="office-working-hours"
                  placeholder="Пн-Пт: 9:00-18:00"
                  value={newOffice.working_hours}
                  onChange={(e) =>
                    setNewOffice({ ...newOffice, working_hours: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="office-default"
                checked={newOffice.is_default}
                onCheckedChange={(checked) =>
                  setNewOffice({ ...newOffice, is_default: checked === true })
                }
              />
              <Label htmlFor="office-default" className="text-sm font-normal cursor-pointer">
                Встановити як офіс за замовчуванням
              </Label>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                disabled={
                  isSavingOffice ||
                  !newOffice.name ||
                  !newOffice.address ||
                  !newOffice.city ||
                  !newOffice.postal_code ||
                  !newOffice.phone ||
                  !newOffice.email ||
                  !newOffice.working_hours
                }
                onClick={async () => {
                  setIsSavingOffice(true);
                  try {
                    const created = await officesApi.createOffice(newOffice);
                    // Refresh list to get updated is_default status
                    const updated = await officesApi.getOffices();
                    setOffices(updated);
                    setNewOffice({
                      name: "",
                      address: "",
                      city: "",
                      postal_code: "",
                      phone: "",
                      email: "",
                      working_hours: "",
                      is_default: false,
                    });
                    toast.success("Офіс додано");
                  } catch (error: any) {
                    const message =
                      error?.detail ||
                      error?.message ||
                      "Не вдалося додати офіс";
                    toast.error(
                      typeof message === "string"
                        ? message
                        : "Не вдалося додати офіс"
                    );
                  } finally {
                    setIsSavingOffice(false);
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                {isSavingOffice ? "Збереження..." : "Додати офіс"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        {/* Telegram Tab */}
        <TabsContent value="telegram" className="mt-0 space-y-6">
          {/* Список доданих акаунтів */}
          <Card>
            <CardHeader>
              <CardTitle>Додані Telegram акаунти ({telegramAccounts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {telegramAccounts.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Ще не додано жодного Telegram акаунта. Додайте акаунт нижче.
                </p>
              ) : (
                <div className="space-y-3">
                  {telegramAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-start justify-between gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 mb-1">
                          {acc.name}
                        </div>
                        {acc.phone && (
                          <div className="text-sm text-gray-600 mb-1">
                            📱 {acc.phone}
                          </div>
                        )}
                        {acc.api_id && acc.api_hash && (
                          <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mt-1">
                            🔑 API: {acc.api_id} / {acc.api_hash.substring(0, 12)}...
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
                        onClick={async () => {
                          if (confirm(`Видалити акаунт "${acc.name}"?`)) {
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
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Додати акаунт менеджера</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!codeSent ? (
                /* Крок 1: Введення даних та запит коду */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tg-name">Назва акаунта в системі *</Label>
                    <Input
                      id="tg-name"
                      placeholder="Наприклад: Менеджер Іван"
                      value={newTgName}
                      onChange={(e) => setNewTgName(e.target.value)}
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tg-phone">Телефон акаунта *</Label>
                    <Input
                      id="tg-phone"
                      placeholder="+380..."
                      value={newTgPhone}
                      onChange={(e) => setNewTgPhone(e.target.value)}
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tg-account-api-id">API ID *</Label>
                      <Input
                        id="tg-account-api-id"
                        type="number"
                        placeholder="Введіть API ID"
                        value={newTgApiId}
                        onChange={(e) => setNewTgApiId(e.target.value)}
                        disabled={isGenerating}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tg-account-api-hash">API Hash *</Label>
                      <Input
                        id="tg-account-api-hash"
                        placeholder="Введіть API Hash"
                        value={newTgApiHash}
                        onChange={(e) => setNewTgApiHash(e.target.value)}
                        disabled={isGenerating}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500">
                    API ID та API Hash можна отримати на{" "}
                    <a href="https://my.telegram.org/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      my.telegram.org/apps
                    </a>
                  </p>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                      disabled={isGenerating || !newTgName || !newTgPhone || !newTgApiId || !newTgApiHash}
                      onClick={async () => {
                        if (!newTgApiId || !newTgApiHash || !newTgPhone) {
                          toast.error("Заповніть всі обов'язкові поля");
                          return;
                        }
                        
                        setIsGenerating(true);
                        try {
                          const result = await settingsApi.generateTelegramSession({
                            api_id: newTgApiId,
                            api_hash: newTgApiHash,
                            phone: newTgPhone,
                          });
                          if (result.status === "code_sent") {
                            setCodeSent(true);
                            setSessionId(result.session_id || "");
                            toast.success("Код відправлено в Telegram!");
                          } else if (result.status === "success" && result.session_string) {
                            await handleCreateAccount(result.session_string);
                          }
                        } catch (error: any) {
                          toast.error(error?.data?.detail || error?.message || "Помилка при відправці коду");
                        } finally {
                          setIsGenerating(false);
                        }
                      }}
                    >
                      {isGenerating ? "Відправка..." : "Отримати код"}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Крок 2: Введення коду та підтвердження */
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                    📱 Код відправлено на <strong>{newTgPhone}</strong>. Перевірте Telegram.
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tg-code">Код з Telegram *</Label>
                    <Input
                      id="tg-code"
                      placeholder="Введіть код"
                      value={telegramCode}
                      onChange={(e) => setTelegramCode(e.target.value)}
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tg-password">Пароль 2FA (якщо встановлено)</Label>
                    <Input
                      id="tg-password"
                      type="password"
                      placeholder="Опційно"
                      value={telegramPassword}
                      onChange={(e) => setTelegramPassword(e.target.value)}
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={isGenerating}
                      onClick={() => {
                        setCodeSent(false);
                        setTelegramCode("");
                        setTelegramPassword("");
                        setSessionId("");
                      }}
                    >
                      Скасувати
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                      disabled={isGenerating || !telegramCode}
                      onClick={async () => {
                        setIsGenerating(true);
                        try {
                          const result = await settingsApi.generateTelegramSession({
                            api_id: newTgApiId,
                            api_hash: newTgApiHash,
                            phone: newTgPhone,
                            code: telegramCode,
                            password: telegramPassword || undefined,
                            session_id: sessionId,
                          });
                          if (result.status === "success" && result.session_string) {
                            await handleCreateAccount(result.session_string);
                          } else {
                            toast.error("Не вдалося отримати session");
                          }
                        } catch (error: any) {
                          toast.error(error?.data?.detail || error?.message || "Помилка авторизації");
                        } finally {
                          setIsGenerating(false);
                        }
                      }}
                    >
                      {isGenerating ? "Авторизація..." : "Підтвердити"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMTP Tab */}
        <TabsContent value="smtp" className="mt-0 space-y-6">
          {/* KP SMTP Settings */}
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

          {/* Manager SMTP Accounts */}
          <Card>
            <CardHeader>
              <CardTitle>SMTP акаунти менеджерів для inbox ({managerSmtpAccounts.length}/10)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Додайте SMTP акаунти менеджерів для підключення до inbox. Якщо менеджерський SMTP підключено,
                всі email, які приходять на цей акаунт, автоматично потрапляють в inbox чат.
                Відповіді з inbox відправляються з підключеного email.
              </p>

              {/* Existing Accounts */}
              {managerSmtpAccounts.length > 0 && (
                <div className="space-y-2">
                  <Label>Поточні акаунти</Label>
                  <div className="space-y-2">
                    {managerSmtpAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between gap-4 p-3 border rounded-lg bg-gray-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 mb-1">
                            {account.name}
                          </div>
                          <div className="text-sm text-gray-600">
                            📧 {account.email}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {account.smtp_host}:{account.smtp_port}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
                          onClick={async () => {
                            if (confirm(`Видалити SMTP акаунт "${account.name}"?`)) {
                              try {
                                await settingsApi.deleteManagerSmtpAccount(account.id);
                                setManagerSmtpAccounts((prev) =>
                                  prev.filter((a) => a.id !== account.id)
                                );
                                toast.success("SMTP акаунт видалено");
                              } catch (error) {
                                console.error(error);
                                toast.error("Не вдалося видалити SMTP акаунт");
                              }
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Account */}
              {managerSmtpAccounts.length < 10 && (
                <div className="border-t pt-4 space-y-4">
                  <Label>Додати новий SMTP акаунт менеджера</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="manager-smtp-name">Назва менеджера *</Label>
                      <Input
                        id="manager-smtp-name"
                        placeholder="Наприклад: Менеджер Іван"
                        value={newManagerSmtp.name}
                        onChange={(e) =>
                          setNewManagerSmtp({ ...newManagerSmtp, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager-smtp-email">Email адреса *</Label>
                      <Input
                        id="manager-smtp-email"
                        type="email"
                        placeholder="manager@example.com"
                        value={newManagerSmtp.email}
                        onChange={(e) =>
                          setNewManagerSmtp({ ...newManagerSmtp, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager-smtp-host">SMTP Host *</Label>
                      <Input
                        id="manager-smtp-host"
                        placeholder="smtp.gmail.com"
                        value={newManagerSmtp.smtp_host}
                        onChange={(e) =>
                          setNewManagerSmtp({ ...newManagerSmtp, smtp_host: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager-smtp-port">SMTP Port *</Label>
                      <Input
                        id="manager-smtp-port"
                        type="number"
                        placeholder="587"
                        value={newManagerSmtp.smtp_port}
                        onChange={(e) =>
                          setNewManagerSmtp({
                            ...newManagerSmtp,
                            smtp_port: parseInt(e.target.value) || 587,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager-smtp-user">SMTP User (логін) *</Label>
                      <Input
                        id="manager-smtp-user"
                        placeholder="user@example.com"
                        value={newManagerSmtp.smtp_user}
                        onChange={(e) =>
                          setNewManagerSmtp({ ...newManagerSmtp, smtp_user: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager-smtp-password">SMTP Password *</Label>
                      <Input
                        id="manager-smtp-password"
                        type="password"
                        placeholder="••••••••"
                        value={newManagerSmtp.smtp_password}
                        onChange={(e) =>
                          setNewManagerSmtp({ ...newManagerSmtp, smtp_password: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager-imap-host">IMAP Host (опційно)</Label>
                      <Input
                        id="manager-imap-host"
                        placeholder="imap.gmail.com (за замовчуванням = SMTP Host)"
                        value={newManagerSmtp.imap_host || ""}
                        onChange={(e) =>
                          setNewManagerSmtp({
                            ...newManagerSmtp,
                            imap_host: e.target.value || null,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manager-imap-port">IMAP Port (опційно)</Label>
                      <Input
                        id="manager-imap-port"
                        type="number"
                        placeholder="993"
                        value={newManagerSmtp.imap_port || ""}
                        onChange={(e) =>
                          setNewManagerSmtp({
                            ...newManagerSmtp,
                            imap_port: e.target.value ? parseInt(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                      disabled={
                        isSavingManagerSmtp ||
                        !newManagerSmtp.name ||
                        !newManagerSmtp.email ||
                        !newManagerSmtp.smtp_host ||
                        !newManagerSmtp.smtp_user ||
                        !newManagerSmtp.smtp_password
                      }
                      onClick={async () => {
                        setIsSavingManagerSmtp(true);
                        try {
                          const created = await settingsApi.createManagerSmtpAccount(newManagerSmtp);
                          setManagerSmtpAccounts((prev) => [...prev, created]);
                          setNewManagerSmtp({
                            name: "",
                            email: "",
                            smtp_host: "",
                            smtp_port: 587,
                            smtp_user: "",
                            smtp_password: "",
                            imap_host: null,
                            imap_port: 993,
                          });
                          toast.success("SMTP акаунт менеджера додано");
                        } catch (error: any) {
                          const message =
                            error?.detail ||
                            error?.message ||
                            "Не вдалося додати SMTP акаунт";
                          toast.error(
                            typeof message === "string" ? message : "Не вдалося додати SMTP акаунт"
                          );
                        } finally {
                          setIsSavingManagerSmtp(false);
                        }
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isSavingManagerSmtp ? "Збереження..." : "Додати SMTP акаунт"}
                    </Button>
                  </div>
                </div>
              )}

              {managerSmtpAccounts.length >= 10 && (
                <p className="text-sm text-amber-600">
                  Досягнуто максимальної кількості SMTP акаунтів (10). Видаліть один з існуючих, щоб додати новий.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp API налаштування</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-access-token">Access Token</Label>
                  <Input
                    id="whatsapp-access-token"
                    type="password"
                    value={whatsapp.access_token}
                    onChange={(e) => setWhatsapp({ ...whatsapp, access_token: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-phone-number-id">Phone Number ID</Label>
                  <Input
                    id="whatsapp-phone-number-id"
                    value={whatsapp.phone_number_id}
                    onChange={(e) => setWhatsapp({ ...whatsapp, phone_number_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-app-secret">App Secret</Label>
                  <Input
                    id="whatsapp-app-secret"
                    type="password"
                    value={whatsapp.app_secret}
                    onChange={(e) => setWhatsapp({ ...whatsapp, app_secret: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-verify-token">Verify Token</Label>
                  <Input
                    id="whatsapp-verify-token"
                    value={whatsapp.verify_token}
                    onChange={(e) => setWhatsapp({ ...whatsapp, verify_token: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                  disabled={isSavingWhatsApp}
                  onClick={async () => {
                    setIsSavingWhatsApp(true);
                    try {
                      await settingsApi.updateWhatsAppConfig(whatsapp);
                      toast.success("WhatsApp налаштування збережено");
                    } catch (error) {
                      console.error(error);
                      toast.error("Не вдалося зберегти WhatsApp налаштування");
                    } finally {
                      setIsSavingWhatsApp(false);
                    }
                  }}
                >
                  {isSavingWhatsApp ? "Збереження..." : "Зберегти WhatsApp"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instagram Tab */}
        <TabsContent value="instagram" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Instagram API налаштування</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram-app-id">Instagram App ID</Label>
                  <Input
                    id="instagram-app-id"
                    value={instagram.app_id}
                    onChange={(e) => setInstagram({ ...instagram, app_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram-access-token">Access Token</Label>
                  <Input
                    id="instagram-access-token"
                    type="password"
                    value={instagram.access_token}
                    onChange={(e) => setInstagram({ ...instagram, access_token: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram-app-secret">App Secret</Label>
                  <Input
                    id="instagram-app-secret"
                    type="password"
                    value={instagram.app_secret}
                    onChange={(e) => setInstagram({ ...instagram, app_secret: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram-verify-token">Verify Token</Label>
                  <Input
                    id="instagram-verify-token"
                    value={instagram.verify_token}
                    onChange={(e) => setInstagram({ ...instagram, verify_token: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!instagram.app_id}
                  onClick={() => {
                    if (!instagram.app_id) {
                      toast.error("Спочатку введіть Instagram App ID");
                      return;
                    }
                    // Відкриваємо OAuth URL
                    const oauthUrl = `${API_BASE_URL}/communications/instagram/auth`;
                    window.location.href = oauthUrl;
                  }}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Підключити Instagram
                </Button>
                <Button
                  type="button"
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                  disabled={isSavingInstagram}
                  onClick={async () => {
                    setIsSavingInstagram(true);
                    try {
                      await settingsApi.updateInstagramConfig(instagram);
                      toast.success("Instagram налаштування збережено");
                    } catch (error) {
                      console.error(error);
                      toast.error("Не вдалося зберегти Instagram налаштування");
                    } finally {
                      setIsSavingInstagram(false);
                    }
                  }}
                >
                  {isSavingInstagram ? "Збереження..." : "Зберегти Instagram"}
                </Button>
              </div>
              {!instagram.app_id && (
                <p className="text-sm text-muted-foreground">
                  💡 Введіть Instagram App ID та App Secret, потім натисніть "Підключити Instagram" для автоматичного отримання Access Token через OAuth.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Facebook Tab */}
        <TabsContent value="facebook" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Facebook API налаштування</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="facebook-app-id">App ID</Label>
                  <Input
                    id="facebook-app-id"
                    value={facebook.app_id}
                    onChange={(e) => setFacebook({ ...facebook, app_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook-access-token">Access Token</Label>
                  <Input
                    id="facebook-access-token"
                    type="password"
                    value={facebook.access_token}
                    onChange={(e) => setFacebook({ ...facebook, access_token: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook-app-secret">App Secret</Label>
                  <Input
                    id="facebook-app-secret"
                    type="password"
                    value={facebook.app_secret}
                    onChange={(e) => setFacebook({ ...facebook, app_secret: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook-verify-token">Verify Token</Label>
                  <Input
                    id="facebook-verify-token"
                    value={facebook.verify_token}
                    onChange={(e) => setFacebook({ ...facebook, verify_token: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook-page-id">Page ID</Label>
                  <Input
                    id="facebook-page-id"
                    value={facebook.page_id}
                    onChange={(e) => setFacebook({ ...facebook, page_id: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!facebook.app_id || !facebook.app_secret}
                  onClick={() => {
                    window.location.href = `${API_BASE_URL}/communications/facebook/auth`;
                  }}
                >
                  Підключити Facebook
                </Button>
                <Button
                  type="button"
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                  disabled={isSavingFacebook}
                  onClick={async () => {
                    setIsSavingFacebook(true);
                    try {
                      await settingsApi.updateFacebookConfig(facebook);
                      toast.success("Facebook налаштування збережено");
                    } catch (error) {
                      console.error(error);
                      toast.error("Не вдалося зберегти Facebook налаштування");
                    } finally {
                      setIsSavingFacebook(false);
                    }
                  }}
                >
                  {isSavingFacebook ? "Збереження..." : "Зберегти Facebook"}
                </Button>
              </div>
              {!facebook.app_id && (
                <p className="text-sm text-muted-foreground">
                  💡 Введіть Facebook App ID та App Secret, потім натисніть "Підключити Facebook" для автоматичного отримання Access Token через OAuth.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stripe Tab */}
        <TabsContent value="stripe" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Stripe API налаштування</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stripe-secret-key">Secret Key</Label>
                <Input
                  id="stripe-secret-key"
                  type="password"
                  value={stripe.secret_key}
                  onChange={(e) => setStripe({ ...stripe, secret_key: e.target.value })}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                  disabled={isSavingStripe}
                  onClick={async () => {
                    setIsSavingStripe(true);
                    try {
                      await settingsApi.updateStripeConfig(stripe);
                      toast.success("Stripe налаштування збережено");
                    } catch (error) {
                      console.error(error);
                      toast.error("Не вдалося зберегти Stripe налаштування");
                    } finally {
                      setIsSavingStripe(false);
                    }
                  }}
                >
                  {isSavingStripe ? "Збереження..." : "Зберегти Stripe"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* InPost Tab */}
        <TabsContent value="inpost" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>InPost API налаштування</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inpost-api-key">API Key</Label>
                <Input
                  id="inpost-api-key"
                  type="password"
                  value={inpost.api_key}
                  onChange={(e) => setInpost({ ...inpost, api_key: e.target.value })}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                  disabled={isSavingInPost}
                  onClick={async () => {
                    setIsSavingInPost(true);
                    try {
                      await settingsApi.updateInPostConfig(inpost);
                      toast.success("InPost налаштування збережено");
                    } catch (error) {
                      console.error(error);
                      toast.error("Не вдалося зберегти InPost налаштування");
                    } finally {
                      setIsSavingInPost(false);
                    }
                  }}
                >
                  {isSavingInPost ? "Збереження..." : "Зберегти InPost"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}


