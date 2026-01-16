import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { calculateEndTime } from "../../utils/questionnaireValidation";
import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface Step4TimingProps {
  arrivalTime: string;
  eventStartTime: string;
  eventEndTime: string;
  additionalServicesTiming: string;
  onChange: (field: string, value: string) => void;
}

export function Step4Timing({
  arrivalTime,
  eventStartTime,
  eventEndTime,
  additionalServicesTiming,
  onChange,
}: Step4TimingProps) {
  // Автозаповнення часу кінця при зміні часу початку
  useEffect(() => {
    if (eventStartTime && !eventEndTime) {
      const calculated = calculateEndTime(eventStartTime);
      if (calculated) {
        onChange('event_end_time', calculated);
      }
    }
  }, [eventStartTime]);

  const handleStartTimeChange = (hours: string, minutes: string) => {
    const time = `${hours}:${minutes}`;
    onChange('event_start_time', time);
    
    // Автоматично розраховуємо час кінця (+4 години)
    if (!eventEndTime) {
      const calculated = calculateEndTime(time);
      if (calculated) {
        onChange('event_end_time', calculated);
      }
    }
  };

  const isValid = () => {
    return !!(eventStartTime && eventEndTime);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Тайминг</h2>
        <p className="text-sm text-gray-600">Час проведення заходу та заїзду</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">
            Час початку заходу <span className="text-red-500">*</span>
          </Label>
          <div className="flex gap-2 items-center">
            <Select
              value={eventStartTime?.split(':')[0] || "18"}
              onValueChange={(hour) => {
                const minute = eventStartTime?.split(':')[1] || "00";
                handleStartTimeChange(hour, minute);
              }}
            >
              <SelectTrigger className="w-24 h-12 text-base">
                <SelectValue placeholder="ГГ" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(hour => (
                  <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xl font-semibold">:</span>
            <Select
              value={eventStartTime?.split(':')[1] || "00"}
              onValueChange={(minute) => {
                const hour = eventStartTime?.split(':')[0] || "18";
                handleStartTimeChange(hour, minute);
              }}
            >
              <SelectTrigger className="w-24 h-12 text-base">
                <SelectValue placeholder="ХХ" />
              </SelectTrigger>
              <SelectContent>
                {['00', '15', '30', '45'].map(minute => (
                  <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">
            Час кінця заходу <span className="text-red-500">*</span>
          </Label>
          <div className="flex gap-2 items-center">
            <Select
              value={eventEndTime?.split(':')[0] || ""}
              onValueChange={(hour) => {
                const minute = eventEndTime?.split(':')[1] || "00";
                onChange('event_end_time', `${hour}:${minute}`);
              }}
            >
              <SelectTrigger className="w-24 h-12 text-base">
                <SelectValue placeholder="ГГ" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(hour => (
                  <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xl font-semibold">:</span>
            <Select
              value={eventEndTime?.split(':')[1] || "00"}
              onValueChange={(minute) => {
                const hour = eventEndTime?.split(':')[0] || "18";
                onChange('event_end_time', `${hour}:${minute}`);
              }}
            >
              <SelectTrigger className="w-24 h-12 text-base">
                <SelectValue placeholder="ХХ" />
              </SelectTrigger>
              <SelectContent>
                {['00', '15', '30', '45'].map(minute => (
                  <SelectItem key={minute} value={minute}>{minute}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="arrival-time" className="text-sm">
            Час заїзду на локацію <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Textarea
            id="arrival-time"
            value={arrivalTime}
            onChange={(e) => onChange('arrival_time', e.target.value)}
            placeholder="Заїзд напередодні: з 9:00..."
            rows={3}
            className="text-base min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="additional-timing" className="text-sm">
            Таймінги додаткових видач <span className="text-gray-400 text-xs">(опціонально)</span>
          </Label>
          <Textarea
            id="additional-timing"
            value={additionalServicesTiming}
            onChange={(e) => onChange('additional_services_timing', e.target.value)}
            placeholder="14:00 - Welcome drink&#10;15:00 - Фуршет..."
            rows={4}
            className="text-base min-h-[100px]"
          />
        </div>
      </div>

      {/* Hidden validator for wizard */}
      <div style={{ display: 'none' }} data-valid={isValid()} />
    </div>
  );
}

