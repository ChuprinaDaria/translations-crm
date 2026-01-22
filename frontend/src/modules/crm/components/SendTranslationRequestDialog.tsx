import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Mail, MessageSquare, Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { translatorsApi, type Translator, type TranslationRequestCreate } from '../api/translators';

interface SendTranslationRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  documentType?: string;
  language?: string;
  deadline?: Date | string;
  onSuccess?: () => void;
}

export function SendTranslationRequestDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  documentType,
  language,
  deadline,
  onSuccess,
}: SendTranslationRequestDialogProps) {
  const [translators, setTranslators] = useState<Translator[]>([]);
  const [selectedTranslatorId, setSelectedTranslatorId] = useState<string>('');
  const [sentVia, setSentVia] = useState<'email' | 'telegram' | 'whatsapp'>('email');
  const [offeredRate, setOfferedRate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTranslators, setIsLoadingTranslators] = useState(false);

  const selectedTranslator = translators.find(t => t.id.toString() === selectedTranslatorId);

  useEffect(() => {
    if (open) {
      loadTranslators();
    }
  }, [open, language]);

  const loadTranslators = async () => {
    setIsLoadingTranslators(true);
    try {
      const params: { language?: string } = {};
      if (language) {
        // Map language code to Polish name if needed
        const languageMap: Record<string, string> = {
          'uk': 'Ukraiński',
          'pl': 'Polski',
          'en': 'Angielski',
          'de': 'Niemiecki',
          'fr': 'Francuski',
        };
        params.language = languageMap[language] || language;
      }
      
      const data = await translatorsApi.getTranslators({ status: 'active', ...params });
      setTranslators(data);
    } catch (error: any) {
      console.error('Error loading translators:', error);
      toast.error('Помилка завантаження перекладачів');
    } finally {
      setIsLoadingTranslators(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTranslatorId) {
      toast.error('Оберіть перекладача');
      return;
    }

    if (!offeredRate || parseFloat(offeredRate) <= 0) {
      toast.error('Введіть коректну ставку');
      return;
    }

    setIsLoading(true);
    try {
      const request: TranslationRequestCreate = {
        order_id: orderId,
        translator_id: parseInt(selectedTranslatorId),
        sent_via: sentVia,
        offered_rate: parseFloat(offeredRate),
        notes: notes.trim() || undefined,
      };

      await translatorsApi.createTranslationRequest(request);

      toast.success('Запит на переклад відправлено перекладачу');
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      console.error('Error sending translation request:', error);
      toast.error(error?.message || 'Помилка відправки запиту');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTranslatorId('');
    setSentVia('email');
    setOfferedRate('');
    setNotes('');
    onOpenChange(false);
  };

  // Auto-fill rate from translator's language
  useEffect(() => {
    if (selectedTranslator && language && !offeredRate) {
      const lang = selectedTranslator.languages.find(
        l => l.language.toLowerCase().includes(language.toLowerCase()) ||
             language.toLowerCase().includes(l.language.toLowerCase())
      );
      if (lang) {
        setOfferedRate(lang.rate_per_page.toString());
      }
    }
  }, [selectedTranslator, language, offeredRate]);

  const formatDeadline = (deadline?: Date | string) => {
    if (!deadline) return 'Не вказано';
    const d = typeof deadline === 'string' ? new Date(deadline) : deadline;
    return d.toLocaleDateString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            📤 Відправити запит на переклад
          </DialogTitle>
          <DialogDescription>
            Виберіть перекладача та заповніть деталі для відправки запиту на переклад замовлення
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Order Info */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm">
            <div className="font-medium text-gray-900">Інформація про замовлення:</div>
            <div className="grid grid-cols-2 gap-2 text-gray-700">
              <div>
                <span className="text-gray-500">Zlecenie:</span> Nr. {orderNumber}
              </div>
              {documentType && (
                <div>
                  <span className="text-gray-500">Документ:</span> {documentType}
                </div>
              )}
              {language && (
                <div>
                  <span className="text-gray-500">Мова:</span> {language}
                </div>
              )}
              {deadline && (
                <div>
                  <span className="text-gray-500">Дедлайн:</span> {formatDeadline(deadline)}
                </div>
              )}
            </div>
          </div>

          {/* Select Translator */}
          <div className="space-y-2">
            <Label htmlFor="translator-select">
              Оберіть перекладача <span className="text-red-500">*</span>
            </Label>
            {isLoadingTranslators ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Завантаження...</span>
              </div>
            ) : (
              <Select value={selectedTranslatorId} onValueChange={setSelectedTranslatorId} required>
                <SelectTrigger id="translator-select">
                  <SelectValue placeholder="Оберіть перекладача" />
                </SelectTrigger>
                <SelectContent>
                  {translators.length === 0 ? (
                    <SelectItem value="no-translators" disabled>
                      Немає доступних перекладачів
                    </SelectItem>
                  ) : (
                    translators.map((translator) => (
                      <SelectItem key={translator.id} value={translator.id.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <span>{translator.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {translator.rating > 0 && `⭐ ${translator.rating}`}
                            {translator.completed_orders > 0 && ` • ${translator.completed_orders} замовлень`}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            {selectedTranslator && (
              <div className="text-xs text-gray-500 space-y-1">
                <div>📧 {selectedTranslator.email}</div>
                {selectedTranslator.telegram_id && (
                  <div>💬 Telegram: {selectedTranslator.telegram_id}</div>
                )}
                {selectedTranslator.whatsapp && (
                  <div>📱 WhatsApp: {selectedTranslator.whatsapp}</div>
                )}
                {selectedTranslator.languages.length > 0 && (
                  <div className="mt-2">
                    <span className="font-medium">Мови:</span>{' '}
                    {selectedTranslator.languages.map(l => l.language).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Send Via */}
          <div className="space-y-2">
            <Label htmlFor="sent-via">Відправити через</Label>
            <Select value={sentVia} onValueChange={(v) => setSentVia(v as any)}>
              <SelectTrigger id="sent-via">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </div>
                </SelectItem>
                <SelectItem value="telegram">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Telegram
                  </div>
                </SelectItem>
                <SelectItem value="whatsapp">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    WhatsApp
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {selectedTranslator && (
              <div className="text-xs text-gray-500">
                {sentVia === 'email' && selectedTranslator.email && `Буде відправлено на: ${selectedTranslator.email}`}
                {sentVia === 'telegram' && selectedTranslator.telegram_id && `Буде відправлено в: ${selectedTranslator.telegram_id}`}
                {sentVia === 'whatsapp' && selectedTranslator.whatsapp && `Буде відправлено на: ${selectedTranslator.whatsapp}`}
                {!selectedTranslator[sentVia === 'telegram' ? 'telegram_id' : sentVia === 'whatsapp' ? 'whatsapp' : 'email'] && (
                  <span className="text-orange-600">⚠️ У перекладача не вказано {sentVia === 'email' ? 'email' : sentVia === 'telegram' ? 'Telegram' : 'WhatsApp'}</span>
                )}
              </div>
            )}
          </div>

          {/* Offered Rate */}
          <div className="space-y-2">
            <Label htmlFor="offered-rate">
              Гонорар (zł) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="offered-rate"
              type="number"
              step="0.01"
              min="0"
              value={offeredRate}
              onChange={(e) => setOfferedRate(e.target.value)}
              placeholder="60.00"
              required
            />
            {selectedTranslator && language && (
              <div className="text-xs text-gray-500">
                Ставка перекладача для цієї мови: {
                  selectedTranslator.languages.find(
                    l => l.language.toLowerCase().includes(language.toLowerCase()) ||
                         language.toLowerCase().includes(l.language.toLowerCase())
                  )?.rate_per_page || 'не вказано'
                } zł/сторінка
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Додаткові коментарі (опціонально)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Додаткові вимоги, деталі замовлення..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Скасувати
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !selectedTranslatorId || !offeredRate || isLoadingTranslators}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Відправка...
                </>
              ) : (
                <>
                  📤 Відправити запит
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

