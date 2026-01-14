import React from "react";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
}

export function ColorPicker({ label, value, onChange, presets = [] }: ColorPickerProps) {
  return (
    <div>
      <label className="text-xs font-medium block mb-2">{label}</label>
      <div className="flex gap-2">
        {/* Поточний колір з прихованим color picker */}
        <button
          type="button"
          className="w-12 h-12 rounded-lg border-2 border-gray-300 relative overflow-hidden flex-shrink-0 hover:border-gray-400 transition-colors"
          style={{ backgroundColor: value }}
        >
          {/* Прихований input[type=color] */}
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </button>
        
        {/* Текстове поле для HEX */}
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const newValue = e.target.value;
            // Дозволяємо вводити тільки валідні HEX кольори
            if (/^#[0-9A-Fa-f]{0,6}$/.test(newValue)) {
              onChange(newValue);
            }
          }}
          className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="#FF5A00"
          maxLength={7}
        />
      </div>
      
      {/* Пресети */}
      {presets.length > 0 && (
        <div className="flex gap-2 mt-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className="w-8 h-8 rounded-md border-2 hover:scale-110 transition-transform"
              style={{
                backgroundColor: preset,
                borderColor: value === preset ? "#000" : "#E5E7EB",
              }}
              title={preset}
            />
          ))}
        </div>
      )}
    </div>
  );
}

