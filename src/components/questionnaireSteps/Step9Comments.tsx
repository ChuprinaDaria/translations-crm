import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";

interface Step9CommentsProps {
  specialNotes: string;
  onFieldChange: (field: string, value: string) => void;
}

export function Step9Comments({
  specialNotes,
  onFieldChange,
}: Step9CommentsProps) {
  const isValid = () => {
    return true; // Поле опціональне
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Коментарі</h2>
        <p className="text-sm text-gray-600">Спеціальні примітки та додаткова інформація</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="special-notes" className="text-sm">
            Спеціальні примітки <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Textarea
            id="special-notes"
            value={specialNotes}
            onChange={(e) => onFieldChange('special_notes', e.target.value)}
            placeholder="Додаткова інформація, особливості, побажання клієнта..."
            rows={6}
            className="text-base min-h-[120px]"
          />
        </div>
      </div>

      {/* Hidden validator for wizard */}
      <div style={{ display: 'none' }} data-valid={isValid()} />
    </div>
  );
}

