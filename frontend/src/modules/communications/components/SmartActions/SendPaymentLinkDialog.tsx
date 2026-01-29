import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Label } from '../../../../components/ui/label';
import { CreditCard, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { inboxApi } from '../../api/inbox';

interface Order {
  id: string;
  order_number: string;
  total_amount?: number;
}

interface SendPaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  onSuccess?: () => void;
}

const PAYMENT_PROVIDERS = [
  { value: 'przelew24', label: 'Przelew24' },
  { value: 'stripe', label: 'Stripe' },
];

export function SendPaymentLinkDialog({
  open,
  onOpenChange,
  orders,
  onSuccess,
}: SendPaymentLinkDialogProps) {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [paymentProvider, setPaymentProvider] = useState('przelew24');
  const [isLoading, setIsLoading] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  const handleGenerate = async () => {
    if (!selectedOrderId) {
      toast.error('Wybierz zlecenie');
      return;
    }

    setIsLoading(true);
    try {
      // Call the API to create payment link
      const response = await inboxApi.createPaymentLink(
        selectedOrderId,
        selectedOrder?.total_amount,
        'pln'
      );

      setPaymentLink(response.payment_link);
      
      toast.success('Лінк на оплату згенеровано');
      onSuccess?.();
    } catch (error: any) {
      console.error('Error generating payment link:', error);
      toast.error(error?.message || 'Помилка генерації лінка');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      toast.success('Лінк скопійовано');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setSelectedOrderId('');
    setPaymentProvider('przelew24');
    setPaymentLink(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            💳 Відправити оплату
          </DialogTitle>
          <DialogDescription className="sr-only">
            Діалогове вікно для відправки посилання на оплату
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Оберіть замовлення */}
          <div className="space-y-2">
            <Label htmlFor="order-select">Wybierz zlecenie</Label>
            <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
              <SelectTrigger id="order-select">
                <SelectValue placeholder="Wybierz zlecenie" />
              </SelectTrigger>
              <SelectContent>
                {orders.length === 0 ? (
                  <SelectItem value="no-orders" disabled>
                    Немає замовлень
                  </SelectItem>
                ) : (
                  orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_number}
                      {order.total_amount && ` - ${order.total_amount.toLocaleString('uk-UA')} ₴`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Провайдер оплати */}
          <div className="space-y-2">
            <Label htmlFor="provider-select">Провайдер оплати</Label>
            <Select value={paymentProvider} onValueChange={setPaymentProvider}>
              <SelectTrigger id="provider-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Згенерований лінк */}
          {paymentLink && (
            <div className="space-y-2">
              <Label>Лінк на оплату</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={paymentLink}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Лінк автоматично відправлено клієнту в чат
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              {paymentLink ? 'Закрити' : 'Скасувати'}
            </Button>
            {!paymentLink && (
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading || !selectedOrderId || orders.length === 0}
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
              >
                {isLoading ? 'Генерація...' : 'Згенерувати та відправити'}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

