import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface Step7ContentProps {
  photoAllowed: string;
  videoAllowed: string;
  brandedProducts: string;
  onFieldChange: (field: string, value: string) => void;
}

export function Step7Content({
  photoAllowed,
  videoAllowed,
  brandedProducts,
  onFieldChange,
}: Step7ContentProps) {
  const isValid = () => {
    return true; // Всі поля опціональні
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Контент</h2>
        <p className="text-sm text-gray-600">Дозволи на фото та відео</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="photo-allowed" className="text-sm">
            Чи можна фотозйомка <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Input
            id="photo-allowed"
            value={photoAllowed}
            onChange={(e) => onFieldChange('photo_allowed', e.target.value)}
            placeholder="Так / Ні / З обмеженнями..."
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="video-allowed" className="text-sm">
            Чи можна відеозйомка <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Input
            id="video-allowed"
            value={videoAllowed}
            onChange={(e) => onFieldChange('video_allowed', e.target.value)}
            placeholder="Так / Ні / З обмеженнями..."
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="branded-products" className="text-sm">
            Чи можна брендовану продукцію <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Input
            id="branded-products"
            value={brandedProducts}
            onChange={(e) => onFieldChange('branded_products', e.target.value)}
            placeholder="Так / Ні / З обмеженнями..."
            className="h-12 text-base"
          />
        </div>
      </div>

      {/* Hidden validator for wizard */}
      <div style={{ display: 'none' }} data-valid={isValid()} />
    </div>
  );
}

