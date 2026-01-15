import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { AttachmentPreview } from './AttachmentPreview';
import { cn } from '../../../components/ui/utils';
import { formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';

export interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'html' | 'file';
  content: string;
  status: 'queued' | 'sent' | 'read' | 'failed';
  attachments?: Array<{
    id?: string;
    type: string;
    url?: string;
    filename?: string;
    mime_type?: string;
    size?: number;
    thumbnail_url?: string;
  }>;
  meta_data?: Record<string, any>;
  sent_at?: string;
  created_at: string;
}

interface MessageBubbleProps {
  message: Message;
  platform: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
}

/**
 * Message bubble component
 * 
 * Incoming (ліворуч):
 * ┌─────────────────────────┐
 * │ [TG] Sender Name        │
 * │ Message content here... │
 * │ 10:30 ✓✓                │
 * └─────────────────────────┘
 * 
 * Outgoing (праворуч):
 *               ┌─────────────────────────┐
 *               │ Message content here... │
 *               │ 10:30 ✓✓                │
 *               └─────────────────────────┘
 */
export function MessageBubble({ message, platform }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const isRead = message.status === 'read';
  const isFailed = message.status === 'failed';

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return formatDistanceToNow(date, { addSuffix: true, locale: uk });
    } catch {
      return '';
    }
  };

  const timeStr = formatTime(message.sent_at || message.created_at);

  return (
    <div
      className={cn(
        'flex',
        isOutbound ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-3 py-2 relative',
          isOutbound
            ? 'bg-blue-500 text-white'
            : 'bg-white border border-gray-200',
          !isOutbound && 'pt-4'
        )}
      >
        {/* Platform icon for inbound messages */}
        {!isOutbound && (
          <div className="absolute top-2 left-2 bg-white rounded-full p-0.5 border border-gray-200 z-10">
            <PlatformIcon platform={platform} className="w-3 h-3" />
          </div>
        )}

        {/* Message content */}
        <div className={cn('space-y-2', isOutbound && 'text-white', !isOutbound && 'pl-8')}>
          {/* Text content */}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="space-y-2">
              {message.attachments.map((attachment, index) => (
                <AttachmentPreview
                  key={attachment.id || index}
                  attachment={attachment}
                  isInbound={!isOutbound}
                />
              ))}
            </div>
          )}

          {/* Timestamp and status */}
          <div
            className={cn(
              'flex items-center gap-1 text-xs mt-1',
              isOutbound ? 'text-white/80' : 'text-gray-400'
            )}
          >
            <span>{timeStr}</span>
            {isOutbound && (
              <span className="ml-1">
                {isFailed ? (
                  <span className="text-red-300">✕</span>
                ) : isRead ? (
                  <CheckCheck className="w-3 h-3" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

