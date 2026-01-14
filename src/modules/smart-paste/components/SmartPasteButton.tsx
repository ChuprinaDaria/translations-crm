import { useState } from "react";
import { Clipboard, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { toast } from "sonner";
import { smartPasteApi } from "../api";

interface SmartPasteButtonProps {
  onParsed: (data: ParsedOrderData) => void;
  className?: string;
}

export interface ParsedOrderData {
  client_name?: string;
  event_date?: string;
  event_location?: string;
  event_time?: string;
  coordinator_name?: string;
  coordinator_phone?: string;
  client_email?: string;
  client_phone?: string;
  event_format?: string;
  people_count?: number;
  language?: string;
  payment_method?: string;
  notes?: string;
}

export function SmartPasteButton({ onParsed, className }: SmartPasteButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePaste = async () => {
    try {
      // Отримуємо текст з буфера обміну
      const text = await navigator.clipboard.readText();
      
      if (!text.trim()) {
        toast.error("Буфер обміну порожній");
        return;
      }

      setIsLoading(true);

      // Відправляємо на парсинг
      const parsed = await smartPasteApi.parseOrder(text);
      
      onParsed(parsed);
      toast.success("Дані успішно розпарсені!");
    } catch (error: any) {
      console.error("Paste error:", error);
      toast.error(error.message || "Не вдалося розпарсити текст");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePaste}
      disabled={isLoading}
      variant="outline"
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Парсинг...
        </>
      ) : (
        <>
          <Clipboard className="w-4 h-4 mr-2" />
          Вставити з буфера
        </>
      )}
    </Button>
  );
}

