/**
 * WhatsApp Connect Dialog - діалог для підключення WhatsApp через Matrix Bridge
 */
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Loader2, QrCode, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { settingsApi } from "../lib/api";

interface WhatsAppConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function WhatsAppConnectDialog({ open, onOpenChange, userId }: WhatsAppConnectDialogProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !isConnected && !qrCode) {
      // Автоматично генеруємо QR-код при відкритті діалогу
      handleConnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    setQrCode(null);
    setQrUrl(null);

    try {
      const response = await settingsApi.connectUserWhatsApp(userId);
      
      if (response.qr_code_data) {
        // Якщо це base64, додаємо префікс data:image
        if (response.qr_code_type === "base64") {
          setQrCode(`data:image/png;base64,${response.qr_code_data}`);
        } else {
          setQrCode(response.qr_code_data);
        }
        setQrUrl(null);
      } else if (response.qr_code) {
        // Fallback для старого формату
        setQrCode(response.qr_code);
        setQrUrl(response.qr_url || null);
      } else {
        setError("QR-код не отримано від сервера");
      }
    } catch (error: any) {
      console.error("Failed to connect WhatsApp:", error);
      const errorMessage = error.response?.data?.detail || error.message || "Не вдалося підключити WhatsApp";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    handleConnect();
  };

  const handleClose = () => {
    setQrCode(null);
    setQrUrl(null);
    setError(null);
    setIsConnected(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Підключити WhatsApp</DialogTitle>
          <DialogDescription>
            Відскануйте QR-код в WhatsApp на телефоні для підключення
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF5A00] mb-4" />
              <p className="text-sm text-gray-500">Генерація QR-коду...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-8">
              <XCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Спробувати ще раз
              </Button>
            </div>
          )}

          {qrCode && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 mb-4">
                {qrUrl ? (
                  <img 
                    src={qrUrl} 
                    alt="WhatsApp QR Code" 
                    className="w-64 h-64"
                  />
                ) : qrCode.startsWith("data:image") ? (
                  <img 
                    src={qrCode} 
                    alt="WhatsApp QR Code" 
                    className="w-64 h-64"
                  />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center bg-gray-100 rounded">
                    <QrCode className="w-32 h-32 text-gray-400" />
                    <p className="text-xs text-gray-500 mt-2">QR-код: {qrCode.substring(0, 50)}...</p>
                  </div>
                )}
              </div>
              
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Інструкції:</p>
                <ol className="text-xs text-gray-600 space-y-1 text-left list-decimal list-inside">
                  <li>Відкрийте WhatsApp на телефоні</li>
                  <li>Перейдіть в Menu → Settings → Linked devices</li>
                  <li>Натисніть "Link a device"</li>
                  <li>Відскануйте QR-код на екрані</li>
                </ol>
              </div>

              <div className="flex gap-2 mt-4">
                <Button onClick={handleRefresh} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Оновити QR-код
                </Button>
                <Button onClick={handleClose} variant="outline" size="sm">
                  Закрити
                </Button>
              </div>
            </div>
          )}

          {isConnected && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
              <p className="text-sm font-medium text-green-600 mb-2">WhatsApp успішно підключено!</p>
              <p className="text-xs text-gray-500 text-center">
                Bridge автоматично створить portal rooms для всіх ваших WhatsApp чатів
              </p>
              <Button onClick={handleClose} className="mt-4" size="sm">
                Готово
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

