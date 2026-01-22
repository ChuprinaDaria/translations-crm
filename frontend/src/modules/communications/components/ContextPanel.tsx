import React, { useState } from 'react';
import { User, Phone, Mail, MapPin, Plus, Link, Download, FileText, Package, Calendar, CreditCard, Zap } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { AttachmentPreview } from './AttachmentPreview';
import { OrderCard, type OrderCardData, type OrderNote } from './OrderCard';
import { InternalNotes } from '../../crm/components/InternalNotes';
import { cn } from '../../../components/ui/utils';

export interface Conversation {
  id: string;
  platform: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
  external_id: string;
  subject?: string;
  client_id?: string;
  client_name?: string;
  client_avatar?: string;
}

export interface Client {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  address?: string;
  avatar?: string;
  company_name?: string;
}

interface ContextPanelProps {
  conversation: Conversation | null;
  client?: Client;
  messages?: Array<{
    id: string;
    attachments?: Array<{
      id?: string;
      type: string;
      url?: string;
      filename?: string;
      mime_type?: string;
      size?: number;
      thumbnail_url?: string;
    }>;
  }>;
  orders?: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    total_amount?: number;
    order_number?: string;
    document_type?: string;
    language?: string;
    price?: number;
    translator?: string;
    translator_price?: number;
    deadline?: string | Date;
    progress_steps?: number;
    completed_steps?: number;
    notes?: OrderNote[];
  }>;
  onCreateClient: () => void;
  onLinkClient: () => void;
  onDownloadAllFiles: () => void;
  onViewClientProfile?: (clientId: string) => void;
  // Smart Actions callbacks
  onCreateOrder?: () => void;
  onSendPaymentLink?: () => void;
  onSendTrackingStatus?: () => void;
  onAddInternalNote?: () => void;
}

/**
 * Контекстна панель (правий сайдбар)
 * Tabs:
 * - Інфо (client card або create button)
 * - Файли (grid галерея)
 * - Історія (замовлення якщо client існує)
 */
