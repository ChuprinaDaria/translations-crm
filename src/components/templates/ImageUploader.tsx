import React, { useState, useRef, useEffect } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ImageUploaderProps {
  label: string;
  currentImage: File | string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  aspectRatio?: string;
  maxSize?: string;
  helperText?: string;
}

export function ImageUploader({
  label,
  currentImage,
  onUpload,
  onRemove,
  aspectRatio = "free",
  maxSize = "5MB",
  helperText,
}: ImageUploaderProps) {
  const inputId = `image-upload-${label.replace(/\s+/g, "-").toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(
    typeof currentImage === "string" ? currentImage : null
  );
  const [isDragging, setIsDragging] = useState(false);

  // Оновлюємо preview коли currentImage змінюється (наприклад, при завантаженні з сервера)
  useEffect(() => {
    if (typeof currentImage === "string") {
      setPreview(currentImage);
    } else if (currentImage === null) {
      setPreview(null);
    }
  }, [currentImage]);

  const parseSize = (size: string): number => {
    const num = parseInt(size);
    return num * 1024 * 1024; // MB to bytes
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    // Валідація типу
    if (!file.type.startsWith("image/")) {
      toast.error("Тільки зображення!");
      return;
    }

    // Валідація розміру
    if (file.size > parseSize(maxSize)) {
      toast.error(`Файл завеликий! Максимум ${maxSize}`);
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  };

  return (
    <div className="mb-6 max-w-full w-full">
      <label className="block text-sm font-medium text-gray-900 mb-2">
        {label}
      </label>
      {helperText && (
        <p className="text-xs text-gray-500 mb-3">{helperText}</p>
      )}

      {/* Upload зона або preview */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg transition-all max-w-full overflow-hidden ${
          isDragging
            ? "border-orange-500 bg-orange-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        {preview ? (
          /* Показуємо завантажене */
          <div className="p-4 max-w-full">
            <div className="relative rounded-lg overflow-hidden mb-3 w-full" style={{ maxWidth: '100%' }}>
              <img
                src={preview}
                alt="Preview"
                className="w-full h-40 object-cover"
                style={{ maxWidth: '100%', height: '160px', display: 'block' }}
              />
              {/* Overlay з кнопками при hover */}
              <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 bg-white text-gray-900 rounded-lg text-sm hover:bg-gray-100"
                >
                  Змінити
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    onRemove();
                  }}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                >
                  Видалити
                </button>
              </div>
            </div>

            {/* Інфо про файл */}
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Зображення завантажено
            </div>
          </div>
        ) : (
          /* Показуємо зону drop */
          <label htmlFor={inputId} className="block p-8 cursor-pointer">
            <div className="flex flex-col items-center gap-3">
              {/* Іконка */}
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Upload className="w-6 h-6 text-gray-400" />
              </div>

              {/* Текст */}
              <div className="text-center">
                <p className="text-sm text-gray-900 mb-1">
                  <span className="text-orange-600 font-medium">Виберіть файл</span>
                  {" "}або перетягніть сюди
                </p>
                <p className="text-xs text-gray-500">
                  {aspectRatio !== "free" && `Співвідношення ${aspectRatio} • `}
                  PNG, JPG до {maxSize}
                </p>
              </div>
            </div>
          </label>
        )}

        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          className="hidden"
        />
      </div>
    </div>
  );
}

