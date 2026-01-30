import React, { useState, useEffect } from 'react';
import { File, FileText, Video, Music, Download, X, ZoomIn, Play, FileImage } from 'lucide-react';
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
    if (mimeType?.startsWith('image/') || type === 'image') return FileImage;
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
    // Use thumbnail_url if available, otherwise use full image
    const thumbnailUrl = attachment?.thumbnail_url || imageUrl;
    const fullImageUrl = attachment?.url || imageUrl;

    return (
      <>
        {/* Thumbnail - маленьке превью */}
        <div 
          className={cn(
            'relative group cursor-pointer',
            'border border-gray-200 rounded-lg overflow-hidden',
            isPreview ? 'w-[120px] h-[120px]' : 'max-w-[200px] max-h-[200px]'
          )}
          style={!isPreview ? { maxWidth: '200px', maxHeight: '200px', width: 'auto', height: 'auto' } : undefined}
          onClick={() => setIsZoomed(true)}
        >
          <img
            src={thumbnailUrl}
            alt={displayName}
            style={!isPreview ? { maxWidth: '200px', maxHeight: '200px', width: 'auto', height: 'auto', objectFit: 'cover' } : undefined}
            className="w-full h-full object-cover rounded-lg transition-transform duration-200 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
          
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded-lg flex items-center justify-center">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

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

        {/* Lightbox - повнорозмірне зображення на весь екран */}
        {isZoomed && (
          <div 
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setIsZoomed(false)}
          >
            {/* Close button */}
            <button 
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              onClick={() => setIsZoomed(false)}
            >
              <X className="w-8 h-8" />
            </button>
            
            {/* Download button */}
            <button 
              className="absolute top-4 right-16 text-white hover:text-gray-300 z-10 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              title="Завантажити"
            >
              <Download className="w-7 h-7" />
            </button>

            {/* Full size image */}
            <img
              src={fullImageUrl}
              alt={displayName}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Filename */}
            {displayName && displayName !== 'Файл' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded">
                {displayName}
              </div>
            )}
          </div>
        )}

        {/* Prevent body scroll when lightbox is open */}
        {isZoomed && (
          <ScrollLock />
        )}
      </>
    );
  }

  // Video preview - compact with controls
  if (isVideo && attachment?.url) {
    return (
      <div className={cn(
        'relative rounded-lg overflow-hidden border border-gray-200 shadow-sm',
        isPreview ? 'w-[140px]' : 'max-w-[250px]'
      )}>
        <video
          src={attachment.url}
          className="w-full h-auto max-h-[200px] rounded-lg"
          controls
          preload="metadata"
        />
        {/* Download button overlay */}
        <button
          onClick={handleDownload}
          className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
          title="Завантажити"
        >
          <Download className="w-4 h-4" />
        </button>
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

  // Audio/Voice preview
  if (isAudio && attachment?.url) {
    return (
      <div className={cn(
        'flex items-center gap-3 p-3 rounded-lg border max-w-[280px]',
        isInbound ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200',
        isPreview && 'bg-white border-gray-300'
      )}>
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
          'bg-purple-100 text-purple-600'
        )}>
          <Music className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <audio src={attachment.url} controls className="w-full h-8" preload="metadata" />
          {displayName && displayName !== 'Файл' && (
            <p className="text-xs text-gray-500 truncate mt-1">{displayName}</p>
          )}
        </div>
        <button 
          onClick={handleDownload} 
          className="p-1.5 hover:bg-gray-200 rounded transition-colors shrink-0"
          title="Завантажити"
        >
          <Download className="w-4 h-4 text-gray-600" />
        </button>
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
        'flex items-center gap-3 p-3 rounded-lg border max-w-[280px] cursor-pointer hover:bg-gray-50 transition-colors',
        isInbound ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200',
        isPreview && 'bg-white border-gray-300'
      )}
      onClick={handleDownload}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
          'bg-blue-100 text-blue-600'
        )}
      >
        <FileText className="w-5 h-5" />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
        {displaySize && (
          <p className="text-xs text-gray-500">{formatFileSize(displaySize)}</p>
        )}
      </div>

      {/* Download icon */}
      <Download className="w-4 h-4 text-gray-400 shrink-0" />
      
      {/* Remove button for preview mode */}
      {isPreview && onRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

// Component to prevent body scroll when lightbox is open
function ScrollLock() {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  return null;
}

