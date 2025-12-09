import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Check, Search } from "lucide-react";
import { useState } from "react";
import { formatPhone, validatePhone, validateEmail } from "../../utils/questionnaireValidation";
import type { ClientCreate } from "../../lib/api";

interface Step1ClientProps {
  clientData: ClientCreate;
  onChange: (data: ClientCreate) => void;
  onSelectExisting?: () => void;
}

export function Step1Client({ clientData, onChange, onSelectExisting }: Step1ClientProps) {
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    onChange({ ...clientData, phone: formatted });
    
    if (formatted.length > 0) {
      setPhoneValid(validatePhone(formatted));
    } else {
      setPhoneValid(null);
    }
  };

  const handleEmailChange = (value: string) => {
    onChange({ ...clientData, email: value });
    
    if (value.length > 0) {
      setEmailValid(validateEmail(value));
    } else {
      setEmailValid(null);
    }
  };

  const isValid = () => {
    return !!(clientData.name && clientData.phone && validatePhone(clientData.phone));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Дані клієнта</h2>
        <p className="text-sm text-gray-600">Основна інформація про клієнта</p>
      </div>

      {onSelectExisting && (
        <Button
          type="button"
          variant="outline"
          onClick={onSelectExisting}
          className="w-full h-12 text-base"
        >
          <Search className="w-5 h-5 mr-2" />
          Вибрати існуючого клієнта
        </Button>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="client-name" className="text-sm font-semibold">
            Ім'я клієнта <span className="text-red-500">*</span>
          </Label>
          <Input
            id="client-name"
            value={clientData.name}
            onChange={(e) => onChange({ ...clientData, name: e.target.value })}
            placeholder="Введіть ім'я"
            className="h-12 text-base"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-phone" className="text-sm font-semibold">
            Телефон <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Input
              id="client-phone"
              type="tel"
              value={clientData.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+380501234567"
              className="h-12 text-base pr-10"
              inputMode="numeric"
            />
            {phoneValid === true && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
            )}
            {phoneValid === false && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-xs">
                Некоректний формат
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-email" className="text-sm">
            Email <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <div className="relative">
            <Input
              id="client-email"
              type="email"
              value={clientData.email || ""}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="email@example.com"
              className="h-12 text-base pr-10"
              inputMode="email"
            />
            {emailValid === true && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
            )}
            {emailValid === false && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-xs">
                Некоректний email
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-company" className="text-sm">
            Компанія <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Input
            id="client-company"
            value={clientData.company_name || ""}
            onChange={(e) => onChange({ ...clientData, company_name: e.target.value })}
            placeholder="Назва компанії"
            className="h-12 text-base"
          />
        </div>
      </div>

      {/* Hidden validator for wizard */}
      <div style={{ display: 'none' }} data-valid={isValid()} />
    </div>
  );
}

