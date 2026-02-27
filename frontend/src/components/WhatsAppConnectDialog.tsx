/**
 * WhatsApp Connect Dialog - діалог для підключення WhatsApp через Matrix Bridge.
 * POST /matrix-login starts the process, then polls GET /matrix-login/qr every 2s.
 */
import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { settingsApi } from "../lib/api";

interface WhatsAppConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function WhatsAppConnectDialog({ open, onOpenChange }: WhatsAppConnectDialogProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  useEffect(() => {
    if (open && !isConnected && !qrCode) {
      handleConnect();
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    setQrCode(null);
    stopPolling();

    try {
      // Start login process (returns immediately)
      const response = await settingsApi.startWhatsAppLogin();

      if (response.status === "error") {
        setError(response.detail || "Не вдалося запустити процес підключення");
        setIsLoading(false);
        return;
      }

      // Poll for QR code every 2s, up to 30s
      let attempts = 0;
      const maxAttempts = 15; // 15 * 2s = 30s

      pollingRef.current = setInterval(async () => {
        attempts++;
        try {
          const qr = await settingsApi.pollWhatsAppLoginQr();

          if (qr.status === "qr_ready" && qr.qr_code_data) {
            stopPolling();
            setQrCode(`data:image/png;base64,${qr.qr_code_data}`);
            setIsLoading(false);
          } else if (qr.status === "error") {
            stopPolling();
            setError(qr.detail || "Помилка отримання QR-коду");
            setIsLoading(false);
          } else if (attempts >= maxAttempts) {
            stopPolling();
            setError("Таймаут очікування QR-коду від bridge");
            setIsLoading(false);
          }
        } catch {
          stopPolling();
          setError("Помилка зв'язку з сервером");
          setIsLoading(false);
        }
      }, 2000);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || "Не вдалося підключити WhatsApp";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    stopPolling();
    setQrCode(null);
    setError(null);
    setIsConnected(false);
    setIsLoading(false);
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
              <p className="text-xs text-gray-400 mt-1">Це може зайняти до 30 секунд</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <XCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <Button onClick={handleConnect} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Спробувати ще раз
              </Button>
            </div>
          )}

          {qrCode && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 mb-4">
                <img
                  src={qrCode}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64"
                />
              </div>

              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Інструкції:</p>
                <ol className="text-xs text-gray-600 space-y-1 text-left list-decimal list-inside">
                  <li>Відкрийте WhatsApp на телефоні</li>
                  <li>Перейдіть в Settings → Linked Devices</li>
                  <li>Натисніть "Link a Device"</li>
                  <li>Відскануйте QR-код на екрані</li>
                </ol>
              </div>

              <div className="flex gap-2 mt-4">
                <Button onClick={handleConnect} variant="outline" size="sm">
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
                Повідомлення з WhatsApp автоматично з'являться в Inbox
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
