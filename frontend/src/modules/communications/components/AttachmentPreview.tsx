import React from 'react';
import { File, Image, Video, Music, Download, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../components/ui/utils';

interface AttachmentPreviewProps {
  attachment?: {
    id?: string;
    type: string;
    url?: string;
    filename?: string;
    mime_type?: string;
    size?: number;
    thumbnail_url?: string;
  };
  file?: File;
  isPreview?: boolean;
  isInbound?: boolean;
  onRemove?: () => void;
}

/**
 * Preview компонент для вкладень
 * 
 * Дизайн:
 * ┌────────────────┐
 * │  [File Icon]   │
 * │  document.pdf  │
 * │  2.3 MB        │
 * │  [Download]    │
 * └────────────────┘
 */
export function AttachmentPreview({
  attachment,
  file,
  isPreview = false,
  isInbound = true,
  onRemove,
}: AttachmentPreviewProps) {
  const getFileIcon = (type?: string, mimeType?: string) => {
    if (mimeType?.startsWith('image/')) return Image;
    if (mimeType?.startsWith('video/')) return Video;
    if (mimeType?.startsWith('audio/')) return Music;
    return File;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const displayName = file?.name || attachment?.filename || 'Файл';
  const displaySize = file?.size || attachment?.size;
  const mimeType = file?.type || attachment?.mime_type;
  const type = attachment?.type || (mimeType?.split('/')[0] || 'file');
  const Icon = getFileIcon(type, mimeType);

  const handleDownload = () => {
    if (attachment?.url) {
      window.open(attachment.url, '_blank');
    } else if (file) {
      // Create download link for File object
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        isInbound
          ? 'bg-gray-50 border-gray-200'
          : 'bg-blue-50 border-blue-200',
        isPreview && 'bg-white border-gray-300'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded flex items-center justify-center shrink-0',
          isInbound
            ? 'bg-gray-200 text-gray-600'
            : 'bg-blue-200 text-blue-600'
        )}
      >
        <Icon className="w-5 h-5" />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
        {displaySize && (
          <p className="text-xs text-gray-500">{formatFileSize(displaySize)}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {!isPreview && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-8 w-8 p-0"
          >
            <Download className="w-4 h-4" />
          </Button>
        )}
        {isPreview && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

