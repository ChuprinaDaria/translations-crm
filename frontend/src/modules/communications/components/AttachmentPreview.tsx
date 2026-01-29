import React, { useState } from 'react';
import { File, Image as ImageIcon, Video, Music, Download, X, ZoomIn } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent } from '../../../components/ui/dialog';
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
 * Показує:
 * - Фото: повноцінне зображення з можливістю збільшення
 * - Відео: превью з кнопкою play
 * - Документи/інші файли: іконка + інформація
 */
export function AttachmentPreview({
  attachment,
  file,
  isPreview = false,
  isInbound = true,
  onRemove,
}: AttachmentPreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const getFileIcon = (type?: string, mimeType?: string) => {
    if (mimeType?.startsWith('image/') || type === 'image') return ImageIcon;
    if (mimeType?.startsWith('video/') || type === 'video') return Video;
    if (mimeType?.startsWith('audio/') || type === 'audio' || type === 'voice') return Music;
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

  // Determine if it's an image
  const isImage = type === 'image' || mimeType?.startsWith('image/');
  const isVideo = type === 'video' || mimeType?.startsWith('video/');
  const isAudio = type === 'audio' || type === 'voice' || mimeType?.startsWith('audio/');

  // Get image URL
  const getImageUrl = () => {
    if (file && isImage) {
      return URL.createObjectURL(file);
    }
    if (attachment?.url) {
      // Ensure proper API URL
      const url = attachment.url;
      if (url.startsWith('/api/')) {
        return url; // Already has API prefix
      }
      return url;
    }
    if (attachment?.thumbnail_url) {
      return attachment.thumbnail_url;
    }
    return null;
  };

  const imageUrl = getImageUrl();

  const handleDownload = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Не відкривати lightbox при кліку на download
    }
    if (attachment?.url) {
      // Open in new tab or download
      const link = document.createElement('a');
      link.href = attachment.url;
      link.download = displayName;
      link.target = '_blank';
      link.click();
    } else if (file) {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Image preview with zoom - compact thumbnail in chat
  if (isImage && imageUrl && !imageError) {
    return (
      <>
        {/* Мініатюра */}
        <div 
          className={cn(
            'relative rounded-lg overflow-hidden group cursor-pointer',
            'border border-gray-200 shadow-sm',
            isPreview ? 'w-[120px] h-[120px]' : 'max-w-[200px]'
          )}
          onClick={() => setIsZoomed(true)}
        >
          <img
            src={imageUrl}
            alt={displayName}
            className="w-full h-auto max-h-[200px] object-cover rounded-lg transition-transform duration-200 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
          
          {/* Overlay з іконками при hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
            <button 
              className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors pointer-events-auto"
              title="Збільшити"
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed(true);
              }}
            >
              <ZoomIn className="w-4 h-4 text-gray-700" />
            </button>
            <button 
              onClick={handleDownload}
              className="p-2 bg-white/90 rounded-full hover:bg-white transition-colors pointer-events-auto"
              title="Завантажити"
            >
              <Download className="w-4 h-4 text-gray-700" />
            </button>
          </div>

          {/* Назва файлу під зображенням */}
          {displayName && displayName !== 'Файл' && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
              <span className="text-xs text-white truncate block">{displayName}</span>
            </div>
          )}

          {/* Remove button for preview mode */}
          {isPreview && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="absolute top-1 right-1 h-5 w-5 p-0 bg-black/50 hover:bg-black/70 text-white"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Lightbox - повнорозмірне зображення */}
        <Dialog open={isZoomed} onOpenChange={setIsZoomed}>
          <DialogContent 
            className="max-w-[90vw] max-h-[90vh] p-0 bg-transparent border-none"
            hideClose={true}
          >
            <div className="relative">
              {/* Кнопка закрити */}
              <button 
                onClick={() => setIsZoomed(false)}
                className="absolute top-2 right-2 z-10 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              
              {/* Кнопка завантажити */}
              <button 
                onClick={handleDownload}
                className="absolute top-2 right-14 z-10 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                title="Завантажити"
              >
                <Download className="w-5 h-5 text-white" />
              </button>
              
              {/* Повнорозмірне зображення */}
              <img 
                src={imageUrl} 
                alt={displayName}
                className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Video preview - compact with controls
  if (isVideo && attachment?.url) {
    return (
      <div className={cn(
        'relative rounded-lg overflow-hidden border border-gray-200 shadow-sm',
        isPreview ? 'w-[140px]' : 'w-[200px]'
      )}>
        <video
          src={attachment.url}
          className="w-full h-auto rounded-lg"
          controls
          preload="metadata"
        />
        {isPreview && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="absolute top-1 right-1 h-5 w-5 p-0 bg-black/50 hover:bg-black/70 text-white"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  }

  // Audio preview
  if (isAudio && attachment?.url) {
    return (
      <div className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        'bg-gray-50 border-gray-200',
        isPreview && 'bg-white border-gray-300'
      )}>
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
          'bg-gray-200 text-gray-600'
        )}>
          <Music className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <audio src={attachment.url} controls className="w-full h-8" preload="metadata" />
        </div>
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
    );
  }

  // Default file preview (documents, etc.)
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        'bg-gray-50 border-gray-200',
        isPreview && 'bg-white border-gray-300'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded flex items-center justify-center shrink-0',
          'bg-gray-200 text-gray-600'
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
            className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
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

