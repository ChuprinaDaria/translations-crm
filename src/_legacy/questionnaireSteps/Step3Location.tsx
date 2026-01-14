import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { formatPhone, validatePhone } from "../../utils/questionnaireValidation";
import { useState } from "react";
import { Check } from "lucide-react";

interface Step3LocationProps {
  location: string;
  contactPerson: string;
  contactPhone: string;
  onSiteContact: string;
  onSitePhone: string;
  onChange: (field: string, value: string) => void;
}

export function Step3Location({
  location,
  contactPerson,
  contactPhone,
  onSiteContact,
  onSitePhone,
  onChange,
}: Step3LocationProps) {
  const [contactPhoneValid, setContactPhoneValid] = useState<boolean | null>(null);
  const [onSitePhoneValid, setOnSitePhoneValid] = useState<boolean | null>(null);

  const handleContactPhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    onChange('contact_phone', formatted);
    
    if (formatted.length > 0) {
      setContactPhoneValid(validatePhone(formatted));
    } else {
      setContactPhoneValid(null);
    }
  };

  const handleOnSitePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    onChange('on_site_phone', formatted);
    
    if (formatted.length > 0) {
      setOnSitePhoneValid(validatePhone(formatted));
    } else {
      setOnSitePhoneValid(null);
    }
  };

  const isValid = () => {
    return !!(location && contactPerson && contactPhone && validatePhone(contactPhone));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Локація</h2>
        <p className="text-sm text-gray-600">Інформація про місце проведення заходу</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="location" className="text-sm font-semibold">
            Точна локація <span className="text-red-500">*</span>
          </Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => onChange('location', e.target.value)}
            placeholder="м. Київ, вул. Хрещатик, 1"
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-person" className="text-sm font-semibold">
            Контакт замовника <span className="text-red-500">*</span>
          </Label>
          <Input
            id="contact-person"
            value={contactPerson}
            onChange={(e) => onChange('contact_person', e.target.value)}
            placeholder="Ім'я та прізвище"
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-phone" className="text-sm font-semibold">
            Телефон контакту <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Input
              id="contact-phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => handleContactPhoneChange(e.target.value)}
              placeholder="+380501234567"
              className="h-12 text-base pr-10"
              inputMode="numeric"
            />
            {contactPhoneValid === true && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
            )}
            {contactPhoneValid === false && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-xs">
                Некоректний формат
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="on-site-contact" className="text-sm">
            Хто буде головним на локації <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Input
            id="on-site-contact"
            value={onSiteContact}
            onChange={(e) => onChange('on_site_contact', e.target.value)}
            placeholder="Ім'я та прізвище"
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="on-site-phone" className="text-sm">
            Телефон на локації <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <div className="relative">
            <Input
              id="on-site-phone"
              type="tel"
              value={onSitePhone}
              onChange={(e) => handleOnSitePhoneChange(e.target.value)}
              placeholder="+380501234567"
              className="h-12 text-base pr-10"
              inputMode="numeric"
            />
            {onSitePhoneValid === true && (
              <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
            )}
            {onSitePhoneValid === false && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-xs">
                Некоректний формат
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hidden validator for wizard */}
      <div style={{ display: 'none' }} data-valid={isValid()} />
    </div>
  );
}

