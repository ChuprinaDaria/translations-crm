import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card } from "../../../components/ui/card";
import { cn } from "../../../components/ui/utils";
import { Upload, File, X } from "lucide-react";
import { toast } from "sonner";
import { dragUploadApi } from "../api";

interface DraggableCardProps {
  orderId: string | number;
  children: React.ReactNode;
  onUploadSuccess?: (fileUrl: string) => void;
  onStatusChange?: (status: string) => void;
  className?: string;
}

export function DraggableCard({
  orderId,
  children,
  onUploadSuccess,
  onStatusChange,
  className,
}: DraggableCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setIsUploading(true);

      try {
        // Завантажуємо файл
        const result = await dragUploadApi.uploadFile(orderId, file);
        
        setUploadedFiles((prev) => [...prev, result.url]);
        onUploadSuccess?.(result.url);
        
        // Опціонально змінюємо статус
        if (onStatusChange) {
          onStatusChange("DO_POSWIADCZENIA");
        }

        toast.success("Файл успішно завантажено!");
      } catch (error: any) {
        console.error("Upload error:", error);
        toast.error(error.message || "Не вдалося завантажити файл");
      } finally {
        setIsUploading(false);
        setIsDragging(false);
      }
    },
    [orderId, onUploadSuccess, onStatusChange]
  );

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg"],
      "application/msword": [".doc", ".docx"],
    },
    multiple: false,
    noClick: true, // Не відкриваємо файловий діалог при кліку
  });

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div {...getRootProps()} className="relative">
      <Card
        className={cn(
          "transition-all",
          isDragActive || isDragging
            ? "border-[#FF5A00] border-2 bg-[#FF5A00]/5 shadow-lg"
            : "",
          isUploading ? "opacity-50 pointer-events-none" : "",
          className
        )}
      >
        {children}

        {/* Індикатор перетягування */}
        {(isDragActive || isDragging) && (
          <div className="absolute inset-0 bg-[#FF5A00]/10 rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <Upload className="w-12 h-12 text-[#FF5A00] mx-auto mb-2" />
              <p className="text-[#FF5A00] font-semibold">Відпустіть для завантаження</p>
            </div>
          </div>
        )}

        {/* Індикатор завантаження */}
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <Upload className="w-8 h-8 text-[#FF5A00] mx-auto mb-2 animate-bounce" />
              <p className="text-sm text-gray-600">Завантаження...</p>
            </div>
          </div>
        )}

        {/* Список завантажених файлів */}
        {uploadedFiles.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Завантажені файли:</p>
            <div className="space-y-1">
              {uploadedFiles.map((url, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-1 rounded"
                >
                  <File className="w-3 h-3" />
                  <span className="flex-1 truncate">{url.split("/").pop()}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(index);
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

