import { useState, useEffect } from 'react';
import { Check, CheckCheck, Plus, Mail, Phone, MapPin, Package, Trash2 } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { AttachmentPreview } from './AttachmentPreview';
import { cn } from '../../../components/ui/utils';
import { formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';
import { parseEmailToHtml } from '../utils/emailParser';

export interface Message {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'html' | 'file' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'voice';
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

export function MessageBubble({ 
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
}: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const isRead = message.status === 'read';
  const isFailed = message.status === 'failed';
  const [detectedData, setDetectedData] = useState<DetectedData[]>([]);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  // Тимчасово для діагностики
  useEffect(() => {
    if (isOutbound) {
      console.log('🔍 MessageBubble platform:', platform, 'isOutbound:', isOutbound);
    }
  }, [platform, isOutbound]);

  // Функція для нормалізації телефону для порівняння
  const normalizePhone = (phone: string): string => {
    return phone.replace(/[\s-()]/g, '').toLowerCase();
  };

  // Auto-detect email, phone, and amounts in inbound messages
  useEffect(() => {
    if (!isOutbound && message.content) {
      const detected: DetectedData[] = [];

      // Email detection
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      const emails = message.content.match(emailRegex);
      if (emails) {
        emails.forEach(email => {
          detected.push({ type: 'email', value: email });
        });
      }

      // Phone detection (Polish format: +48 or 9 digits)
      const phoneRegex = /(\+48\s?)?(\d{3}[\s-]?\d{3}[\s-]?\d{3}|\d{9})/g;
      const phones = message.content.match(phoneRegex);
      if (phones) {
        phones.forEach(phone => {
          const normalized = phone.replace(/[\s-]/g, '');
          const formatted = normalized.startsWith('+48') ? normalized : `+48${normalized}`;
          detected.push({ 
            type: 'phone', 
            value: formatted,
            original: phone 
          });
        });
      }

      // Amount detection (Polish zł format)
      const amountRegex = /(\d+)\s*(zł|zl|złotych|pln)/gi;
      const amounts = message.content.match(amountRegex);
      if (amounts) {
        amounts.forEach(amount => {
          const value = amount.replace(/[^\d]/g, '');
          if (parseInt(value) > 0 && parseInt(value) < 100000) {
            detected.push({ type: 'amount', value, original: amount });
          }
        });
      }

      // InPost Paczkomat detection (format: WRO01M, WNC01M, etc. - код з 3-6 букв/цифр, потім поштовий індекс, місто, вулиця)
      // Pattern: код (3-6 символів), поштовий індекс (XX-XXX), місто (жирний або звичайний), вулиця з номером
      // Можливі формати:
      // - WRO01M, 51-180 **Wrocław**, Pełczyńska 63
      // - WRO01M, 51-180 Wrocław, Pełczyńska 63
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

      // Regular address detection (поштовий індекс, місто, вулиця)
      // Pattern: поштовий індекс (XX-XXX), місто, вулиця з номером (без коду пачкомату)
      // Перевіряємо, чи це не пачкомат (якщо перед адресою є код пачкомату)
      const addressPattern = /(\d{2}-\d{3})\s+(?:\*\*)?([^*\n]+?)(?:\*\*)?,\s*([^,\n]+)/g;
      let addressMatch;
      while ((addressMatch = addressPattern.exec(message.content)) !== null) {
        const postalCode = addressMatch[1].trim();
        const city = addressMatch[2].trim().replace(/\*\*/g, '');
        const street = addressMatch[3].trim();
        
        // Перевіряємо, чи це не пачкомат (якщо перед адресою є код пачкомату)
        const beforeAddress = message.content.substring(Math.max(0, addressMatch.index - 30), addressMatch.index);
        const hasPaczkomatCode = /[A-Z]{3,6}\d{0,3}[A-Z]{0,3},/.test(beforeAddress);
        
        // Перевіряємо, чи це не вже визначений пачкомат
        const isAlreadyPaczkomat = detected.some(d => d.isPaczkomat && d.value.includes(postalCode) && d.value.includes(city));
        
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

      setDetectedData(detected);
    }
  }, [message.content, isOutbound]);

  const handleAdd = (item: DetectedData) => {
    console.log('handleAdd called:', item, { onAddEmail: !!onAddEmail, onAddPhone: !!onAddPhone });
    
    // Перевіряємо, чи є callback перед викликом
    if (item.type === 'email') {
      if (onAddEmail) {
        console.log('Calling onAddEmail with:', item.value);
        onAddEmail(item.value);
        setAddedItems(new Set(addedItems).add(item.value));
      } else {
        console.warn('onAddEmail callback is not provided');
      }
    } else if (item.type === 'phone') {
      if (onAddPhone) {
        console.log('Calling onAddPhone with:', item.value);
        onAddPhone(item.value);
        setAddedItems(new Set(addedItems).add(item.value));
      } else {
        console.warn('onAddPhone callback is not provided');
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

  const timeStr = formatTime(message.sent_at || message.created_at);

  // Стилі для повідомлень менеджера залежно від платформи
  const getManagerMessageStyles = () => {
    if (!isOutbound) return '';
    
    switch (platform) {
      case 'whatsapp':
        return 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 border-r border-t border-b border-green-200/50 text-gray-900 shadow-sm';
      case 'telegram':
        return 'bg-gradient-to-r from-blue-50 to-sky-50 border-l-4 border-blue-500 border-r border-t border-b border-blue-200/50 text-gray-900 shadow-sm';
      case 'email':
        return 'bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 border-r border-t border-b border-orange-200/50 text-gray-900 shadow-sm';
      case 'instagram':
        return 'bg-gradient-to-r from-fuchsia-50 to-pink-50 border-l-4 border-fuchsia-500 border-r border-t border-b border-fuchsia-200/50 text-gray-900 shadow-sm';
      case 'facebook':
        return 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 border-r border-t border-b border-blue-200/50 text-gray-900 shadow-sm';
      default:
        return 'bg-gradient-to-r from-gray-50 to-slate-50 border-l-4 border-gray-400 border-r border-t border-b border-gray-200/50 text-gray-900 shadow-sm';
    }
  };

  // Стилі для вхідних повідомлень залежно від платформи
  const getInboundMessageStyles = () => {
    switch (platform) {
      case 'telegram':
        return 'bg-sky-50/70 border border-sky-300 text-gray-900';
      case 'instagram':
        return 'bg-fuchsia-50/70 border border-fuchsia-400 text-gray-900';
      case 'email':
        return 'bg-orange-50/70 border border-orange-300 text-gray-900';
      case 'facebook':
        return 'bg-blue-50/70 border border-blue-400 text-gray-900';
      case 'whatsapp':
        return 'bg-emerald-50/70 border border-emerald-300 text-gray-900';
      default:
        return 'bg-white border border-gray-200';
    }
  };

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
          !isOutbound && 'pt-4'
        )}
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
          {message.content && !isMediaPlaceholder(message.content, message.attachments) && (
            platform === 'email' ? (
              <div 
                className="text-sm prose prose-sm max-w-none prose-a:text-blue-600 prose-a:break-all"
                dangerouslySetInnerHTML={{ __html: parseEmailToHtml(message.content) }}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )
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
                          setAddedItems(new Set(addedItems).add(item.value));
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
            <div className="space-y-2">
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
                              setAddedItems(new Set(addedItems).add(fileKey));
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
                              setAddedItems(new Set(addedItems).add(fileKey));
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

          {/* Timestamp and status */}
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
        </div>
      </div>
    </div>
  );
}

