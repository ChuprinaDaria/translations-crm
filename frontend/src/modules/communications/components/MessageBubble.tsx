import React, { useMemo, useState } from 'react';
import { Check, CheckCheck, Plus, Mail, Phone, MapPin, Package, Trash2, Send } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { PlatformIcon } from './PlatformIcon';
import { AttachmentPreview } from './AttachmentPreview';
import { cn } from '../../../components/ui/utils';
import { formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';
import { parseEmailToHtml, sanitizeEmailHtml } from '../utils/emailParser';
import { parseMessageToHtml, hasMarkdown } from '../utils/messageParser';

export interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'html' | 'file' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'voice';
  content: string;
  status: 'queued' | 'sent' | 'read' | 'failed' | 'draft';
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

interface DetectedData {
  type: 'email' | 'phone' | 'amount' | 'address' | 'paczkomat';
  value: string;
  original?: string;
  isPaczkomat?: boolean;
  paczkomatCode?: string;
}

interface MessageBubbleProps {
  message: Message;
  platform: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
  clientId?: string;
  orderId?: string;
  clientEmail?: string; // Email клієнта, якщо вже є
  clientPhone?: string; // Телефон клієнта, якщо вже є
  onAddEmail?: (email: string) => void;
  onAddPhone?: (phone: string) => void;
  onAddFile?: (fileUrl: string, fileName: string) => void;
  onAddFileAutoCreateOrder?: (fileUrl: string, fileName: string) => void; // Create order and add file
  onAddAddress?: (address: string, isPaczkomat: boolean, paczkomatCode?: string) => void; // Add address or paczkomat to order
  onDeleteMessage?: (messageId: string) => void; // Delete message callback
  onSendDraft?: (messageId: string, content: string) => void; // Send draft message to client
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
// Check if content is a placeholder for media (e.g., "[Image: photo.jpg]")
function isMediaPlaceholder(content: string, attachments?: Message['attachments']): boolean {
  if (!content || !attachments || attachments.length === 0) return false;
  
  // Check for common media placeholder patterns
  const placeholderPatterns = [
    /^\[Image:\s*.+\]$/i,
    /^\[Video:\s*.+\]$/i,
    /^\[Audio:\s*.+\]$/i,
    /^\[Document:\s*.+\]$/i,
    /^\[File:\s*.+\]$/i,
    /^\[Sticker\]$/i,
    /^\[Voice\]$/i,
    /^\[Фото\]$/i,
    /^\[Відео\]$/i,
    /^\[Документ\]$/i,
    /^\[Голосове повідомлення\]$/i,
  ];
  
  return placeholderPatterns.some(pattern => pattern.test(content.trim()));
}

// Normalize phone for comparisons
function normalizePhone(phone: string): string {
  return phone.replace(/[\s-()]/g, '').toLowerCase();
}

export const MessageBubble = React.memo(function MessageBubble({ 
  message, 
  platform,
  clientId,
  orderId,
  clientEmail,
  clientPhone,
  onAddEmail,
  onAddPhone,
  onAddFile,
  onAddFileAutoCreateOrder,
  onAddAddress,
  onDeleteMessage,
  onSendDraft,
}: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const isRead = message.status === 'read';
  const isFailed = message.status === 'failed';
  const isDraft = message.status === 'draft';
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  // Auto-detect email, phone, and amounts in inbound messages
  const detectedData: DetectedData[] = useMemo(() => {
    if (isOutbound || !message.content) return [];

    const detected: DetectedData[] = [];

    // Email detection - з дедуплікацією (lowercase)
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = message.content.match(emailRegex);
    if (emails) {
      const uniqueEmails = new Map<string, string>(); // lowercase -> original
      emails.forEach((email) => {
        const lower = email.toLowerCase();
        if (!uniqueEmails.has(lower)) uniqueEmails.set(lower, email);
      });
      uniqueEmails.forEach((original) => {
        detected.push({ type: 'email', value: original });
      });
    }

    // Phone detection - міжнародні формати (ЄС, Україна, Білорусь, Росія, Азія)
    const phonePatterns = [
      /(?:\+48|48)[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g,
      /\+380[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
      /\+375[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
      /\+7[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
      /\+49[\s-]?\d{3,4}[\s-]?\d{6,8}/g,
      /\+33[\s-]?\d[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}/g,
      /\+39[\s-]?\d{2,3}[\s-]?\d{6,8}/g,
      /\+34[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g,
      /\+44[\s-]?\d{4}[\s-]?\d{6}/g,
      /\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{2,4}[\s-]?\d{2,4}[\s-]?\d{0,4}/g,
    ];

    const normalizedPhones = new Map<string, string>(); // normalized -> original
    phonePatterns.forEach((pattern) => {
      const matches = message.content.match(pattern);
      if (!matches) return;
      matches.forEach((phone) => {
        let normalized = phone.replace(/[\s\-\(\)]/g, '');
        const digits = normalized.replace(/\+/g, '');
        if (digits.length < 10 || digits.length > 15) return;

        if (!normalized.startsWith('+')) {
          if (/^[1-9]\d{1,2}/.test(normalized)) normalized = `+${normalized}`;
          else return;
        }

        if (!normalizedPhones.has(normalized)) {
          normalizedPhones.set(normalized, phone);
        }
      });
    });

    normalizedPhones.forEach((original, formatted) => {
      detected.push({ type: 'phone', value: formatted, original });
    });

    // Amount detection (Polish zł format)
    const amountRegex = /(\d+)\s*(zł|zl|złotych|pln)/gi;
    const amounts = message.content.match(amountRegex);
    if (amounts) {
      amounts.forEach((amount) => {
        const value = amount.replace(/[^\d]/g, '');
        const n = parseInt(value);
        if (n > 0 && n < 100000) detected.push({ type: 'amount', value, original: amount });
      });
    }

    // InPost Paczkomat detection
    const paczkomatPattern = /([A-Z]{3,6}\d{0,3}[A-Z]{0,3}),\s*(\d{2}-\d{3})\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?,\s*([^,\n]+)/g;
    let paczkomatMatch;
    while ((paczkomatMatch = paczkomatPattern.exec(message.content)) !== null) {
      const code = paczkomatMatch[1].trim();
      const postalCode = paczkomatMatch[2].trim();
      const city = paczkomatMatch[3].trim().replace(/\*\*/g, '');
      const street = paczkomatMatch[4].trim();
      const fullAddress = `${code}, ${postalCode} ${city}, ${street}`;
      detected.push({
        type: 'paczkomat',
        value: fullAddress,
        original: paczkomatMatch[0],
        isPaczkomat: true,
        paczkomatCode: code,
      });
    }

    // Regular address detection
    const addressPattern = /(\d{2}-\d{3})\s+(?:\*\*)?([^*\n]+?)(?:\*\*)?,\s*([^,\n]+)/g;
    let addressMatch;
    while ((addressMatch = addressPattern.exec(message.content)) !== null) {
      const postalCode = addressMatch[1].trim();
      const city = addressMatch[2].trim().replace(/\*\*/g, '');
      const street = addressMatch[3].trim();

      const beforeAddress = message.content.substring(Math.max(0, addressMatch.index - 30), addressMatch.index);
      const hasPaczkomatCode = /[A-Z]{3,6}\d{0,3}[A-Z]{0,3},/.test(beforeAddress);
      const isAlreadyPaczkomat = detected.some((d) => d.isPaczkomat && d.value.includes(postalCode) && d.value.includes(city));

      if (!hasPaczkomatCode && !isAlreadyPaczkomat) {
        const fullAddress = `${postalCode} ${city}, ${street}`;
        detected.push({
          type: 'address',
          value: fullAddress,
          original: addressMatch[0],
          isPaczkomat: false,
        });
      }
    }

    return detected;
  }, [isOutbound, message.content]);

  const handleAdd = (item: DetectedData) => {
    // Перевіряємо, чи є callback перед викликом
    if (item.type === 'email') {
      if (onAddEmail) {
        onAddEmail(item.value);
        setAddedItems((prev) => {
          const next = new Set(prev);
          next.add(item.value);
          return next;
        });
      }
    } else if (item.type === 'phone') {
      if (onAddPhone) {
        onAddPhone(item.value);
        setAddedItems((prev) => {
          const next = new Set(prev);
          next.add(item.value);
          return next;
        });
      }
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return formatDistanceToNow(date, { addSuffix: true, locale: uk });
    } catch {
      return '';
    }
  };

  const timeStr = useMemo(() => formatTime(message.sent_at || message.created_at), [message.sent_at, message.created_at]);

  // Отримати колір border-l для inline styles (fallback)
  const getBorderLeftColor = (): string | undefined => {
    if (!isOutbound) return undefined;
    
    switch (platform) {
      case 'whatsapp':
        return '#10b981'; // green-500
      case 'telegram':
        return '#0ea5e9'; // sky-500
      case 'email':
        return '#f97316'; // orange-500
      case 'instagram':
        return '#d946ef'; // fuchsia-500
      case 'facebook':
        return '#2563eb'; // blue-600
      default:
        return '#9ca3af'; // gray-400
    }
  };

  // Отримати колір фону для inline styles (fallback) - вихідні повідомлення
  const getManagerMessageBgStyle = (): React.CSSProperties | undefined => {
    if (!isOutbound) return undefined;
    
    const colors: Record<string, string> = {
      whatsapp: 'rgb(220, 252, 231)',    // green-100
      telegram: 'rgb(224, 242, 254)',    // sky-100
      email: 'rgb(255, 237, 213)',       // orange-100
      instagram: 'rgb(250, 232, 255)',   // fuchsia-100
      facebook: 'rgb(219, 234, 254)',    // blue-100
    };
    
    return { backgroundColor: colors[platform] || 'rgb(243, 244, 246)' }; // gray-100
  };

  // Отримати колір фону для inline styles (fallback) - вхідні повідомлення
  const getInboundMessageBgStyle = (): React.CSSProperties | undefined => {
    if (isOutbound) return undefined;
    
    const colors: Record<string, string> = {
      telegram: 'rgb(240, 249, 255)',    // sky-50
      instagram: 'rgb(253, 244, 255)',    // fuchsia-50
      email: 'rgb(255, 251, 235)',       // amber-50
      facebook: 'rgb(239, 246, 255)',    // blue-50
      whatsapp: 'rgb(236, 253, 245)',    // emerald-50
    };
    
    return { backgroundColor: colors[platform] || 'rgb(255, 255, 255)' }; // white
  };

  // Стилі для повідомлень менеджера залежно від платформи
  const getManagerMessageStyles = () => {
    if (!isOutbound) return '';
    
    let styles = '';
    switch (platform) {
      case 'whatsapp':
        styles = 'bg-green-100 border-l-[4px] border-l-green-500 text-gray-900 shadow-sm';
        break;
      case 'telegram':
        styles = 'bg-sky-100 border-l-[4px] border-l-sky-500 text-gray-900 shadow-sm';
        break;
      case 'email':
        styles = 'bg-orange-100 border-l-[4px] border-l-orange-500 text-gray-900 shadow-sm';
        break;
      case 'instagram':
        styles = 'bg-fuchsia-100 border-l-[4px] border-l-fuchsia-500 text-gray-900 shadow-sm';
        break;
      case 'facebook':
        styles = 'bg-blue-100 border-l-[4px] border-l-blue-600 text-gray-900 shadow-sm';
        break;
      default:
        styles = 'bg-gray-100 border-l-[4px] border-l-gray-400 text-gray-900 shadow-sm';
    }
    
    return styles;
  };

  // Стилі для вхідних повідомлень залежно від платформи
  const getInboundMessageStyles = () => {
    let styles = '';
    switch (platform) {
      case 'telegram':
        styles = 'bg-sky-50 border border-sky-300 text-gray-900';
        break;
      case 'instagram':
        styles = 'bg-fuchsia-50 border border-fuchsia-300 text-gray-900';
        break;
      case 'email':
        styles = 'bg-amber-50 border border-amber-300 text-gray-900';
        break;
      case 'facebook':
        styles = 'bg-blue-50 border border-blue-300 text-gray-900';
        break;
      case 'whatsapp':
        styles = 'bg-emerald-50 border border-emerald-300 text-gray-900';
        break;
      default:
        styles = 'bg-white border border-gray-200';
    }
    
    return styles;
  };

  const renderedContent = useMemo(() => {
    if (!message.content) return { kind: 'none' as const };
    if (isMediaPlaceholder(message.content, message.attachments)) return { kind: 'none' as const };

    // Email with HTML content in meta_data
    if (platform === 'email' && message.meta_data?.html_content) {
      return {
        kind: 'html' as const,
        html: sanitizeEmailHtml(message.meta_data.html_content),
        className: 'text-sm prose prose-sm max-w-none prose-a:text-blue-600 prose-a:break-all email-html-content',
      };
    }

    if (platform === 'email' || platform === 'telegram' || hasMarkdown(message.content)) {
      return {
        kind: 'html' as const,
        html: platform === 'email' ? parseEmailToHtml(message.content) : parseMessageToHtml(message.content, platform),
        className: 'text-sm prose prose-sm max-w-none prose-a:text-blue-600 prose-a:break-all',
      };
    }

    return { kind: 'text' as const, text: message.content };
  }, [message.content, message.attachments, message.meta_data, platform]);

  return (
    <div
      className={cn(
        'flex',
        isOutbound ? 'justify-end pr-4' : 'justify-start pl-4'
      )}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-lg px-3 py-2 relative group',
          isOutbound
            ? getManagerMessageStyles()
            : getInboundMessageStyles(),
          !isOutbound && 'pt-4',
          isDraft && 'border-2 border-amber-300 border-dashed'
        )}
        style={isOutbound ? {
          // Fallback: ensure border-l color and background are applied via inline style
          borderLeftWidth: '4px',
          borderLeftColor: getBorderLeftColor(),
          borderLeftStyle: 'solid',
          ...getManagerMessageBgStyle(),
        } : {
          // Fallback: ensure background color is applied via inline style for inbound messages
          ...getInboundMessageBgStyle(),
        }}
      >
        {/* Platform icon for inbound messages */}
        {!isOutbound && (
          <div className="absolute top-2 left-2 bg-white rounded-full p-0.5 border border-gray-200 z-10">
            <PlatformIcon platform={platform} className="w-3 h-3" />
          </div>
        )}

        {/* Delete button - appears on hover */}
        {onDeleteMessage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Ви впевнені, що хочете видалити це повідомлення?')) {
                onDeleteMessage(message.id);
              }
            }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 text-red-500 hover:text-red-700 z-20"
            title="Видалити повідомлення"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}

        {/* Message content */}
        <div className={cn('space-y-2', isOutbound ? 'text-black' : '', !isOutbound && 'pl-8')}>
          {/* Author name for outbound messages (manager identification) */}
          {isOutbound && message.meta_data?.author_display && (
            <div className="text-[10px] font-medium text-gray-600 mb-1">
              {message.meta_data.author_display}
            </div>
          )}
          
          {/* Помітка для повідомлень, відправлених зі стороннього пристрою */}
          {isOutbound && message.meta_data?.sent_from_external_device && (
            <div className="text-[10px] font-medium text-amber-600 mb-1 flex items-center gap-1">
              <span>📱</span>
              <span>wysłane z zewnętrznego urządzenia</span>
            </div>
          )}
          
          {/* Author name for group messages (inbound) */}
          {!isOutbound && message.meta_data?.is_group_message && (
            <div className="text-xs font-medium text-gray-600 mb-1">
              {message.meta_data.telegram_username ? (
                <>@{message.meta_data.telegram_username}</>
              ) : message.meta_data.telegram_user_id ? (
                <>User {message.meta_data.telegram_user_id}</>
              ) : null}
            </div>
          )}
          
          {/* Text content - hide placeholder text for media messages */}
          {renderedContent.kind === 'html' && (
            <div
              className={renderedContent.className}
              dangerouslySetInnerHTML={{ __html: renderedContent.html }}
            />
          )}
          {renderedContent.kind === 'text' && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {renderedContent.text}
            </p>
          )}

          {/* Detected email/phone/address buttons (only for inbound) */}
          {!isOutbound && detectedData.length > 0 && (
            <div className="mt-3 space-y-2">
              {detectedData.map((item, index) => {
                if (item.type === 'amount') return null; // Amounts handled separately
                
                // Перевіряємо, чи email/phone вже є в клієнта
                const alreadyInClient = 
                  (item.type === 'email' && clientEmail && clientEmail.toLowerCase() === item.value.toLowerCase()) ||
                  (item.type === 'phone' && clientPhone && normalizePhone(clientPhone) === normalizePhone(item.value));
                
                // Не показуємо, якщо вже є в клієнта (тільки для email/phone)
                if (alreadyInClient && (item.type === 'email' || item.type === 'phone')) return null;
                
                const isAdded = addedItems.has(item.value);
                // Перевіряємо наявність callback
                const hasCallback = 
                  (item.type === 'email' && onAddEmail) || 
                  (item.type === 'phone' && onAddPhone) ||
                  ((item.type === 'address' || item.type === 'paczkomat') && onAddAddress && orderId);
                
                // Для адрес/пачкоматів потрібен orderId
                if ((item.type === 'address' || item.type === 'paczkomat') && !orderId) return null;
                
                return (
                  <button
                    key={`${item.type}-${index}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isAdded && hasCallback) {
                        if (item.type === 'email' || item.type === 'phone') {
                        handleAdd(item);
                        } else if ((item.type === 'address' || item.type === 'paczkomat') && onAddAddress) {
                          onAddAddress(item.value, item.isPaczkomat || false, item.paczkomatCode);
                          setAddedItems((prev) => {
                            const next = new Set(prev);
                            next.add(item.value);
                            return next;
                          });
                        }
                      }
                    }}
                    disabled={isAdded || !hasCallback}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
                      'transition-all duration-200',
                      isAdded 
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : hasCallback
                        ? 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm hover:shadow cursor-pointer active:scale-95'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                    )}
                    style={{ pointerEvents: isAdded || !hasCallback ? 'none' : 'auto' }}
                  >
                    {item.type === 'email' ? (
                      <Mail className="w-4 h-4" />
                    ) : item.type === 'phone' ? (
                      <Phone className="w-4 h-4" />
                    ) : item.isPaczkomat ? (
                      <Package className="w-4 h-4" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                    <span className="flex-1 text-left truncate">
                      {item.type === 'email' ? item.value : item.original || item.value}
                    </span>
                    {isAdded ? (
                      <span className="text-green-600">✓ Додано</span>
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="space-y-2 max-w-[280px]">
              {message.attachments.map((attachment, index) => {
                const fileKey = attachment.url || attachment.id || `file-${index}`;
                const isFileAdded = addedItems.has(fileKey);
                
                return (
                  <div key={attachment.id || index}>
                    <AttachmentPreview
                      attachment={attachment}
                      isInbound={!isOutbound}
                    />
                    {/* Add to order button for inbound files */}
                    {!isOutbound && attachment.url && (
                      <>
                        {/* If order exists - add to existing order */}
                        {orderId && onAddFile && (
                          <button
                            onClick={() => {
                              onAddFile(attachment.url!, attachment.filename || 'file');
                              setAddedItems((prev) => {
                                const next = new Set(prev);
                                next.add(fileKey);
                                return next;
                              });
                            }}
                            disabled={isFileAdded}
                            className={cn(
                              'w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
                              'transition-all duration-200',
                              isFileAdded
                                ? 'bg-green-100 text-green-700 cursor-default'
                                : 'bg-purple-500 text-white hover:bg-purple-600'
                            )}
                          >
                            {isFileAdded ? (
                              <span>✓ Dodano do zlecenia</span>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                <span>Dodaj do zlecenia</span>
                              </>
                            )}
                          </button>
                        )}
                        {/* If no order but has client - create order and add file */}
                        {!orderId && clientId && onAddFileAutoCreateOrder && (
                          <button
                            onClick={() => {
                              onAddFileAutoCreateOrder(attachment.url!, attachment.filename || 'file');
                              setAddedItems((prev) => {
                                const next = new Set(prev);
                                next.add(fileKey);
                                return next;
                              });
                            }}
                            disabled={isFileAdded}
                            className={cn(
                              'w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
                              'transition-all duration-200',
                              isFileAdded
                                ? 'bg-green-100 text-green-700 cursor-default'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                            )}
                          >
                            {isFileAdded ? (
                              <span>✓ Zlecenie utworzone, plik dodano</span>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                <span>Utwórz zlecenie + dodaj plik</span>
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Draft message - show send button */}
          {isDraft && isOutbound && onSendDraft && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <Button
                size="sm"
                onClick={() => onSendDraft(message.id, message.content)}
                className="w-full bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                Відправити клієнту
              </Button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Це чернетка. Натисніть "Відправити клієнту" для надсилання.
              </p>
            </div>
          )}

          {/* Timestamp and status */}
          {!isDraft && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs mt-1',
                isOutbound ? 'text-gray-600' : 'text-gray-400'
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
          )}
          
          {/* Draft badge */}
          {isDraft && (
            <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
              <span>📝 Чернетка</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