export function ContextPanel({
  conversation,
  client,
  messages = [],
  orders = [],
  onCreateClient,
  onLinkClient,
  onDownloadAllFiles,
  onViewClientProfile,
  onCreateOrder,
  onSendPaymentLink,
  onSendTrackingStatus,
  onAddInternalNote,
}: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState('info');

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-gray-500">
          <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Оберіть розмову для перегляду контексту</p>
        </div>
      </div>
    );
  }

  // Collect all attachments from messages
  const allAttachments = messages
    .flatMap((msg) => msg.attachments || [])
    .filter((att) => att && att.url);

  return (
    <div className="flex flex-col h-full border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 shrink-0">
        <h3 className="font-semibold text-gray-900">Контекст</h3>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4 shrink-0">
          <TabsTrigger value="info" className="flex-1 text-xs">
            Інфо
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex-1 text-xs">
            <Zap className="w-3 h-3 inline mr-1" />
            Дії
          </TabsTrigger>
          <TabsTrigger value="files" className="flex-1 text-xs">
            Файли {allAttachments.length > 0 && `(${allAttachments.length})`}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 text-xs">
            Історія {orders.length > 0 && `(${orders.length})`}
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex-1 text-xs">
            Нотатки
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {/* Info Tab */}
          <TabsContent value="info" className="p-4 space-y-4 m-0">
            {client ? (
              <Card>
                <CardContent className="p-4">
                  {/* Client Info Card */}
                  <div className="space-y-4">
                    {/* Avatar & Name */}
                    <div className="flex items-center gap-3">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={client.avatar} />
                        <AvatarFallback className="bg-gray-200 text-gray-600">
                          {client.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{client.full_name}</h4>
                        {client.company_name && (
                          <p className="text-sm text-gray-500 truncate">{client.company_name}</p>
                        )}
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2 pt-2 border-t border-gray-200">
                      {client.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="truncate">{client.phone}</span>
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {client.address && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="truncate">{client.address}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {onViewClientProfile && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => onViewClientProfile(client.id)}
                      >
                        <User className="w-4 h-4 mr-2" />
                        Переглянути профіль
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  {/* No Client Linked */}
                  <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <h4 className="font-medium text-gray-900 mb-2">Клієнт не прив'язано</h4>
                  <p className="text-sm text-gray-500 mb-4">
                    Створіть або прив'яжіть клієнта до цієї розмови
                  </p>
                  <div className="space-y-2">
                    <Button
                      onClick={onCreateClient}
                      size="sm"
                      className="w-full bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Створити клієнта
                    </Button>
                    <Button
                      onClick={onLinkClient}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Link className="w-4 h-4 mr-2" />
                      Прив'язати існуючого
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conversation Info */}
            <Card>
              <CardContent className="p-4">
                <h5 className="font-medium text-gray-900 mb-3">Інформація про розмову</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Платформа:</span>
                    <span className="text-gray-900 capitalize">{conversation.platform}</span>
                  </div>
                  {conversation.subject && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Тема:</span>
                      <span className="text-gray-900 truncate ml-2">{conversation.subject}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">ID:</span>
                    <span className="text-gray-900 font-mono text-xs truncate ml-2">
                      {conversation.external_id}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Smart Actions Tab */}
          <TabsContent value="actions" className="p-4 m-0">
            <div className="space-y-3">
              <h5 className="font-medium text-gray-900 mb-3">Швидкі дії</h5>
              
              {/* Створити клієнта */}
              {!client && (
                <Button
                  onClick={onCreateClient}
                  size="sm"
                  className="w-full justify-start bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  ➕ Новий клієнт
                </Button>
              )}

              {/* Створити замовлення */}
              {client && onCreateOrder && (
                <Button
                  onClick={onCreateOrder}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start bg-white text-gray-900 border-gray-200 hover:bg-gray-50 [&_svg]:text-gray-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  📝 Nowe zlecenie
                </Button>
              )}

              {/* Надіслати лінк на оплату */}
              {client && orders.length > 0 && onSendPaymentLink && (
                <Button
                  onClick={onSendPaymentLink}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start bg-white text-gray-900 border-gray-200 hover:bg-gray-50 [&_svg]:text-gray-700"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  💳 Відправити оплату
                </Button>
              )}

              {/* Відправити трек/статус */}
              {client && orders.length > 0 && onSendTrackingStatus && (
                <Button
                  onClick={onSendTrackingStatus}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start bg-white text-gray-900 border-gray-200 hover:bg-gray-50 [&_svg]:text-gray-700"
                >
                  <Package className="w-4 h-4 mr-2" />
                  📦 Відправити статус
                </Button>
              )}

              {/* Додати нотатку */}
              {onAddInternalNote && (
                <Button
                  onClick={onAddInternalNote}
                  size="sm"
                  variant="outline"
                  className="w-full justify-start bg-white text-gray-900 border-gray-200 hover:bg-gray-50 [&_svg]:text-gray-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  📝 Нотатка
                </Button>
              )}

              {!client && !onCreateOrder && !onSendPaymentLink && !onSendTrackingStatus && !onAddInternalNote && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <Zap className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Немає доступних дій</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="p-4 m-0">
            {allAttachments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Download className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-2">Немає файлів</p>
                <p className="text-xs text-gray-400">Файли з цієї розмови з'являться тут</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">
                    Всього файлів: {allAttachments.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDownloadAllFiles}
                    className="h-8 bg-white text-gray-900 border-gray-200 hover:bg-gray-50 [&_svg]:text-gray-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Завантажити всі
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {allAttachments.map((attachment, index) => (
                    <AttachmentPreview
                      key={attachment.id || index}
                      attachment={attachment}
                      isInbound
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="p-4 m-0">
            {!client ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-2">Немає доступу до історії</p>
                <p className="text-xs text-gray-400">Прив'яжіть клієнта для перегляду замовлень</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500 mb-2">Немає замовлень</p>
                <p className="text-xs text-gray-400">Історія замовлень з'явиться тут</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  // Конвертуємо order в OrderCardData формат
                  const orderCardData: OrderCardData = {
                    id: order.id,
                    order_number: order.order_number || order.title,
                    document_type: order.document_type,
                    language: order.language,
                    price: order.price || order.total_amount,
                    translator: order.translator,
                    translator_price: order.translator_price,
                    deadline: order.deadline,
                    status: order.status,
                    progress_steps: order.progress_steps || 7,
                    completed_steps: order.completed_steps || 0,
                    notes: order.notes || [],
                  };
                  
                  return <OrderCard key={order.id} order={orderCardData} />;
                })}
              </div>
            )}
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="p-4 m-0">
            <InternalNotes
              entityType="chat"
              entityId={conversation.id}
            />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

