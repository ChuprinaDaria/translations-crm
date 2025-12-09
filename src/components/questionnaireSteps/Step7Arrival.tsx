import React, { useState, useEffect } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Upload, X, ZoomIn } from "lucide-react";

interface Step7ArrivalProps {
  venueComplexity: string;
  floorNumber: string;
  elevatorAvailable: boolean;
  technicalRoom: string;
  kitchenAvailable: string;
  venuePhotos: boolean;
  arrivalPhotos: boolean;
  venuePhotosUrls: string[];
  arrivalPhotosUrls: string[];
  onChange: (field: string, value: any) => void;
  onPhotoUpload?: (file: File, type: 'venue' | 'arrival') => Promise<void>;
  onPhotoRemove?: (index: number, type: 'venue' | 'arrival') => void;
  onPhotoView?: (url: string) => void;
}

export function Step7Arrival({
  venueComplexity,
  floorNumber,
  elevatorAvailable,
  technicalRoom,
  kitchenAvailable,
  venuePhotos,
  arrivalPhotos,
  venuePhotosUrls,
  arrivalPhotosUrls,
  onChange,
  onPhotoUpload,
  onPhotoRemove,
  onPhotoView,
}: Step7ArrivalProps) {
  const [complexityLevel, setComplexityLevel] = useState(() => {
    // Парсимо рівень з рядка "Рівень 1/5" або просто число
    if (venueComplexity) {
      const match = venueComplexity.match(/Рівень (\d+)/);
      if (match) return parseInt(match[1]);
      const num = parseInt(venueComplexity);
      if (!isNaN(num) && num >= 1 && num <= 5) return num;
    }
    return 1;
  });
  const [complexityComment, setComplexityComment] = useState("");

  useEffect(() => {
    // Оновлюємо venue_complexity при зміні рівня
    const complexityText = `Рівень ${complexityLevel}/5${complexityComment ? ` - ${complexityComment}` : ''}`;
    onChange('venue_complexity', complexityText);
  }, [complexityLevel, complexityComment]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'venue' | 'arrival') => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && onPhotoUpload) {
      for (const file of files) {
        if (file instanceof File) {
          await onPhotoUpload(file, type);
        }
      }
    }
    e.target.value = '';
  };

  const isValid = () => {
    return true; // Всі поля опціональні
  };

  const getComplexityColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-green-100 text-green-800';
      case 2: return 'bg-lime-100 text-lime-800';
      case 3: return 'bg-yellow-100 text-yellow-800';
      case 4: return 'bg-orange-100 text-orange-800';
      case 5: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Заїзд</h2>
        <p className="text-sm text-gray-600">Деталі про заїзд та локацію</p>
      </div>

      <div className="space-y-4">
        {/* Складність заїзду */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Складність заїзду</Label>
          <div className="space-y-3">
            <div className="relative">
              <input
                type="range"
                min="1"
                max="5"
                value={complexityLevel}
                onChange={(e) => setComplexityLevel(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, 
                    #10b981 0%, 
                    #84cc16 25%, 
                    #eab308 50%, 
                    #f97316 75%, 
                    #ef4444 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>Легко</span>
                <span>Помірно</span>
                <span>Складно</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded text-sm font-medium ${getComplexityColor(complexityLevel)}`}>
                Рівень {complexityLevel}/5
              </div>
            </div>
            <Input
              value={complexityComment}
              onChange={(e) => setComplexityComment(e.target.value)}
              placeholder="Коментар (опціонально)..."
              className="h-12 text-base"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Поверх */}
          <div className="space-y-2">
            <Label htmlFor="floor-number" className="text-sm">
              На якому поверсі <span className="text-gray-400 text-xs">(опціонально)</span>
            </Label>
            <Input
              id="floor-number"
              value={floorNumber}
              onChange={(e) => onChange('floor_number', e.target.value)}
              placeholder="1, 2, 3..."
              className="h-12 text-base"
            />
          </div>

          {/* Технічне приміщення */}
          <div className="space-y-2">
            <Label htmlFor="technical-room" className="text-sm">
              Чи є технічне приміщення <span className="text-gray-400 text-xs">(опціонально)</span>
            </Label>
            <Input
              id="technical-room"
              value={technicalRoom}
              onChange={(e) => onChange('technical_room', e.target.value)}
              placeholder="Так/Ні або опис..."
              className="h-12 text-base"
            />
          </div>

          {/* Ліфт */}
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="elevator"
              checked={elevatorAvailable}
              onCheckedChange={(checked) => onChange('elevator_available', checked)}
            />
            <Label htmlFor="elevator" className="text-sm cursor-pointer">
              Чи є ліфт
            </Label>
          </div>

          {/* Кухня */}
          <div className="space-y-2">
            <Label htmlFor="kitchen" className="text-sm">
              Чи є кухня <span className="text-gray-400 text-xs">(опціонально)</span>
            </Label>
            <Input
              id="kitchen"
              value={kitchenAvailable}
              onChange={(e) => onChange('kitchen_available', e.target.value)}
              placeholder="Так/Ні або опис..."
              className="h-12 text-base"
            />
          </div>
        </div>

        {/* Фото локації */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="venue-photos"
              checked={venuePhotos}
              onCheckedChange={(checked) => onChange('venue_photos', checked)}
            />
            <Label htmlFor="venue-photos" className="text-sm font-semibold cursor-pointer">
              Фото локації
            </Label>
          </div>
          {venuePhotos && (
            <div className="flex flex-wrap gap-3">
              {venuePhotosUrls.map((photo, idx) => (
                <div key={idx} className="relative group w-20 h-20 flex-shrink-0">
                  <div
                    className="w-full h-full relative overflow-hidden rounded-lg border-2 border-gray-200 cursor-pointer hover:border-[#FF5A00] transition shadow-sm"
                    onClick={() => onPhotoView?.(photo)}
                  >
                    <img
                      src={photo}
                      alt={`Venue ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition flex items-center justify-center">
                      <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  </div>
                  {onPhotoRemove && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPhotoRemove(idx, 'venue');
                      }}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <label className="w-20 h-20 flex-shrink-0 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#FF5A00] hover:bg-[#FF5A00]/5 transition shadow-sm">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'venue')}
                />
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-[10px] text-gray-500 mt-0.5">Додати</span>
              </label>
            </div>
          )}
        </div>

        {/* Фото заїзду */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="arrival-photos"
              checked={arrivalPhotos}
              onCheckedChange={(checked) => onChange('arrival_photos', checked)}
            />
            <Label htmlFor="arrival-photos" className="text-sm font-semibold cursor-pointer">
              Фото заїзду
            </Label>
          </div>
          {arrivalPhotos && (
            <div className="flex flex-wrap gap-3">
              {arrivalPhotosUrls.map((photo, idx) => (
                <div key={idx} className="relative group w-20 h-20 flex-shrink-0">
                  <div
                    className="w-full h-full relative overflow-hidden rounded-lg border-2 border-gray-200 cursor-pointer hover:border-[#FF5A00] transition shadow-sm"
                    onClick={() => onPhotoView?.(photo)}
                  >
                    <img
                      src={photo}
                      alt={`Arrival ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition flex items-center justify-center">
                      <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  </div>
                  {onPhotoRemove && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPhotoRemove(idx, 'arrival');
                      }}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <label className="w-20 h-20 flex-shrink-0 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#FF5A00] hover:bg-[#FF5A00]/5 transition shadow-sm">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'arrival')}
                />
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-[10px] text-gray-500 mt-0.5">Додати</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Hidden validator for wizard */}
      <div style={{ display: 'none' }} data-valid={isValid()} />
    </div>
  );
}

