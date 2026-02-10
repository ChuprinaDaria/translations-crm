import React, { useEffect, useState, ChangeEvent, useCallback } from "react";
import { UploadCloud, Building2, Plus, Trash2, MapPin, Star, Loader2, Image as ImageIcon, MessageSquare, Mail, Bot, AlertTriangle } from "lucide-react";
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
  communicationsApi,
  getImageUrl,
  API_BASE_URL,
  type BrandingSettings,
  type TelegramAccount,
  type SmtpSettings,
  type ManagerSmtpAccount,
  type ManagerSmtpAccountCreate,
  type ManagerSmtpAccountUpdate,
  type WhatsAppConfig,
  type WhatsAppAccount,
  type InstagramConfig,
  type FacebookConfig,
  type StripeConfig,
  type InPostConfig,
  type AISettings,
  type AISettingsUpdate,
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
    template_name: "",
    template_language: "en_US",
  });
  const [isSavingWhatsApp, setIsSavingWhatsApp] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<{
    connected: boolean;
    has_phone_number_id: boolean;
    has_waba_id: boolean;
  }>({
    connected: false,
    has_phone_number_id: false,
    has_waba_id: false,
  });
  const [isConnectingWhatsApp, setIsConnectingWhatsApp] = useState(false);
  // Embedded signup session info
  const [embeddedSignupSessionInfo, setEmbeddedSignupSessionInfo] = useState<{
    phone_number_id?: string;
    waba_id?: string;
  }>({});
  // WhatsApp accounts
  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsAppAccount[]>([]);
  const [isLoadingWhatsAppAccounts, setIsLoadingWhatsAppAccounts] = useState(false);

  // Instagram state
  const [instagram, setInstagram] = useState<InstagramConfig>({
    app_id: "",
    access_token: "",
    app_secret: "",
    verify_token: "",
    page_id: "",
    page_name: "",
    business_id: "",
  });
  const [isSavingInstagram, setIsSavingInstagram] = useState(false);
  const [instagramStatus, setInstagramStatus] = useState<{
    connected: boolean;
    has_page_id: boolean;
    has_business_id: boolean;
  }>({
    connected: false,
    has_page_id: false,
    has_business_id: false,
  });

  // Facebook state
  const [facebook, setFacebook] = useState<FacebookConfig>({
    app_id: "",
    access_token: "",
    app_secret: "",
    verify_token: "",
    page_id: "",
    config_id: "",
  });
  const [isSavingFacebook, setIsSavingFacebook] = useState(false);

  // Stripe state
  const [stripe, setStripe] = useState<StripeConfig>({
    secret_key: "",
  });
  const [isSavingStripe, setIsSavingStripe] = useState(false);

  // Przelewy24 state
  const [przelewy24, setPrzelewy24] = useState({
    merchant_id: "",
    pos_id: "",
    crc: "",
    api_key: "",
    sandbox: true,
  });
  const [isSavingPrzelewy24, setIsSavingPrzelewy24] = useState(false);

  // InPost state
  const [inpost, setInpost] = useState<InPostConfig>({
    api_key: "",
    sandbox_mode: false,
    sandbox_api_key: "",
    webhook_url: `${API_BASE_URL}/postal-services/inpost/webhook`,
    webhook_secret: "",
    default_sender_email: "",
    default_sender_phone: "",
    default_sender_name: "",
    is_enabled: false,
  });
  const [isSavingInPost, setIsSavingInPost] = useState(false);
  const [isLoadingInPost, setIsLoadingInPost] = useState(false);

  // AI Integration state
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isSavingAI, setIsSavingAI] = useState(false);

  // Danger zone state
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

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

  // Функції для оновлення статусів
  const refreshWhatsAppStatus = useCallback(async () => {
    try {
      const status = await settingsApi.getWhatsAppStatus();
      setWhatsappStatus(status);
    } catch (error) {
      console.error("Failed to refresh WhatsApp status:", error);
    }
  }, []);

  const refreshInstagramStatus = useCallback(async () => {
    try {
      const status = await settingsApi.getInstagramStatus();
      setInstagramStatus(status);
    } catch (error) {
      console.error("Failed to refresh Instagram status:", error);
    }
  }, []);

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
          aiSettingsData,
        ] = await Promise.all([
          settingsApi.getBranding(),
          settingsApi.getTelegramAccounts(),
          settingsApi.getSmtpSettings(),
          settingsApi.getManagerSmtpAccounts().catch(() => []),
          settingsApi.getWhatsAppConfig().catch(() => ({ access_token: "", phone_number_id: "", app_secret: "", verify_token: "", template_name: "", template_language: "en_US" })),
          settingsApi.getInstagramConfig().catch(() => ({ app_id: "", access_token: false as boolean, app_secret: "", verify_token: "", page_id: "", page_name: "", business_id: "" })),
          settingsApi.getFacebookConfig().catch(() => ({ app_id: "", access_token: "", app_secret: "", verify_token: "", page_id: "", config_id: "" })),
          settingsApi.getStripeConfig().catch(() => ({ secret_key: "" })),
          settingsApi.getInPostConfig().catch(() => ({
            api_key: "",
            sandbox_mode: false,
            sandbox_api_key: "",
            webhook_url: `${API_BASE_URL}/postal-services/inpost/webhook`,
            webhook_secret: "",
            default_sender_email: "",
            default_sender_phone: "",
            default_sender_name: "",
            is_enabled: false,
          })),
          settingsApi.getAISettings().catch(() => null),
        ]);
        setBranding(brandingData);
        setTelegramAccounts(tgAccounts);
        setSmtp(smtpSettings);
        setManagerSmtpAccounts(managerSmtpAccountsData);
        // Очищаємо phone_number_id від email або інших нецифрових символів
        const cleanPhoneNumberId = whatsappConfig.phone_number_id 
          ? whatsappConfig.phone_number_id.replace(/[^0-9]/g, '')
          : "";
        
        setWhatsapp({
          ...whatsappConfig,
          phone_number_id: cleanPhoneNumberId
        });
        setInstagram(instagramConfig);
        
        // Перевіряємо статуси
        try {
          const whatsappStatus = await settingsApi.getWhatsAppStatus();
          setWhatsappStatus(whatsappStatus);
        } catch (error) {
          console.error("Failed to get WhatsApp status:", error);
        }
        
        // Завантажуємо WhatsApp акаунти
        try {
          const accounts = await settingsApi.getWhatsAppAccounts();
          setWhatsappAccounts(accounts);
        } catch (error) {
          console.error("Failed to load WhatsApp accounts:", error);
        }
        
        try {
          const instagramStatus = await settingsApi.getInstagramStatus();
          setInstagramStatus(instagramStatus);
        } catch (error) {
          console.error("Failed to get Instagram status:", error);
        }
        
        setFacebook(facebookConfig);
        setStripe(stripeConfig);
        setInpost({
          ...inpostConfig,
          webhook_url: inpostConfig.webhook_url || `${API_BASE_URL}/postal-services/inpost/webhook`,
        });
        if (aiSettingsData) {
          setAiSettings(aiSettingsData);
        } else {
          // Ініціалізуємо порожні налаштування якщо не знайдено
          setAiSettings({
            id: 0,
            rag_api_url: "https://api.adme-ai.com/v1",
            rag_api_key: "",
            rag_token: "adme_rag_secret_987654321",
            is_enabled: false,
            trigger_delay_seconds: 10,
            active_channels: [],
            webhook_secret: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
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

  // MessageEvent handler for WhatsApp Embedded Signup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
        return;
      }

      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          // If user finishes the Embedded Signup flow
          if (data.event === 'FINISH') {
            const { phone_number_id, waba_id } = data.data;
            console.log("Phone number ID:", phone_number_id, "WhatsApp business account ID:", waba_id);
            
            // Store session info in local state
            setEmbeddedSignupSessionInfo({
              phone_number_id,
              waba_id,
            });

            // Update WhatsApp config with phone_number_id
            if (phone_number_id) {
              setWhatsapp((prev) => ({
                ...prev,
                phone_number_id: phone_number_id.toString(),
              }));
            }

            toast.success(`WhatsApp Business підключено! Phone Number ID: ${phone_number_id}, WABA ID: ${waba_id}`);
          } 
          // If user cancels the Embedded Signup flow
          else if (data.event === 'CANCEL') {
            const { current_step } = data.data;
            console.warn("Embedded Signup cancelled at step:", current_step);
            toast.info("Встроенная регистрация скасована");
          } 
          // If user reports an error during the Embedded Signup flow
          else if (data.event === 'ERROR') {
            const { error_message } = data.data;
            console.error("Embedded Signup error:", error_message);
            toast.error(`Помилка встроенной регистрації: ${error_message}`);
          }
        }
      } catch (error) {
        // Not JSON or not our message type, ignore
        console.log('Non JSON Responses or non-embedded signup message:', event.data);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Facebook login callback for embedded signup
  const fbLoginCallback = useCallback((response: any) => {
    if (response.authResponse && response.authResponse.code) {
      const code = response.authResponse.code;
      console.log("Received authorization code from Facebook:", code);
      
      // Exchange code for access token via backend
      if (facebook.app_id && facebook.app_secret) {
        setIsConnectingWhatsApp(true);
        settingsApi.connectWhatsApp(
          code,
          facebook.app_id,
          facebook.app_secret,
          undefined // redirect_uri is optional
        )
          .then((result) => {
            setWhatsapp({
              ...whatsapp,
              access_token: result.access_token,
              phone_number_id: result.phone_number_id || embeddedSignupSessionInfo.phone_number_id || "",
            });
            return refreshWhatsAppStatus();
          })
          .then(async () => {
            // Оновлюємо список акаунтів
            try {
              const accounts = await settingsApi.getWhatsAppAccounts();
              setWhatsappAccounts(accounts);
            } catch (error) {
              console.error("Failed to load WhatsApp accounts:", error);
            }
            toast.success("WhatsApp успішно підключено через встроенную регистрацию!");
          })
          .catch((error: any) => {
            console.error("Error exchanging code for token:", error);
            toast.error(error.message || "Не вдалося обміняти код на токен");
          })
          .finally(() => {
            setIsConnectingWhatsApp(false);
          });
      } else {
        toast.error("Facebook App ID та App Secret не налаштовано");
      }
    } else {
      console.log("Facebook login response:", response);
      if (response.status === 'not_authorized') {
        toast.error("Користувач не авторизовав додаток");
      }
    }
  }, [facebook.app_id, facebook.app_secret, whatsapp, embeddedSignupSessionInfo, refreshWhatsAppStatus]);

  // Launch WhatsApp Embedded Signup
  const launchWhatsAppSignup = useCallback(async () => {
    if (!facebook.app_id || !facebook.config_id) {
      toast.error("Спочатку налаштуйте Facebook App ID та Config ID в Settings → Facebook");
      return;
    }

    try {
      // Initialize Facebook SDK
      const { initFacebookSDK } = await import('../lib/facebook-sdk');
      await initFacebookSDK(facebook.app_id);

      // Check if FB is available
      if (!window.FB) {
        throw new Error("Facebook SDK не завантажено");
      }

      // Launch Facebook login with embedded signup configuration
      window.FB.login(fbLoginCallback, {
        config_id: facebook.config_id,
        response_type: 'code', // Must be set to 'code' for System User access token
        override_default_response_type: true, // When true, response_type takes precedence
        extras: {
          version: "v3",
          featureType: "whatsapp_business_app_onboarding",
          features: [
            { name: "marketing_messages_lite" },
            { name: "app_only_install" }
          ]
        }
      });
    } catch (error: any) {
      console.error("Error launching WhatsApp signup:", error);
      toast.error(error.message || "Не вдалося запустити встроенную регистрацию");
    }
  }, [facebook.app_id, facebook.config_id, fbLoginCallback]);

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
        <TabsList className="mb-6 overflow-x-auto flex-nowrap">
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
          <TabsTrigger value="przelewy24" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            Przelewy24
          </TabsTrigger>
          <TabsTrigger value="inpost" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            InPost
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            AI Integration
          </TabsTrigger>
          <TabsTrigger value="danger" className="flex items-center gap-2 text-red-600 data-[state=active]:text-red-700">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
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
              {/* Статус підключення */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${whatsappStatus.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div>
                    <p className="font-medium">
                      {whatsappStatus.connected ? 'Підключено' : 'Не підключено'}
                    </p>
                    {whatsappStatus.connected && (
                      <p className="text-sm text-gray-500">
                        {whatsappStatus.has_phone_number_id ? 'Phone Number ID налаштовано' : 'Phone Number ID не налаштовано'}
                      </p>
                    )}
                  </div>
                </div>
                {whatsappStatus.connected ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isConnectingWhatsApp}
                    onClick={async () => {
                      try {
                        await settingsApi.disconnectWhatsApp();
                        setWhatsapp({ ...whatsapp, access_token: "", phone_number_id: "" });
                        await refreshWhatsAppStatus();
                        toast.success("WhatsApp відключено");
                      } catch (error) {
                        console.error(error);
                        toast.error("Не вдалося відключити WhatsApp");
                      }
                    }}
                  >
                    Відключити
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                    disabled={isConnectingWhatsApp || !facebook.app_id || !facebook.config_id || !facebook.app_secret}
                    onClick={async () => {
                      if (!facebook.app_id || !facebook.config_id || !facebook.app_secret) {
                        toast.error("Спочатку налаштуйте Facebook App ID, Config ID та App Secret в Settings → Facebook");
                        return;
                      }
                      
                      setIsConnectingWhatsApp(true);
                      try {
                        // Імпортуємо функції для роботи з Facebook SDK
                        const { 
                          initFacebookSDK, 
                          loginWithFacebookForBusinessFromSettings 
                        } = await import('../lib/facebook-sdk');
                        
                        // Ініціалізуємо SDK
                        await initFacebookSDK(facebook.app_id);
                        
                        // Викликаємо login з config_id з налаштувань
                        const loginResponse = await loginWithFacebookForBusinessFromSettings(true);
                        
                        if (loginResponse.code) {
                          // Обмінюємо code на токен (передаємо app_id та app_secret з налаштувань)
                          // Також передаємо redirect_uri якщо він є (для WhatsApp Business Messaging)
                          const redirectUri = (loginResponse as any).redirect_uri;
                          const result = await settingsApi.connectWhatsApp(
                            loginResponse.code,
                            facebook.app_id,
                            facebook.app_secret,
                            redirectUri
                          );
                          
                          // Оновлюємо налаштування
                          setWhatsapp({
                            ...whatsapp,
                            access_token: result.access_token,
                            phone_number_id: result.phone_number_id || "",
                          });
                          
                          // Оновлюємо статус
                          await refreshWhatsAppStatus();
                          
                          // Оновлюємо список акаунтів
                          try {
                            const accounts = await settingsApi.getWhatsAppAccounts();
                            setWhatsappAccounts(accounts);
                          } catch (error) {
                            console.error("Failed to load WhatsApp accounts:", error);
                          }
                          
                          toast.success("WhatsApp успішно підключено!");
                        } else {
                          throw new Error("Не отримано code від Facebook");
                        }
                      } catch (error: any) {
                        console.error(error);
                        toast.error(error.message || "Не вдалося підключити WhatsApp");
                      } finally {
                        setIsConnectingWhatsApp(false);
                      }
                    }}
                  >
                    {isConnectingWhatsApp ? "Підключення..." : "Підключити через Facebook"}
                  </Button>
                )}
              </div>
              
              {/* Підказка якщо кнопка неактивна */}
              {!whatsappStatus.connected && (!facebook.app_id || !facebook.config_id || !facebook.app_secret) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Увага:</strong> Для підключення WhatsApp необхідно спочатку налаштувати <strong>Facebook App ID</strong>, <strong>Config ID</strong> та <strong>App Secret</strong> в розділі <strong>Settings → Facebook</strong>.
                    <div className="mt-2 space-y-1">
                      {!facebook.app_id && <span className="block">• Facebook App ID не вказано</span>}
                      {!facebook.config_id && <span className="block">• Config ID не вказано</span>}
                      {!facebook.app_secret && <span className="block">• App Secret не вказано</span>}
                    </div>
                  </p>
                </div>
              )}
              
              {/* Попередження про неправильний Phone Number ID */}
              {whatsapp.phone_number_id && !/^[0-9]+$/.test(whatsapp.phone_number_id) && !whatsappStatus.connected && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Помилка:</strong> Phone Number ID має містити тільки цифри. 
                    <br />
                    <span className="text-xs mt-1 block">Поле буде автоматично очищено. Для підключення через OAuth це поле не потрібно заповнювати вручну - воно отримається автоматично.</span>
                  </p>
                </div>
              )}
              
              {/* Кнопка для встроенной регистрації WhatsApp через SDK */}
              {facebook.app_id && facebook.config_id && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Встроенная регистрация WhatsApp Business
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        <strong>Рекомендований спосіб:</strong> Натисніть кнопку нижче для запуску встроенной регистрації через Facebook SDK. Після завершення ви автоматично отримаєте код авторизації та інформацію про сеанс (Phone Number ID та WABA ID).
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="bg-[#1877f2] hover:bg-[#1877f2]/90 text-white border-0"
                      disabled={isConnectingWhatsApp}
                      onClick={launchWhatsAppSignup}
                      style={{
                        backgroundColor: '#1877f2',
                        border: 0,
                        borderRadius: '4px',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        height: '40px',
                        padding: '0 24px'
                      }}
                    >
                      {isConnectingWhatsApp ? "Підключення..." : "Login with Facebook"}
                    </Button>
                  </div>
                  <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
                    <strong>Примітка:</strong> Після завершення встроенной регистрації ви отримаєте код авторизації та інформацію про сеанс автоматично. Код буде обміняно на токен доступу на бекенді.
                  </div>
                  {embeddedSignupSessionInfo.phone_number_id && (
                    <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-800">
                      <strong>Отримано:</strong> Phone Number ID: {embeddedSignupSessionInfo.phone_number_id}
                      {embeddedSignupSessionInfo.waba_id && `, WABA ID: ${embeddedSignupSessionInfo.waba_id}`}
                    </div>
                  )}
                  <div className="mt-3 p-2 bg-gray-100 rounded text-xs text-gray-700">
                    <strong>Альтернативний спосіб:</strong> Якщо ви хочете відкрити встроенную регистрацию в окремому вікні, використайте кнопку нижче.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                    onClick={() => {
                      // Просто відкриваємо URL встроенной регистрації без використання SDK
                      const onboardingURL = `https://business.facebook.com/messaging/whatsapp/onboard/?app_id=${facebook.app_id}&config_id=${facebook.config_id}&extras=${encodeURIComponent(JSON.stringify({
                        featureType: 'whatsapp_business_app_onboarding',
                        sessionInfoVersion: '3',
                        version: 'v3',
                        features: [
                          { name: 'marketing_messages_lite' },
                          { name: 'app_only_install' }
                        ]
                      }))}`;
                      
                      // Відкриваємо в новому вікні
                      window.open(onboardingURL, '_blank', 'noopener,noreferrer');
                      toast.info("Відкрито сторінку встроенной регистрації WhatsApp. Після завершення скопіюйте код авторизації та обміняйте його на токен.");
                    }}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Відкрити встроенную регистрацию в окремому вікні
                  </Button>
                </div>
              )}
              
              {/* Стара секція для ручного введення коду (залишаємо для сумісності) */}
              {facebook.app_id && facebook.config_id && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Ручне введення коду авторизації
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        <strong>Якщо ви вже маєте код:</strong> Вставте код авторизації нижче та натисніть "Обміняти код".
                      </p>
                    </div>
                  </div>
                  {/* Поле для введення коду вручну */}
                  <div className="mt-4 p-3 bg-white border border-blue-200 rounded-lg">
                    <Label htmlFor="whatsapp-auth-code" className="text-sm font-medium text-blue-900">
                      Або введіть код авторизації вручну:
                    </Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="whatsapp-auth-code"
                        type="text"
                        placeholder="Вставте код авторизації з Meta"
                        className="flex-1"
                        onPaste={async (e) => {
                          const code = e.clipboardData.getData('text').trim();
                          if (code && code.length > 10) {
                            // Автоматично обмінюємо код при вставці
                            try {
                              setIsConnectingWhatsApp(true);
                              const redirectUri = new URLSearchParams(window.location.search).get('redirect_uri') || 
                                                  `https://developers.facebook.com/es/oauth/callback/`;
                              
                              const result = await settingsApi.connectWhatsApp(
                                code,
                                facebook.app_id,
                                facebook.app_secret,
                                redirectUri
                              );
                              
                              setWhatsapp({
                                ...whatsapp,
                                access_token: result.access_token,
                                phone_number_id: result.phone_number_id || "",
                              });
                              
                              await refreshWhatsAppStatus();
                              toast.success("WhatsApp успішно підключено!");
                              
                              // Очищаємо поле
                              e.currentTarget.value = '';
                            } catch (error: any) {
                              console.error(error);
                              toast.error(error.message || "Не вдалося обміняти код на токен");
                            } finally {
                              setIsConnectingWhatsApp(false);
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const codeInput = document.getElementById('whatsapp-auth-code') as HTMLInputElement;
                          const code = codeInput?.value.trim();
                          
                          if (!code) {
                            toast.error("Введіть код авторизації");
                            return;
                          }
                          
                          if (!facebook.app_id || !facebook.app_secret) {
                            toast.error("Спочатку налаштуйте Facebook App ID та App Secret");
                            return;
                          }
                          
                          setIsConnectingWhatsApp(true);
                          try {
                            // Спробуємо отримати redirect_uri з URL або використаємо стандартний
                            const urlParams = new URLSearchParams(window.location.search);
                            const redirectUri = urlParams.get('redirect_uri') || 
                                              `https://developers.facebook.com/es/oauth/callback/`;
                            
                            const result = await settingsApi.connectWhatsApp(
                              code,
                              facebook.app_id,
                              facebook.app_secret,
                              redirectUri
                            );
                            
                            setWhatsapp({
                              ...whatsapp,
                              access_token: result.access_token,
                              phone_number_id: result.phone_number_id || "",
                            });
                            
                            await refreshWhatsAppStatus();
                            toast.success("WhatsApp успішно підключено!");
                            
                            // Очищаємо поле
                            codeInput.value = '';
                          } catch (error: any) {
                            console.error(error);
                            toast.error(error.message || "Не вдалося обміняти код на токен");
                          } finally {
                            setIsConnectingWhatsApp(false);
                          }
                        }}
                        disabled={isConnectingWhatsApp}
                      >
                        {isConnectingWhatsApp ? "Обмін..." : "Обміняти код"}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      <strong>Як знайти код:</strong> Після завершення встроенной регистрації Meta перенаправить вас на сторінку з кодом авторизації. Код буде в URL параметрі <code className="bg-gray-100 px-1 rounded">code=...</code> або відображатиметься на сторінці. Скопіюйте весь код (довгий рядок символів) та вставте його тут.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Список підключених WhatsApp акаунтів */}
              {whatsappAccounts && whatsappAccounts.length > 0 && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Підключені WhatsApp акаунти ({whatsappAccounts?.length || 0})
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Список всіх підключених телефонних номерів WhatsApp Business
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setIsLoadingWhatsAppAccounts(true);
                        try {
                          const accounts = await settingsApi.getWhatsAppAccounts();
                          setWhatsappAccounts(accounts);
                        } catch (error) {
                          console.error("Failed to refresh WhatsApp accounts:", error);
                          toast.error("Не вдалося оновити список акаунтів");
                        } finally {
                          setIsLoadingWhatsAppAccounts(false);
                        }
                      }}
                      disabled={isLoadingWhatsAppAccounts}
                    >
                      {isLoadingWhatsAppAccounts ? "Оновлення..." : "Оновити"}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {whatsappAccounts?.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between gap-4 p-3 border rounded-lg bg-white"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 mb-1">
                            {account.name || `WhatsApp ${account.phone_number_id.substring(0, 6)}...`}
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            {account.phone_number && (
                              <div>📱 {account.phone_number}</div>
                            )}
                            <div className="text-xs text-gray-500">
                              Phone Number ID: {account.phone_number_id}
                            </div>
                            {account.page_name && (
                              <div className="text-xs text-gray-500">
                                Page: {account.page_name}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
                          onClick={async () => {
                            if (confirm(`Видалити WhatsApp акаунт "${account.name || account.phone_number_id}"?`)) {
                              try {
                                await settingsApi.deleteWhatsAppAccount(account.id);
                                setWhatsappAccounts((prev) =>
                                  prev.filter((a) => a.id !== account.id)
                                );
                                toast.success("WhatsApp акаунт видалено");
                              } catch (error: any) {
                                console.error(error);
                                toast.error(error.message || "Не вдалося видалити WhatsApp акаунт");
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-access-token">Access Token</Label>
                  <Input
                    id="whatsapp-access-token"
                    type="password"
                    value={whatsapp.access_token}
                    onChange={(e) => setWhatsapp({ ...whatsapp, access_token: e.target.value })}
                    disabled={whatsappStatus.connected}
                  />
                  {whatsappStatus.connected && (
                    <p className="text-xs text-gray-500">Токен отримано автоматично через OAuth</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-phone-number-id">Phone Number ID</Label>
                  <Input
                    id="whatsapp-phone-number-id"
                    type="text"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    value={whatsapp.phone_number_id}
                    onChange={(e) => {
                      // Валідація: тільки цифри
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setWhatsapp({ ...whatsapp, phone_number_id: value });
                    }}
                    placeholder="Введіть цифровий ID (наприклад: 123456789012345)"
                    disabled={whatsappStatus.connected}
                    className={whatsapp.phone_number_id && !/^[0-9]+$/.test(whatsapp.phone_number_id) ? "border-red-500" : ""}
                  />
                  {whatsapp.phone_number_id && !/^[0-9]+$/.test(whatsapp.phone_number_id) && (
                    <p className="text-xs text-red-500">Phone Number ID має містити тільки цифри</p>
                  )}
                  {whatsappStatus.connected && (
                    <p className="text-xs text-gray-500">ID отримано автоматично через OAuth</p>
                  )}
                  {!whatsappStatus.connected && !whatsapp.phone_number_id && (
                    <p className="text-xs text-gray-500">Введіть цифровий ID (зазвичай 15 цифр) або отримайте автоматично через OAuth</p>
                  )}
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
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-template-name">Template Name (для повідомлень поза 24h)</Label>
                  <Input
                    id="whatsapp-template-name"
                    value={whatsapp.template_name || ""}
                    onChange={(e) => setWhatsapp({ ...whatsapp, template_name: e.target.value })}
                    placeholder="Назва затвердженого шаблону (наприклад: hello_world)"
                  />
                  <p className="text-xs text-gray-500">
                    Шаблон використовується для повідомлень поза 24-годинним вікном після останнього повідомлення від клієнта
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp-template-language">Template Language</Label>
                  <Input
                    id="whatsapp-template-language"
                    value={whatsapp.template_language || "en_US"}
                    onChange={(e) => setWhatsapp({ ...whatsapp, template_language: e.target.value })}
                    placeholder="en_US, uk_UA, pl_PL"
                  />
                  <p className="text-xs text-gray-500">
                    Мова шаблону (ISO 639-1 код мови + ISO 3166-1 код країни)
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                  disabled={isSavingWhatsApp || (whatsapp.phone_number_id && !/^[0-9]+$/.test(whatsapp.phone_number_id))}
                  onClick={async () => {
                    // Валідація Phone Number ID перед збереженням
                    if (whatsapp.phone_number_id && !/^[0-9]+$/.test(whatsapp.phone_number_id)) {
                      toast.error("Phone Number ID має містити тільки цифри. Перевірте введене значення.");
                      return;
                    }
                    
                    setIsSavingWhatsApp(true);
                    try {
                      // Очищаємо phone_number_id якщо він не є цифровим
                      const cleanPhoneNumberId = whatsapp.phone_number_id && /^[0-9]+$/.test(whatsapp.phone_number_id) 
                        ? whatsapp.phone_number_id 
                        : "";
                      
                      await settingsApi.updateWhatsAppConfig({
                        ...whatsapp,
                        phone_number_id: cleanPhoneNumberId
                      });
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
              {/* Статус підключення */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${instagramStatus.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div>
                    <p className="font-medium">
                      {instagramStatus.connected ? 'Підключено' : 'Не підключено'}
                    </p>
                    {instagramStatus.connected && (
                      <p className="text-sm text-gray-500">
                        {instagramStatus.has_page_id ? 'Page ID налаштовано' : 'Page ID не налаштовано'}
                      </p>
                    )}
                  </div>
                </div>
                {instagramStatus.connected ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await settingsApi.disconnectInstagram();
                        setInstagram({ 
                          ...instagram, 
                          access_token: "", 
                          page_id: "",
                          page_name: "",
                          business_id: ""
                        });
                        await refreshInstagramStatus();
                        toast.success("Instagram відключено");
                      } catch (error) {
                        console.error(error);
                        toast.error("Не вдалося відключити Instagram");
                      }
                    }}
                  >
                    Відключити
                  </Button>
                ) : (
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
                )}
              </div>
              
              {/* Інформація про сторінку */}
              {instagramStatus.connected && instagram.page_id && (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2 border">
                  <p className="text-sm">
                    <span className="font-medium">Сторінка:</span> {instagram.page_name || 'Невідомо'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Page ID:</span> {instagram.page_id}
                  </p>
                  {instagram.business_id && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-medium">Instagram Business ID:</span> {instagram.business_id}
                    </p>
                  )}
                </div>
              )}

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
                    value={(instagram.access_token === true || (typeof instagram.access_token === "string" && instagram.access_token.length > 0)) ? "••••••••••••" : ""}
                    onChange={(e) => {
                      // Не дозволяємо редагувати через UI, тільки через OAuth
                      if (e.target.value === "") {
                        setInstagram({ ...instagram, access_token: "" });
                      }
                    }}
                    placeholder={(instagram.access_token === true || (typeof instagram.access_token === "string" && instagram.access_token.length > 0)) ? "Встановлено через OAuth" : "Встановлюється через OAuth"}
                    disabled={instagram.access_token === true || (typeof instagram.access_token === "string" && instagram.access_token.length > 0)}
                  />
                  {(instagram.access_token === true || (typeof instagram.access_token === "string" && instagram.access_token.length > 0)) && (
                    <p className="text-xs text-muted-foreground">
                      Access Token встановлено через OAuth. Для зміни використайте кнопку "Переподключити"
                    </p>
                  )}
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
                <div className="space-y-2">
                  <Label htmlFor="instagram-page-id">Page ID</Label>
                  <Input
                    id="instagram-page-id"
                    value={instagram.page_id}
                    onChange={(e) => setInstagram({ ...instagram, page_id: e.target.value })}
                    placeholder="Встановлюється автоматично через OAuth або введіть вручну"
                    disabled={!!instagram.page_id && (instagram.access_token === true || (typeof instagram.access_token === "string" && instagram.access_token.length > 0))}
                  />
                  {instagram.page_id && (instagram.access_token === true || (typeof instagram.access_token === "string" && instagram.access_token.length > 0)) && (
                    <p className="text-xs text-muted-foreground">
                      Page ID встановлено автоматично через OAuth
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                  disabled={isSavingInstagram}
                  onClick={async () => {
                    setIsSavingInstagram(true);
                    try {
                      await settingsApi.updateInstagramConfig(instagram);
                      await refreshInstagramStatus();
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
                <div className="space-y-2">
                  <Label htmlFor="facebook-config-id">Config ID (Facebook Login for Business)</Label>
                  <Input
                    id="facebook-config-id"
                    value={facebook.config_id || ""}
                    onChange={(e) => setFacebook({ ...facebook, config_id: e.target.value })}
                    placeholder="1423802986069102"
                  />
                  <p className="text-xs text-gray-500">
                    ID конфігурації для Facebook Login for Business (необхідно для підключення WhatsApp)
                  </p>
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

        {/* Przelewy24 Tab */}
        <TabsContent value="przelewy24" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Przelewy24 API налаштування</CardTitle>
              <p className="text-sm text-gray-500 mt-2">
                Налаштування інтеграції з польською платіжною системою Przelewy24
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="p24-sandbox"
                    checked={przelewy24.sandbox}
                    onCheckedChange={(checked) => setPrzelewy24({ ...przelewy24, sandbox: checked as boolean })}
                  />
                  <Label htmlFor="p24-sandbox" className="font-medium">
                    Sandbox режим (тестування)
                  </Label>
                </div>
                <p className="text-sm text-gray-500 ml-6">
                  Використовувати тестове середовище sandbox.przelewy24.pl
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p24-merchant-id">Merchant ID</Label>
                  <Input
                    id="p24-merchant-id"
                    type="text"
                    placeholder="Ваш Merchant ID"
                    value={przelewy24.merchant_id}
                    onChange={(e) => setPrzelewy24({ ...przelewy24, merchant_id: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    ID магазину з панелі Przelewy24
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p24-pos-id">POS ID</Label>
                  <Input
                    id="p24-pos-id"
                    type="text"
                    placeholder="Ваш POS ID (зазвичай = Merchant ID)"
                    value={przelewy24.pos_id}
                    onChange={(e) => setPrzelewy24({ ...przelewy24, pos_id: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    ID точки продажу (за замовчуванням = Merchant ID)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p24-crc">CRC Key</Label>
                  <Input
                    id="p24-crc"
                    type="password"
                    placeholder="Ваш CRC ключ"
                    value={przelewy24.crc}
                    onChange={(e) => setPrzelewy24({ ...przelewy24, crc: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    Ключ CRC для підпису транзакцій (Moje dane → Dane API)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p24-api-key">API Key (Secret ID)</Label>
                  <Input
                    id="p24-api-key"
                    type="password"
                    placeholder="Ваш API ключ"
                    value={przelewy24.api_key}
                    onChange={(e) => setPrzelewy24({ ...przelewy24, api_key: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    Ключ API для авторизації (Moje dane → Klucz do raportów)
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                <p className="font-medium mb-2">📋 Як отримати дані:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Увійдіть в <a href="https://panel.przelewy24.pl" target="_blank" rel="noopener noreferrer" className="underline">panel.przelewy24.pl</a></li>
                  <li>Перейдіть в "Moje konto" → "Moje dane" → "Dane API i konfiguracja"</li>
                  <li>Скопіюйте Merchant ID, CRC та API Key</li>
                  <li>Для тестування використовуйте <a href="https://sandbox.przelewy24.pl" target="_blank" rel="noopener noreferrer" className="underline">sandbox.przelewy24.pl</a></li>
                </ol>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                  disabled={isSavingPrzelewy24}
                  onClick={async () => {
                    setIsSavingPrzelewy24(true);
                    try {
                      // TODO: Implement API call when backend endpoint is ready
                      // await settingsApi.updatePrzelewy24Config(przelewy24);
                      toast.success("Przelewy24 налаштування збережено");
                    } catch (error) {
                      console.error(error);
                      toast.error("Не вдалося зберегти Przelewy24 налаштування");
                    } finally {
                      setIsSavingPrzelewy24(false);
                    }
                  }}
                >
                  {isSavingPrzelewy24 ? "Збереження..." : "Зберегти Przelewy24"}
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
              <p className="text-sm text-gray-500 mt-2">
                Налаштування інтеграції з InPost для автоматичного створення та відстеження відправлень
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="inpost-enabled"
                    checked={inpost.is_enabled || false}
                    onCheckedChange={(checked) => setInpost({ ...inpost, is_enabled: checked as boolean })}
                  />
                  <Label htmlFor="inpost-enabled" className="font-medium">
                    Увімкнути InPost інтеграцію
                  </Label>
                </div>
                <p className="text-sm text-gray-500 ml-6">
                  Дозволити створення та відстеження відправлень через InPost API
                </p>
              </div>

              {/* API Configuration */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold">API налаштування</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="inpost-api-key">
                    Production API Key (Organization Token)
                  </Label>
                  <Input
                    id="inpost-api-key"
                    type="password"
                    placeholder="Введіть ваш InPost API ключ"
                    value={inpost.api_key || ""}
                    onChange={(e) => setInpost({ ...inpost, api_key: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    Отримайте ключ у вашому InPost Organization панелі
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="inpost-sandbox"
                      checked={inpost.sandbox_mode || false}
                      onCheckedChange={(checked) => setInpost({ ...inpost, sandbox_mode: checked as boolean })}
                    />
                    <Label htmlFor="inpost-sandbox">
                      Використовувати Sandbox режим (тестування)
                    </Label>
                  </div>
                </div>

                {inpost.sandbox_mode && (
                  <div className="space-y-2 ml-6">
                    <Label htmlFor="inpost-sandbox-key">
                      Sandbox API Key
                    </Label>
                    <Input
                      id="inpost-sandbox-key"
                      type="password"
                      placeholder="Введіть ваш Sandbox API ключ"
                      value={inpost.sandbox_api_key || ""}
                      onChange={(e) => setInpost({ ...inpost, sandbox_api_key: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Webhook Configuration */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold">Webhook налаштування</h3>
                <p className="text-sm text-gray-500">
                  Налаштуйте webhook для отримання оновлень статусу відправлень в реальному часі
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="inpost-webhook-url">
                    Webhook URL
                  </Label>
                  <Input
                    id="inpost-webhook-url"
                    type="url"
                    placeholder="https://your-domain.com/api/v1/postal-services/inpost/webhook"
                    value={inpost.webhook_url || ""}
                    onChange={(e) => setInpost({ ...inpost, webhook_url: e.target.value })}
                    disabled
                  />
                  <p className="text-xs text-gray-500">
                    Використовуйте цей URL у налаштуваннях InPost Organization
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inpost-webhook-secret">
                    Webhook Secret
                  </Label>
                  <Input
                    id="inpost-webhook-secret"
                    type="password"
                    placeholder="Секретний ключ для перевірки webhook"
                    value={inpost.webhook_secret || ""}
                    onChange={(e) => setInpost({ ...inpost, webhook_secret: e.target.value })}
                  />
                </div>
              </div>

              {/* Default Sender Information */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold">Відправник за замовчуванням</h3>
                <p className="text-sm text-gray-500">
                  Ці дані будуть використані як відправник для всіх відправлень
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="inpost-sender-name">
                    Ім'я відправника
                  </Label>
                  <Input
                    id="inpost-sender-name"
                    type="text"
                    placeholder="Назва компанії або ім'я"
                    value={inpost.default_sender_name || ""}
                    onChange={(e) => setInpost({ ...inpost, default_sender_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inpost-sender-email">
                    Email відправника
                  </Label>
                  <Input
                    id="inpost-sender-email"
                    type="email"
                    placeholder="email@example.com"
                    value={inpost.default_sender_email || ""}
                    onChange={(e) => setInpost({ ...inpost, default_sender_email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inpost-sender-phone">
                    Телефон відправника
                  </Label>
                  <Input
                    id="inpost-sender-phone"
                    type="tel"
                    placeholder="+48123456789"
                    value={inpost.default_sender_phone || ""}
                    onChange={(e) => setInpost({ ...inpost, default_sender_phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end border-t pt-4">
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
                  {isSavingInPost ? "Збереження..." : "Зберегти InPost налаштування"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Integration Tab */}
        <TabsContent value="ai" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>AI RAG Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingAI ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="ai-enabled"
                        checked={aiSettings?.is_enabled || false}
                        onCheckedChange={(checked) => {
                          if (aiSettings) {
                            setAiSettings({ ...aiSettings, is_enabled: checked as boolean });
                          }
                        }}
                      />
                      <Label htmlFor="ai-enabled" className="font-medium">
                        Увімкнути AI інтеграцію
                      </Label>
                    </div>
                    <p className="text-sm text-gray-500 ml-6">
                      Дозволити AI автоматично відповідати на повідомлення клієнтів
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rag-api-url">RAG API URL</Label>
                    <Input
                      id="rag-api-url"
                      type="url"
                      value={aiSettings?.rag_api_url || ""}
                      onChange={(e) => {
                        if (aiSettings) {
                          setAiSettings({ ...aiSettings, rag_api_url: e.target.value });
                        } else {
                          setAiSettings({
                            id: 0,
                            rag_api_url: e.target.value,
                            rag_api_key: "",
                            rag_token: "adme_rag_secret_987654321",
                            is_enabled: false,
                            trigger_delay_seconds: 10,
                            active_channels: [],
                            webhook_secret: "",
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                          });
                        }
                      }}
                      placeholder="https://api.adme-ai.com/v1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rag-api-key">RAG API Key</Label>
                    <Input
                      id="rag-api-key"
                      type="password"
                      value={aiSettings?.rag_api_key || ""}
                      onChange={(e) => {
                        if (aiSettings) {
                          setAiSettings({ ...aiSettings, rag_api_key: e.target.value });
                        } else {
                          setAiSettings({
                            id: 0,
                            rag_api_url: "https://api.adme-ai.com/v1",
                            rag_api_key: e.target.value,
                            rag_token: "adme_rag_secret_987654321",
                            is_enabled: false,
                            trigger_delay_seconds: 10,
                            active_channels: [],
                            webhook_secret: "",
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                          });
                        }
                      }}
                      placeholder="Введіть API ключ"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rag-token">RAG Token (X-RAG-TOKEN)</Label>
                    <Input
                      id="rag-token"
                      type="text"
                      value={aiSettings?.rag_token || ""}
                      onChange={(e) => {
                        if (aiSettings) {
                          setAiSettings({ ...aiSettings, rag_token: e.target.value });
                        } else {
                          setAiSettings({
                            id: 0,
                            rag_api_url: "https://api.adme-ai.com/v1",
                            rag_api_key: "",
                            rag_token: e.target.value,
                            is_enabled: false,
                            trigger_delay_seconds: 10,
                            active_channels: [],
                            webhook_secret: "",
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                          });
                        }
                      }}
                      placeholder="adme_rag_secret_987654321"
                    />
                    <p className="text-sm text-gray-500">
                      Токен для авторизації вхідних запитів від RAG. Використовується в заголовку X-RAG-TOKEN.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trigger-delay">Затримка перед відповіддю (секунди)</Label>
                    <Input
                      id="trigger-delay"
                      type="number"
                      min="0"
                      max="300"
                      value={aiSettings?.trigger_delay_seconds || 10}
                      onChange={(e) => {
                        if (aiSettings) {
                          setAiSettings({ ...aiSettings, trigger_delay_seconds: parseInt(e.target.value) || 10 });
                        }
                      }}
                    />
                    <p className="text-sm text-gray-500">
                      Час очікування перед відправкою запиту до AI (щоб дозволити менеджеру втрутитися)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Активні канали</Label>
                    <div className="space-y-2">
                      {['telegram', 'whatsapp', 'email', 'instagram', 'facebook'].map((channel) => (
                        <div key={channel} className="flex items-center gap-2">
                          <Checkbox
                            id={`channel-${channel}`}
                            checked={aiSettings?.active_channels?.includes(channel) || false}
                            onCheckedChange={(checked) => {
                              if (aiSettings) {
                                const channels = aiSettings.active_channels || [];
                                if (checked) {
                                  setAiSettings({ ...aiSettings, active_channels: [...channels, channel] });
                                } else {
                                  setAiSettings({ ...aiSettings, active_channels: channels.filter(c => c !== channel) });
                                }
                              }
                            }}
                          />
                          <Label htmlFor={`channel-${channel}`} className="capitalize">
                            {channel}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {aiSettings?.webhook_secret && (
                    <div className="space-y-2">
                      <Label>Webhook Secret</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={aiSettings.webhook_secret}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const { webhook_secret } = await settingsApi.getWebhookSecret();
                              if (aiSettings) {
                                setAiSettings({ ...aiSettings, webhook_secret });
                              }
                              toast.success("Webhook secret оновлено");
                            } catch (error) {
                              toast.error("Не вдалося отримати webhook secret");
                            }
                          }}
                        >
                          Оновити
                        </Button>
                      </div>
                      <p className="text-sm text-gray-500">
                        Використовується для верифікації webhook запитів від RAG сервісу
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button
                      type="button"
                      className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
                      disabled={isSavingAI || !aiSettings}
                      onClick={async () => {
                        if (!aiSettings) return;
                        setIsSavingAI(true);
                        try {
                          const update: AISettingsUpdate = {
                            rag_api_url: aiSettings.rag_api_url,
                            rag_api_key: aiSettings.rag_api_key,
                            rag_token: aiSettings.rag_token,
                            is_enabled: aiSettings.is_enabled,
                            trigger_delay_seconds: aiSettings.trigger_delay_seconds,
                            active_channels: aiSettings.active_channels,
                          };
                          const updated = await settingsApi.updateAISettings(update);
                          setAiSettings(updated);
                          toast.success("AI налаштування збережено");
                        } catch (error) {
                          console.error(error);
                          toast.error("Не вдалося зберегти AI налаштування");
                        } finally {
                          setIsSavingAI(false);
                        }
                      }}
                    >
                      {isSavingAI ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Збереження...
                        </>
                      ) : (
                        "Зберегти налаштування"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger Zone Tab */}
        <TabsContent value="danger" className="mt-0">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Небезпечна зона
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-4">
                <div>
                  <h3 className="font-semibold text-red-800">Видалити всі переписки</h3>
                  <p className="text-sm text-red-600 mt-1">
                    Видаляє <strong>всі</strong> розмови та повідомлення з усіх каналів: Email, Telegram, WhatsApp, Instagram, Facebook. 
                    Ця дія <strong>незворотна</strong>. Всі вкладення також будуть видалені.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delete-confirm" className="text-sm text-red-700">
                    Введіть <code className="px-1 py-0.5 bg-red-100 rounded text-xs font-bold">ВИДАЛИТИ</code> для підтвердження:
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmText}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDeleteConfirmText(e.target.value)}
                    placeholder="ВИДАЛИТИ"
                    className="max-w-xs border-red-300 focus:border-red-500"
                  />
                </div>
                <Button
                  variant="destructive"
                  disabled={deleteConfirmText !== "ВИДАЛИТИ" || isDeletingAll}
                  onClick={async () => {
                    setIsDeletingAll(true);
                    try {
                      const result = await communicationsApi.deleteAllConversations();
                      toast.success(
                        `Видалено: ${result.deleted.conversations} переписок, ${result.deleted.messages} повідомлень, ${result.deleted.attachments} вкладень`
                      );
                      setDeleteConfirmText("");
                    } catch (error) {
                      console.error(error);
                      toast.error("Не вдалося видалити переписки");
                    } finally {
                      setIsDeletingAll(false);
                    }
                  }}
                >
                  {isDeletingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Видалення...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Видалити всі переписки
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}


