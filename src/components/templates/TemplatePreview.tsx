import React, { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TemplatePreviewProps {
  design: any;
  templateName?: string;
}

// Sample data для preview
const sampleKPData = {
  kp: {
    title: "Комерційна пропозиція №123",
    client_name: 'ТОВ "Приклад"',
    client_contact: "+380 50 123 45 67",
    people_count: 50,
    notes: "Прохання врахувати алергію на горіхи",
  },
  items: [
    {
      name: "Канапе з лососем",
      category_name: "Холодні закуски",
      subcategory_name: "Канапе",
      weight: "40 г",
      quantity: 50,
      price: "45.00 грн",
      total: "2250.00 грн",
      photo_src: null,
      description: "Свіжий лосось з крем-сиром на білому хлібі",
    },
    {
      name: "Салат Цезар",
      category_name: "Салати",
      subcategory_name: "Класичні салати",
      weight: "250 г",
      quantity: 10,
      price: "180.00 грн",
      total: "1800.00 грн",
      photo_src: null,
      description: "Курка, листя салату, помідори черрі, пармезан",
    },
    {
      name: "Котлета по-київськи",
      category_name: "Гарячі страви",
      subcategory_name: "М'ясні страви",
      weight: "250 г",
      quantity: 50,
      price: "320.00 грн",
      total: "16000.00 грн",
      photo_src: null,
      description: "Куряча грудка з вершковим маслом та часником",
    },
    {
      name: "Картопля по-селянськи",
      category_name: "Гарнір",
      subcategory_name: null,
      weight: "200 г",
      quantity: 50,
      price: "60.00 грн",
      total: "3000.00 грн",
      photo_src: null,
      description: null,
    },
    {
      name: "Тірамісу",
      category_name: "Десерти",
      subcategory_name: "Італійські десерти",
      weight: "120 г",
      quantity: 50,
      price: "95.00 грн",
      total: "4750.00 грн",
      photo_src: null,
      description: "Класичний італійський десерт з маскарпоне",
    },
    {
      name: "Апельсиновий сік",
      category_name: "Напої",
      subcategory_name: "Соки",
      weight: "250 мл",
      quantity: 50,
      price: "35.00 грн",
      total: "1750.00 грн",
      photo_src: null,
      description: "Свіжовичавлений",
    },
  ],
  food_total: "29550.00 грн",
  equipment_total: "2000.00 грн",
  service_total: "3000.00 грн",
  transport_total: "500.00 грн",
  total_weight: "12.5 кг",
  weight_per_person: "250 г",
  total_items: 6,
  company_name: "Дзиґа Кейтерінґ",
  created_date: "03.12.2025",
  event_date: "20.12.2025",
};

export function TemplatePreview({
  design,
  templateName = "Шаблон",
}: TemplatePreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Debounced генерація preview
  useEffect(() => {
    if (!design) return; // Не генеруємо якщо немає design
    
    const timer = setTimeout(() => {
      generatePreview();
    }, 1000); // 1 секунда затримки

    return () => clearTimeout(timer);
  }, [design]);

  const generatePreview = async () => {
    if (!design) return; // Не генеруємо якщо немає design
    
    setIsGenerating(true);
    try {
      const response = await fetch("/api/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design,
          sample_data: sampleKPData,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate preview");
      }

      const blob = await response.blob();
      
      // Очищаємо старий URL якщо є
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error("Preview generation error:", error);
      toast.error("Помилка генерації preview");
    } finally {
      setIsGenerating(false);
    }
  };

  // Cleanup при unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  return (
    <div className="h-full flex flex-col">
      <div className="bg-gray-50 px-4 py-3 border-b">
        <h3 className="text-sm font-semibold text-gray-700">Preview</h3>
        <p className="text-xs text-gray-500">Попередній перегляд PDF</p>
      </div>

      <div className="flex-1 relative bg-gray-100 overflow-auto">
        {isGenerating && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              <span className="text-sm text-gray-600">Оновлення preview...</span>
            </div>
          </div>
        )}

        {pdfUrl ? (
          <div className="w-full h-full flex items-start justify-center py-4">
            <div className="w-[900px] max-w-full h-[calc(100vh-180px)] bg-white shadow-lg border">
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title="Template Preview"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-sm text-gray-500">Налаштуйте шаблон →</p>
              <p className="text-xs text-gray-400 mt-2">
                Preview з'явиться автоматично
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

