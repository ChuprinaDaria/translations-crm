import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TemplatePreviewProps {
  design: any;
  templateName?: string;
}

// Sample data для preview - розширений список з усіма типами страв
const sampleKPData = {
  kp: {
    title: "Комерційна пропозиція №123",
    client_name: 'ТОВ "Приклад"',
    client_contact: "+380 50 123 45 67",
    client_phone: "+380 68 393 57 24",
    client_email: "client@example.com",
    event_format: "Фуршет 13:30-14:30",
    coordinator_name: "Катерина",
    coordinator_phone: "093 968 99 36",
    event_location: "м. Київ, Лаврська 27",
    event_time: "13:30-14:30",
    people_count: 50,
    notes: "Прохання врахувати алергію на горіхи",
  },
  items: [
    // Соуси
    {
      name: "Соус тартар",
      category_name: "Соуси",
      subcategory_name: null,
      weight: "50 г",
      quantity: 160,
      price: "35.00 грн",
      total: "5600.00 грн",
      photo_src: null,
      description: null,
    },
    {
      name: "Соус каррі",
      category_name: "Соуси",
      subcategory_name: null,
      weight: "50 г",
      quantity: 160,
      price: "35.00 грн",
      total: "5600.00 грн",
      photo_src: null,
      description: null,
    },
    // Салати
    {
      name: "Салат із запеченим буряком та телятиною",
      category_name: "Салати",
      subcategory_name: null,
      weight: "75 г",
      quantity: 12,
      price: "144.00 грн",
      total: "1728.00 грн",
      photo_src: null,
      description: "Мікс салату, телятина, соус манго чилі, яблуко",
    },
    {
      name: "Салат із запеченим буряком та сиром Горгонзола",
      category_name: "Салати",
      subcategory_name: null,
      weight: "75 г",
      quantity: 9,
      price: "155.00 грн",
      total: "1395.00 грн",
      photo_src: null,
      description: null,
    },
    {
      name: 'Салат "Веган"',
      category_name: "Салати",
      subcategory_name: null,
      weight: "75 г",
      quantity: 1,
      price: "115.00 грн",
      total: "115.00 грн",
      photo_src: null,
      description: "Помідор рожевий, квасоля стручкова, салат Айзберг, кіноа",
    },
    // Канапе
    {
      name: "Канапе з сиром, шинкою та гілочкою кропу",
      category_name: "Канапе",
      subcategory_name: null,
      weight: "10 г",
      quantity: 1,
      price: "55.00 грн",
      total: "55.00 грн",
      photo_src: null,
      description: null,
    },
    // Брускети
    {
      name: "Брускета з курячим філе та карамелізованим яблуком",
      category_name: "Брускети",
      subcategory_name: null,
      weight: "55 г",
      quantity: 1,
      price: "72.00 грн",
      total: "72.00 грн",
      photo_src: null,
      description: null,
    },
    // Тарталетки
    {
      name: "Кіш-лорен з куркою та грибами у тарталетці",
      category_name: "Тарталетки",
      subcategory_name: null,
      weight: "45 г",
      quantity: 1,
      price: "81.00 грн",
      total: "81.00 грн",
      photo_src: null,
      description: null,
    },
    // Профітролі
    {
      name: "Профітроль з буряковим лососем та свіжим огірком",
      category_name: "Профітролі",
      subcategory_name: null,
      weight: "40 г",
      quantity: 1,
      price: "58.00 грн",
      total: "58.00 грн",
      photo_src: null,
      description: null,
    },
    {
      name: "Профітроль з качиною грудкою, яблучним чатні та солодким соусом чілі",
      category_name: "Профітролі",
      subcategory_name: null,
      weight: "45 г",
      quantity: 1,
      price: "76.00 грн",
      total: "76.00 грн",
      photo_src: null,
      description: null,
    },
    // Шпажки
    {
      name: "Шпажка з сиром Ементаль та виноградом",
      category_name: "Шпажки",
      subcategory_name: null,
      weight: "20 г",
      quantity: 1,
      price: "66.00 грн",
      total: "66.00 грн",
      photo_src: null,
      description: null,
    },
    // Брошети
    {
      name: "Брошети курячі з Діжонською гірчицею",
      category_name: "Брошети",
      subcategory_name: null,
      weight: "150 г",
      quantity: 17,
      price: "226.00 грн",
      total: "3842.00 грн",
      photo_src: null,
      description: null,
    },
    {
      name: "Брошети зі свинячого ошийка в маринаді з чебрецю та соусу Ткемалі",
      category_name: "Брошети",
      subcategory_name: null,
      weight: "100 г",
      quantity: 13,
      price: "228.00 грн",
      total: "2964.00 грн",
      photo_src: null,
      description: null,
    },
    // Теріяки
    {
      name: "Теріяки курка з ананасом",
      category_name: "Теріяки",
      subcategory_name: null,
      weight: "250 г",
      quantity: 13,
      price: "393.00 грн",
      total: "5109.00 грн",
      photo_src: null,
      description: "Ананас свіжий, курка, теріяки соус, кунжут",
    },
    // Міні-шашлики
    {
      name: "Міні-шашличок з курки з базиліком та лаймом",
      category_name: "Міні-шашлики",
      subcategory_name: null,
      weight: "100 г",
      quantity: 13,
      price: "207.00 грн",
      total: "2691.00 грн",
      photo_src: null,
      description: null,
    },
    // Гарячі страви
    {
      name: "Філе свинини у вишневому соусі",
      category_name: "Гарячі страви",
      subcategory_name: null,
      weight: "100 г",
      quantity: 1,
      price: "385.00 грн",
      total: "385.00 грн",
      photo_src: null,
      description: null,
    },
    // Роли
    {
      name: "Рол з філе скумбрії з скибочками томату в листі норі",
      category_name: "Роли",
      subcategory_name: null,
      weight: "100 г",
      quantity: 13,
      price: "279.00 грн",
      total: "3627.00 грн",
      photo_src: null,
      description: null,
    },
    // Гарніри
    {
      name: "Капуста цвітна в паніровці обсмажена",
      category_name: "Гарніри",
      subcategory_name: null,
      weight: "200 г",
      quantity: 13,
      price: "186.00 грн",
      total: "2418.00 грн",
      photo_src: null,
      description: null,
    },
  ],
  food_total: "36882.00 грн",
  equipment_total: "2000.00 грн",
  service_total: "3000.00 грн",
  transport_total: "500.00 грн",
  total_weight: "25.3 кг",
  weight_per_person: "506 г",
  total_items: 18,
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

  // Серіалізований design для порівняння змін
  const designJson = useMemo(() => {
    if (!design) return '';
    // Виключаємо File об'єкти з серіалізації (вони окремо обробляються)
    const { logo_image, header_image, background_image, ...rest } = design;
    return JSON.stringify({
      ...rest,
      // Для файлів використовуємо тільки тип (File або string)
      logo_image_type: logo_image instanceof File ? 'file' : typeof logo_image,
      header_image_type: header_image instanceof File ? 'file' : typeof header_image,
      background_image_type: background_image instanceof File ? 'file' : typeof background_image,
    });
  }, [design]);

  // Debounced генерація preview - реагує на будь-які зміни в design
  useEffect(() => {
    if (!design || !designJson) return;
    
    const timer = setTimeout(() => {
      generatePreview();
    }, 800); // 0.8 секунди затримки для плавності

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designJson]);

  // Конвертуємо File в base64 data URL
  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Підготовка design з конвертованими зображеннями
  const prepareDesignWithImages = async (designData: any) => {
    const preparedDesign = { ...designData };
    
    // Конвертуємо File об'єкти в base64
    if (designData.logo_image instanceof File) {
      preparedDesign.logo_image = await fileToDataURL(designData.logo_image);
    }
    if (designData.header_image instanceof File) {
      preparedDesign.header_image = await fileToDataURL(designData.header_image);
    }
    if (designData.background_image instanceof File) {
      preparedDesign.background_image = await fileToDataURL(designData.background_image);
    }
    
    return preparedDesign;
  };

  const generatePreview = async () => {
    if (!design) return; // Не генеруємо якщо немає design
    
    setIsGenerating(true);
    try {
      // Підготовка design з конвертованими зображеннями
      const preparedDesign = await prepareDesignWithImages(design);
      
      const response = await fetch("/api/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design: preparedDesign,
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
    <div className="w-full">
      <div className="mb-2 text-sm text-gray-600">Preview</div>
      <p className="text-xs text-gray-500 mb-4">Попередній перегляд PDF</p>

      <div className="relative">
        {isGenerating && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
              <span className="text-sm text-gray-600">Оновлення preview...</span>
            </div>
          </div>
        )}

        {pdfUrl ? (
          <div className="max-w-4xl mx-auto">
            {/* PDF iframe на всю ширину і висоту */}
            <div className="bg-white rounded-lg shadow-lg" style={{ minHeight: '800px' }}>
              <iframe
                src={pdfUrl}
                className="w-full rounded-lg"
                style={{ height: '1000px' }}
                title="PDF Preview"
              />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg" style={{ minHeight: '800px' }}>
            <div className="h-[600px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-500">Налаштуйте шаблон праворуч →</p>
                <p className="text-xs text-gray-400 mt-2">
                  Preview з'явиться автоматично
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

