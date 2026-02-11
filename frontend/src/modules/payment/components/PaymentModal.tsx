/**
 * Payment Modal Component - Select provider and amount
 */
import React, { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, Banknote, CheckCircle } from 'lucide-react';
import { paymentApi } from '../api/payment';
import { PaymentProvider, CreatePaymentTransactionRequest } from '../api/types';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  customerEmail: string;
  customerName?: string;
  defaultAmount?: number;
  onSuccess?: (paymentUrl: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  open,
  onClose,
  orderId,
  customerEmail,
  customerName,
  defaultAmount = 0,
  onSuccess,
}) => {
  const { t } = useI18n();

  // Fetch available payment methods
  const { data: methods, isLoading: methodsLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => paymentApi.getAvailableMethods(),
    enabled: open,
  });

  // Form state
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('PLN');

  // Set default provider when methods load
  useEffect(() => {
    if (methods && !provider) {
      if (methods.stripe_enabled) {
        setProvider(PaymentProvider.STRIPE);
      } else if (methods.przelewy24_enabled) {
        setProvider(PaymentProvider.PRZELEWY24);
      }
    }
    if (methods) {
      setCurrency(methods.default_currency);
    }
  }, [methods, provider]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setAmount(defaultAmount);
      setDescription('');
      setProvider(null);
    }
  }, [open, defaultAmount]);

  // Create transaction mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePaymentTransactionRequest) => paymentApi.createTransaction(data),
    onSuccess: (data) => {
      toast.success(t('payment.modal.created'), {
        description: t('payment.modal.redirecting'),
      });

      // Open payment URL
      if (data.payment_url) {
        if (onSuccess) {
          onSuccess(data.payment_url);
        } else {
          window.open(data.payment_url, '_blank');
        }
      }

      onClose();
    },
    onError: (error: any) => {
      toast.error(t('payment.modal.error'), {
        description: error.response?.data?.detail || error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!provider) {
      toast.error(t('payment.modal.selectProvider'));
      return;
    }

    if (amount <= 0) {
      toast.error(t('payment.modal.invalidAmount'));
      return;
    }

    createMutation.mutate({
      order_id: orderId,
      provider,
      amount,
      currency,
      customer_email: customerEmail,
      customer_name: customerName,
      description: description || undefined,
    });
  };

  const availableProviders: { value: PaymentProvider; label: string; icon: React.ReactNode; enabled: boolean }[] = [
    {
      value: PaymentProvider.STRIPE,
      label: 'Stripe',
      icon: <CreditCard className="h-5 w-5" />,
      enabled: methods?.stripe_enabled || false,
    },
    {
      value: PaymentProvider.PRZELEWY24,
      label: 'Przelewy24',
      icon: <Banknote className="h-5 w-5" />,
      enabled: methods?.przelewy24_enabled || false,
    },
  ].filter((p) => p.enabled);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('payment.modal.title')}</DialogTitle>
          <DialogDescription>{t('payment.modal.description')}</DialogDescription>
        </DialogHeader>

        {methodsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : availableProviders.length === 0 ? (
          <Alert variant="destructive">
            <AlertDescription>{t('payment.modal.noProvidersEnabled')}</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4">
              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">{t('payment.modal.amount')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value))}
                    required
                    className="flex-1"
                  />
                  <Input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="w-20"
                    maxLength={3}
                  />
                </div>
              </div>

              {/* Provider Selection */}
              {availableProviders.length > 1 && (
                <div className="space-y-3">
                  <Label>{t('payment.modal.selectProvider')}</Label>
                  <RadioGroup
                    value={provider || undefined}
                    onValueChange={(value) => setProvider(value as PaymentProvider)}
                  >
                    {availableProviders.map((p) => (
                      <div key={p.value} className="flex items-center space-x-3 space-y-0">
                        <RadioGroupItem value={p.value} id={p.value} />
                        <Label
                          htmlFor={p.value}
                          className="flex items-center gap-2 font-normal cursor-pointer"
                        >
                          {p.icon}
                          <span>{p.label}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">{t('payment.modal.description')} ({t('common.optional')})</Label>
                <Textarea
                  id="description"
                  placeholder={t('payment.modal.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Customer Info */}
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  <p>
                    <strong>{t('payment.modal.customer')}:</strong> {customerName || customerEmail}
                  </p>
                  <p>
                    <strong>{t('payment.modal.email')}:</strong> {customerEmail}
                  </p>
                </div>
              </div>

              {/* Selected provider info */}
              {provider && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {provider === PaymentProvider.STRIPE
                      ? t('payment.modal.stripeInfo')
                      : t('payment.modal.p24Info')}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !provider}>
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t('payment.modal.createPayment')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;

