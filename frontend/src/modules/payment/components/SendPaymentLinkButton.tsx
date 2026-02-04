/**
 * Send Payment Link Button - Manager action to send payment link
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Link2, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { paymentApi } from '../api/payment';
import { CreatePaymentLinkRequest, PaymentProvider } from '../api/types';

interface SendPaymentLinkButtonProps {
  orderId: string;
  customerEmail: string;
  customerName?: string;
  defaultAmount?: number;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const SendPaymentLinkButton: React.FC<SendPaymentLinkButtonProps> = ({
  orderId,
  customerEmail,
  customerName,
  defaultAmount = 0,
  variant = 'default',
  size = 'default',
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [linkGenerated, setLinkGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [provider, setProvider] = useState<PaymentProvider>(PaymentProvider.PRZELEWY24);
  const [description, setDescription] = useState('');

  // Create payment link mutation
  const createLinkMutation = useMutation({
    mutationFn: (data: CreatePaymentLinkRequest) => paymentApi.createPaymentLink(data),
    onSuccess: (data) => {
      setLinkGenerated(data.link_url);
      toast.success(t('payment.sendLink.created'), {
        description: t('payment.sendLink.copyOrSend'),
      });
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
    },
    onError: (error: any) => {
      toast.error(t('payment.sendLink.error'), {
        description: error.response?.data?.detail || error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (amount <= 0) {
      toast.error(t('payment.modal.invalidAmount'));
      return;
    }

    createLinkMutation.mutate({
      order_id: orderId,
      provider,
      amount,
      currency: 'PLN',
      customer_email: customerEmail,
      customer_name: customerName,
      description: description || `Payment for order`,
    });
  };

  const handleCopyLink = async () => {
    if (linkGenerated) {
      try {
        await navigator.clipboard.writeText(linkGenerated);
        setCopied(true);
        toast.success(t('payment.sendLink.copied'));
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast.error(t('payment.sendLink.copyError'));
      }
    }
  };

  const handleOpenLink = () => {
    if (linkGenerated) {
      window.open(linkGenerated, '_blank');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setLinkGenerated(null);
    setAmount(defaultAmount);
    setDescription('');
    setCopied(false);
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Send className="h-4 w-4 mr-2" />
        {t('payment.sendLink.button')}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('payment.sendLink.title')}</DialogTitle>
            <DialogDescription>{t('payment.sendLink.description')}</DialogDescription>
          </DialogHeader>

          {!linkGenerated ? (
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="link-amount">{t('payment.modal.amount')} (PLN)</Label>
                  <Input
                    id="link-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value))}
                    required
                  />
                </div>

                {/* Provider */}
                <div className="space-y-2">
                  <Label htmlFor="link-provider">{t('payment.modal.provider')}</Label>
                  <select
                    id="link-provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as PaymentProvider)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value={PaymentProvider.PRZELEWY24}>Przelewy24</option>
                    <option value={PaymentProvider.STRIPE}>Stripe</option>
                  </select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="link-description">
                    {t('payment.modal.description')} ({t('common.optional')})
                  </Label>
                  <Textarea
                    id="link-description"
                    placeholder={t('payment.modal.descriptionPlaceholder')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Customer Info */}
                <Alert>
                  <AlertDescription>
                    <div className="text-sm">
                      <p>
                        <strong>{t('payment.modal.customer')}:</strong>{' '}
                        {customerName || customerEmail}
                      </p>
                      <p>
                        <strong>{t('payment.modal.email')}:</strong> {customerEmail}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={createLinkMutation.isPending}>
                  {createLinkMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  {t('payment.sendLink.generate')}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4 py-4">
              {/* Success message */}
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {t('payment.sendLink.success')}
                </AlertDescription>
              </Alert>

              {/* Generated link */}
              <div className="space-y-2">
                <Label>{t('payment.sendLink.generatedLink')}</Label>
                <div className="flex gap-2">
                  <Input value={linkGenerated} readOnly className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    title={t('payment.sendLink.copyToClipboard')}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t('payment.sendLink.shareInstructions')}
                </p>
              </div>

              <DialogFooter className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  {t('common.close')}
                </Button>
                <Button type="button" onClick={handleOpenLink}>
                  <Link2 className="h-4 w-4 mr-2" />
                  {t('payment.sendLink.openLink')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SendPaymentLinkButton;

