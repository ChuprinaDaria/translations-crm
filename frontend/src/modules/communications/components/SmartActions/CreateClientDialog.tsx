import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, User, Mail, Phone, MessageSquare, Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { clientsApi } from '../../../crm/api/clients';
import { inboxApi, type Message } from '../../api/inbox';
import type { Conversation } from '../ContextPanel';

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | null;
  messages?: Message[]; // Повідомлення для витягування імені
  onSuccess?: (clientId: string) => void;
}

export function CreateClientDialog({
  open,
  onOpenChange,
  conversation,
  messages = [],
  onSuccess,
}: CreateClientDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [existingClient, setExistingClient] = useState<{ id: string; name: string } | null>(null);

  // Функція для витягування імені з повідомлень
  const extractNameFromMessages = (): string | null => {
    if (!messages || messages.length === 0) return null;

    // Шукаємо вхідні повідомлення (від клієнта)
    const inboundMessages = messages.filter(msg => msg.direction === 'inbound');
    
    for (const msg of inboundMessages) {
      const meta = msg.meta_data;
      if (!meta) continue;

      // Для Telegram
      if (conversation?.platform === 'telegram') {
        // Спробувати отримати ім'я з sender_info або метаданих
        if (meta.telegram_username) {
          return meta.telegram_username.startsWith('@') 
            ? meta.telegram_username.substring(1) 
            : meta.telegram_username;
        }
        // Або з name поля в метаданих
        if (meta.name) {
          return meta.name.trim();
        }
        // Або з sender_name
        if (meta.sender_name) {
          return meta.sender_name.trim();
        }
      }

      // Для WhatsApp
      if (conversation?.platform === 'whatsapp') {
        if (meta.whatsapp_profile_name) {
          return meta.whatsapp_profile_name.trim();
        }
        if (meta.name) {
          return meta.name.trim();
        }
      }

      // Для Instagram
      if (conversation?.platform === 'instagram') {
        if (meta.username) {
          return meta.username.startsWith('@') 
            ? meta.username.substring(1) 
            : meta.username;
        }
        if (meta.name) {
          return meta.name.trim();
        }
      }

      // Для Email
      if (conversation?.platform === 'email') {
        if (meta.from_name) {
          return meta.from_name.trim();
        }
        if (meta.sender_name) {
          return meta.sender_name.trim();
        }
        // Якщо немає імені, спробувати витягти з email
        if (conversation.external_id) {
          const emailPart = conversation.external_id.split('@')[0];
          // Капіталізувати першу літеру
          return emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
        }
      }

      // Для Facebook
      if (conversation?.platform === 'facebook') {
        if (meta.name) {
          return meta.name.trim();
        }
        if (meta.sender_name) {
          return meta.sender_name.trim();
        }
      }
    }

    return null;
  };

  // Автозаповнення з conversation та повідомлень
  useEffect(() => {
    if (conversation && open) {
      // Автозаповнення телефону/email з external_id
      if (conversation.platform === 'email') {
        setEmail(conversation.external_id);
      } else if (conversation.platform === 'telegram' || conversation.platform === 'whatsapp') {
        // Для Telegram/WhatsApp - external_id може бути номером телефону або username
        const externalId = conversation.external_id;
        if (externalId.startsWith('+') || /^\d+$/.test(externalId.replace(/\D/g, ''))) {
          // Це номер телефону
          setPhone(externalId);
        } else if (externalId.startsWith('@')) {
          // Це username для Telegram
          setTelegram(externalId);
        } else {
          // Спробувати як номер телефону
          setPhone(externalId);
        }
        
        if (conversation.platform === 'telegram') {
          // Для Telegram: якщо external_id починається з @ або не є числом - це username
          if (conversation.external_id.startsWith('@')) {
            setTelegram(conversation.external_id);
          } else if (!/^\d+$/.test(conversation.external_id)) {
            // Якщо не число - додаємо @
            setTelegram(`@${conversation.external_id}`);
          }
          // Якщо це число (user_id), не встановлюємо telegram username
        } else {
          setWhatsapp(conversation.external_id);
        }
      } else if (conversation.platform === 'instagram') {
        setInstagram(conversation.external_id.startsWith('@') 
          ? conversation.external_id 
          : `@${conversation.external_id}`);
      }

      // Автозаповнення імені
      // 1. Спочатку перевіряємо client_name з conversation
      if (conversation.client_name) {
        setName(conversation.client_name);
      } else {
        // 2. Якщо немає, намагаємося витягти з повідомлень
        const extractedName = extractNameFromMessages();
        if (extractedName) {
          setName(extractedName);
        } else {
          // 3. Якщо все ще немає, використовуємо external_id як основу
          if (conversation.platform === 'telegram' && conversation.external_id.startsWith('@')) {
            setName(conversation.external_id.substring(1));
          } else if (conversation.platform === 'instagram' && conversation.external_id.startsWith('@')) {
            setName(conversation.external_id.substring(1));
          } else if (conversation.platform === 'email') {
            // Для email використовуємо частину до @
            const emailPart = conversation.external_id.split('@')[0];
            setName(emailPart.charAt(0).toUpperCase() + emailPart.slice(1));
          }
        }
      }
    }
  }, [conversation, messages, open]);

  // Перевірка на існуючого клієнта
  // Для Telegram: не перевіряємо по телефону, бо різні Telegram сесії мають різні external_id
  // Перевірка буде на бекенді по external_id
  useEffect(() => {
    // Тільки перевіряємо по телефону якщо це НЕ Telegram з external_id
    if (phone && open && !(conversation?.platform === 'telegram' && conversation?.external_id)) {
      const checkClient = async () => {
        try {
          const result = await clientsApi.searchByPhone(phone);
          if (result.found && result.client) {
            setExistingClient({
              id: result.client.id.toString(),
              name: (result.client as any).name || (result.client as any).full_name || 'Клієнт',
            });
          } else {
            setExistingClient(null);
          }
        } catch (error) {
          // Ігноруємо помилки пошуку
        }
      };
      
      const timeoutId = setTimeout(checkClient, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setExistingClient(null);
    }
  }, [phone, open, conversation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !phone.trim()) {
      toast.error('Заповніть обов\'язкові поля: Ім\'я та Телефон');
      return;
    }

    if (existingClient) {
      toast.error('Клієнт з таким телефоном вже існує');
      return;
    }

    setIsLoading(true);
    try {
      // Визначаємо джерело з платформи conversation
      const source = conversation?.platform || 'manual';
      
      const client = await clientsApi.createClient({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
        source: source, // Telegram, WhatsApp, Email, etc.
        // Pass conversation info for duplicate checking by external_id
        conversation_id: conversation?.id,
        external_id: conversation?.external_id,
        platform: conversation?.platform,
      });

      toast.success(`Клієнт створено успішно (джерело: ${getSourceLabel()})`);
      onSuccess?.(client.id.toString());
      handleClose();
    } catch (error: any) {
      console.error('Error creating client:', error);
      
      // Handle duplicate client error (400 with detail object)
      if (error?.data?.detail) {
        const detail = error.data.detail;
        if (typeof detail === 'object' && detail.type === 'duplicate_client') {
          const message = detail.message || `Клієнт вже існує`;
          toast.error(message);
          // If client_id is provided, we could navigate to that client
          if (detail.client_id) {
            console.log('Duplicate client ID:', detail.client_id);
          }
        } else if (typeof detail === 'string') {
          toast.error(detail);
        } else if (Array.isArray(detail)) {
          // Validation errors
          const firstError = detail[0];
          const errorMsg = firstError?.msg || 'Помилка валідації даних';
          toast.error(errorMsg);
        } else {
          toast.error('Помилка створення клієнта');
        }
      } else if (error?.message) {
        toast.error(error.message);
      } else {
        toast.error('Помилка створення клієнта');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setPhone('');
    setTelegram('');
    setWhatsapp('');
    setInstagram('');
    setExistingClient(null);
    onOpenChange(false);
  };

  const handleOpenExisting = async () => {
    if (existingClient && conversation) {
      try {
        // Прив'язуємо існуючого клієнта до conversation
        await inboxApi.linkClientToConversation(conversation.id, existingClient.id);
        toast.success('Клієнт прив\'язано до розмови');
        onSuccess?.(existingClient.id);
        handleClose();
      } catch (error: any) {
        console.error('Error linking client:', error);
        toast.error(error?.message || 'Помилка прив\'язки клієнта');
      }
    }
  };

  const getSourceLabel = () => {
    if (!conversation) return '';
    const sourceMap: Record<string, string> = {
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      instagram: 'Instagram',
      email: 'Email',
      facebook: 'Facebook',
    };
    return sourceMap[conversation.platform] || conversation.platform;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            ➕ Новий клієнт
          </DialogTitle>
          <DialogDescription className="sr-only">
            Діалогове вікно для створення нового клієнта
          </DialogDescription>
        </DialogHeader>

        {existingClient && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <AlertDescription className="text-sm">
              Клієнт вже існує: <strong>{existingClient.name}</strong>
              <Button
                variant="link"
                size="sm"
                onClick={handleOpenExisting}
                className="h-auto p-0 ml-2 text-orange-600 hover:text-orange-700"
              >
                Відкрити картку клієнта
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Джерело */}
          {conversation && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <Label className="text-xs text-gray-500 mb-1 block">Джерело</Label>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{getSourceLabel()}</span>
              </div>
            </div>
          )}

          {/* Ім'я */}
          <div className="space-y-2">
            <Label htmlFor="client-name">
              Ім'я <span className="text-red-500">*</span>
            </Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введіть ім'я клієнта"
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="client-email">
              <Mail className="w-4 h-4 inline mr-1" />
              Email
            </Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          {/* Телефон */}
          <div className="space-y-2">
            <Label htmlFor="client-phone">
              <Phone className="w-4 h-4 inline mr-1" />
              Телефон <span className="text-red-500">*</span>
            </Label>
            <Input
              id="client-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+48 123 456 789"
              required
            />
          </div>

          {/* Telegram */}
          {conversation?.platform === 'telegram' && (
            <div className="space-y-2">
              <Label htmlFor="client-telegram">
                <MessageSquare className="w-4 h-4 inline mr-1" />
                Telegram
              </Label>
              <Input
                id="client-telegram"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username або +48 123 456 789"
              />
            </div>
          )}

          {/* WhatsApp */}
          {conversation?.platform === 'whatsapp' && (
            <div className="space-y-2">
              <Label htmlFor="client-whatsapp">
                <MessageSquare className="w-4 h-4 inline mr-1" />
                WhatsApp
              </Label>
              <Input
                id="client-whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+48 123 456 789"
              />
            </div>
          )}

          {/* Instagram */}
          {conversation?.platform === 'instagram' && (
            <div className="space-y-2">
              <Label htmlFor="client-instagram">
                <Instagram className="w-4 h-4 inline mr-1" />
                Instagram
              </Label>
              <Input
                id="client-instagram"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@username"
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isLoading || !!existingClient} className="bg-[#FF5A00] hover:bg-[#FF5A00]/90">
              {isLoading ? 'Створення...' : 'Створити клієнта'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

