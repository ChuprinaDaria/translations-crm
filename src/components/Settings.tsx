import React, { useEffect, useState, ChangeEvent } from "react";
import { UploadCloud, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { settingsApi, getImageUrl, type BrandingSettings } from "../lib/api";

export function Settings() {
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const data = await settingsApi.getBranding();
        setBranding(data);
      } catch (error) {
        console.error(error);
      }
    };

    loadBranding();
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
    </div>
  );
}


