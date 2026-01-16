import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface Step8ClientProps {
  clientCompanyName: string;
  clientActivityType: string;
  onFieldChange: (field: string, value: string) => void;
}

export function Step8Client({
  clientCompanyName,
  clientActivityType,
  onFieldChange,
}: Step8ClientProps) {
  const isValid = () => {
    return true; // Всі поля опціональні
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Замовник</h2>
        <p className="text-sm text-gray-600">Інформація про компанію замовника</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="client-company-name" className="text-sm">
            Назва компанії <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Input
            id="client-company-name"
            value={clientCompanyName}
            onChange={(e) => onFieldChange('client_company_name', e.target.value)}
            placeholder="ТОВ 'Компанія'"
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-activity-type" className="text-sm">
            Вид діяльності компанії <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Input
            id="client-activity-type"
            value={clientActivityType}
            onChange={(e) => onFieldChange('client_activity_type', e.target.value)}
            placeholder="IT, Фінанси, Медицина..."
            className="h-12 text-base"
          />
        </div>
      </div>

      {/* Hidden validator for wizard */}
      <div style={{ display: 'none' }} data-valid={isValid()} />
    </div>
  );
}

