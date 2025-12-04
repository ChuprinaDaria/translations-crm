import React, { useState, useRef } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface ImageUploaderProps {
  label: string;
  currentImage: File | string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  aspectRatio?: string;
  maxSize?: string;
}

export function ImageUploader({
  label,
  currentImage,
  onUpload,
  onRemove,
  aspectRatio = "free",
  maxSize = "5MB",
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(
    typeof currentImage === "string" ? currentImage : null
  );

  const parseSize = (size: string): number => {
    const num = parseInt(size);
    return num * 1024 * 1024; // MB to bytes
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валідація розміру
    if (file.size > parseSize(maxSize)) {
      toast.error(`Файл завеликий! Максимум ${maxSize}`);
      return;
    }

    // Валідація типу
    if (!file.type.startsWith("image/")) {
      toast.error("Тільки зображення!");
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      onUpload(file);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="mb-4">
      <label className="text-xs font-medium block mb-2">{label}</label>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-orange-500 transition-colors">
        {preview ? (
          /* Показуємо завантажене зображення */
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-32 object-cover rounded-lg mb-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Змінити
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  onRemove();
                }}
                className="px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                Видалити
              </button>
            </div>
          </div>
        ) : (
          /* Показуємо зону drop */
          <label
            htmlFor={fileInputRef.current?.id}
            className="cursor-pointer flex flex-col items-center gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-gray-400" />
            <span className="text-sm text-gray-600">
              Перетягніть або <span className="text-orange-600 underline">виберіть файл</span>
            </span>
            <span className="text-xs text-gray-500">
              {aspectRatio !== "free" && `Співвідношення ${aspectRatio} • `}
              Максимум {maxSize}
            </span>
          </label>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}

