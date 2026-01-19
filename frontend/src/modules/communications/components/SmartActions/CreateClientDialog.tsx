import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Alert, AlertDescription } from '../../../../components/ui/alert';
import { AlertCircle, User, Mail, Phone, MessageSquare, Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { clientsApi } from '../../../crm/api/clients';
import { inboxApi } from '../../api/inbox';
import type { Conversation } from '../ContextPanel';

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | null;
  onSuccess?: (clientId: string) => void;
}

export function CreateClientDialog({
  open,
  onOpenChange,
  conversation,
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

  // Автозаповнення з conversation
  useEffect(() => {
    if (conversation && open) {

      // Автозаповнення телефону/email з external_id
      if (conversation.platform === 'email') {
        setEmail(conversation.external_id);
      } else if (conversation.platform === 'telegram' || conversation.platform === 'whatsapp') {
        setPhone(conversation.external_id);
        if (conversation.platform === 'telegram') {
          setTelegram(conversation.external_id);
        } else {
          setWhatsapp(conversation.external_id);
        }
      } else if (conversation.platform === 'instagram') {
        setInstagram(conversation.external_id);
      }

      // Якщо є client_name, використовуємо його
      if (conversation.client_name) {
        setName(conversation.client_name);
      }
    }
  }, [conversation, open]);

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
      toast.error(error?.message || 'Помилка створення клієнта');
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

