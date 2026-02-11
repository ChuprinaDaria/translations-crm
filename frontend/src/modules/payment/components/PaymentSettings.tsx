/**
 * Payment Settings Component
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { paymentApi } from '../api/payment';
import { PaymentProvider, PaymentSettingsUpdate } from '../api/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const PaymentSettings: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['payment-settings'],
    queryFn: () => paymentApi.getSettings(),
  });

  // Form state
  const [formData, setFormData] = useState<PaymentSettingsUpdate>({});

  // Test connection states
  const [stripeTestResult, setStripeTestResult] = useState<boolean | null>(null);
  const [p24TestResult, setP24TestResult] = useState<boolean | null>(null);

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        stripe_enabled: settings.stripe_enabled,
        stripe_public_key: settings.stripe_public_key,
        stripe_secret_key: settings.stripe_secret_key,
        stripe_webhook_secret: settings.stripe_webhook_secret,
        przelewy24_enabled: settings.przelewy24_enabled,
        przelewy24_merchant_id: settings.przelewy24_merchant_id,
        przelewy24_pos_id: settings.przelewy24_pos_id,
        przelewy24_crc: settings.przelewy24_crc,
        przelewy24_api_key: settings.przelewy24_api_key,
        przelewy24_sandbox: settings.przelewy24_sandbox,
        default_currency: settings.default_currency,
        active_payment_provider: settings.active_payment_provider,
      });
    }
  }, [settings]);

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: (data: PaymentSettingsUpdate) => paymentApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
      toast.success(t('payment.settings.updated'));
    },
    onError: (error: any) => {
      toast.error(t('payment.settings.updateError'), {
        description: error.response?.data?.detail || error.message,
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: (provider: PaymentProvider) => paymentApi.testConnection(provider),
    onSuccess: (data) => {
      if (data.provider === PaymentProvider.STRIPE) {
        setStripeTestResult(data.success);
      } else if (data.provider === PaymentProvider.PRZELEWY24) {
        setP24TestResult(data.success);
      }

      if (data.success) {
        toast.success(t('payment.settings.connectionSuccess', { provider: data.provider }));
      } else {
        toast.error(t('payment.settings.connectionFailed', { provider: data.provider }));
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleTestConnection = (provider: PaymentProvider) => {
    testConnectionMutation.mutate(provider);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('payment.settings.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('payment.settings.description')}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="stripe" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="stripe">Stripe</TabsTrigger>
            <TabsTrigger value="przelewy24">Przelewy24</TabsTrigger>
            <TabsTrigger value="general">{t('payment.settings.general')}</TabsTrigger>
          </TabsList>

          {/* Stripe Settings */}
          <TabsContent value="stripe">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Stripe {t('payment.settings.configuration')}</CardTitle>
                    <CardDescription>{t('payment.settings.stripeDescription')}</CardDescription>
                  </div>
                  <Switch
                    checked={formData.stripe_enabled || false}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, stripe_enabled: checked })
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stripe_public_key">{t('payment.settings.publicKey')}</Label>
                  <Input
                    id="stripe_public_key"
                    type="text"
                    placeholder="pk_..."
                    value={formData.stripe_public_key || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, stripe_public_key: e.target.value })
                    }
                    disabled={!formData.stripe_enabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stripe_secret_key">{t('payment.settings.secretKey')}</Label>
                  <Input
                    id="stripe_secret_key"
                    type="password"
                    placeholder="sk_..."
                    value={formData.stripe_secret_key || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, stripe_secret_key: e.target.value })
                    }
                    disabled={!formData.stripe_enabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stripe_webhook_secret">{t('payment.settings.webhookSecret')}</Label>
                  <Input
                    id="stripe_webhook_secret"
                    type="password"
                    placeholder="whsec_..."
                    value={formData.stripe_webhook_secret || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, stripe_webhook_secret: e.target.value })
                    }
                    disabled={!formData.stripe_enabled}
                  />
                </div>

                <Separator />

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleTestConnection(PaymentProvider.STRIPE)}
                    disabled={!formData.stripe_enabled || testConnectionMutation.isPending}
                  >
                    {testConnectionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {t('payment.settings.testConnection')}
                  </Button>

                  {stripeTestResult !== null && (
                    <div className="flex items-center gap-2">
                      {stripeTestResult ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <span className="text-sm text-green-600">{t('payment.settings.connected')}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-500" />
                          <span className="text-sm text-red-600">{t('payment.settings.notConnected')}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Przelewy24 Settings */}
          <TabsContent value="przelewy24">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Przelewy24 {t('payment.settings.configuration')}</CardTitle>
                    <CardDescription>{t('payment.settings.p24Description')}</CardDescription>
                  </div>
                  <Switch
                    checked={formData.przelewy24_enabled || false}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, przelewy24_enabled: checked })
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    {formData.przelewy24_sandbox
                      ? t('payment.settings.sandboxMode')
                      : t('payment.settings.productionMode')}
                  </AlertDescription>
                </Alert>

                <div className="flex items-center gap-2">
                  <Switch
                    id="p24_sandbox"
                    checked={formData.przelewy24_sandbox || false}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, przelewy24_sandbox: checked })
                    }
                    disabled={!formData.przelewy24_enabled}
                  />
                  <Label htmlFor="p24_sandbox">{t('payment.settings.useSandbox')}</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p24_merchant_id">{t('payment.settings.merchantId')}</Label>
                  <Input
                    id="p24_merchant_id"
                    type="number"
                    value={formData.przelewy24_merchant_id || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        przelewy24_merchant_id: parseInt(e.target.value) || undefined,
                      })
                    }
                    disabled={!formData.przelewy24_enabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p24_pos_id">{t('payment.settings.posId')}</Label>
                  <Input
                    id="p24_pos_id"
                    type="number"
                    value={formData.przelewy24_pos_id || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        przelewy24_pos_id: parseInt(e.target.value) || undefined,
                      })
                    }
                    disabled={!formData.przelewy24_enabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p24_crc">{t('payment.settings.crcKey')}</Label>
                  <Input
                    id="p24_crc"
                    type="password"
                    value={formData.przelewy24_crc || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, przelewy24_crc: e.target.value })
                    }
                    disabled={!formData.przelewy24_enabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p24_api_key">{t('payment.settings.apiKey')}</Label>
                  <Input
                    id="p24_api_key"
                    type="password"
                    placeholder={t('payment.settings.reportKey')}
                    value={formData.przelewy24_api_key || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, przelewy24_api_key: e.target.value })
                    }
                    disabled={!formData.przelewy24_enabled}
                  />
                </div>

                <Separator />

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleTestConnection(PaymentProvider.PRZELEWY24)}
                    disabled={!formData.przelewy24_enabled || testConnectionMutation.isPending}
                  >
                    {testConnectionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {t('payment.settings.testConnection')}
                  </Button>

                  {p24TestResult !== null && (
                    <div className="flex items-center gap-2">
                      {p24TestResult ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <span className="text-sm text-green-600">{t('payment.settings.connected')}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-500" />
                          <span className="text-sm text-red-600">{t('payment.settings.notConnected')}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>{t('payment.settings.generalSettings')}</CardTitle>
                <CardDescription>{t('payment.settings.generalDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertDescription>
                    <strong>Важливо:</strong> Оберіть активну систему оплати, яка буде використовуватися для створення посилань на оплату.
                    Система має бути налаштована та увімкнена перед вибором.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <Label htmlFor="active_payment_provider" className="text-base font-semibold">
                    Активна система оплати *
                  </Label>
                  <Select
                    value={formData.active_payment_provider || 'none'}
                    onValueChange={(value) => {
                      if (value === 'none') {
                        setFormData({ ...formData, active_payment_provider: undefined });
                      } else {
                        setFormData({ ...formData, active_payment_provider: value as PaymentProvider });
                      }
                    }}
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Виберіть систему оплати">
                        {formData.active_payment_provider === PaymentProvider.STRIPE && '💳 Stripe'}
                        {formData.active_payment_provider === PaymentProvider.PRZELEWY24 && '🏦 Przelewy24'}
                        {!formData.active_payment_provider && 'Не вибрано'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">Не вибрано</span>
                      </SelectItem>
                      <SelectItem 
                        value={PaymentProvider.STRIPE}
                        disabled={!formData.stripe_enabled || !formData.stripe_secret_key}
                      >
                        <div className="flex items-center gap-2">
                          <span>💳 Stripe</span>
                          {!formData.stripe_enabled || !formData.stripe_secret_key ? (
                            <span className="text-xs text-muted-foreground">(не налаштовано)</span>
                          ) : (
                            <span className="text-xs text-green-600">✓ готово</span>
                          )}
                        </div>
                      </SelectItem>
                      <SelectItem 
                        value={PaymentProvider.PRZELEWY24}
                        disabled={!formData.przelewy24_enabled || !formData.przelewy24_merchant_id}
                      >
                        <div className="flex items-center gap-2">
                          <span>🏦 Przelewy24</span>
                          {!formData.przelewy24_enabled || !formData.przelewy24_merchant_id ? (
                            <span className="text-xs text-muted-foreground">(не налаштовано)</span>
                          ) : (
                            <span className="text-xs text-green-600">✓ готово</span>
                          )}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Система оплати, яка буде використовуватися для створення посилань на оплату. 
                    Обов'язково налаштуйте та увімкніть вибрану систему перед вибором.
                  </p>
                  {(!formData.stripe_enabled || !formData.stripe_secret_key) && 
                   (!formData.przelewy24_enabled || !formData.przelewy24_merchant_id) && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Немає налаштованих систем оплати. Будь ласка, налаштуйте Stripe або Przelewy24 в відповідних закладках.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_currency">{t('payment.settings.defaultCurrency')}</Label>
                  <Input
                    id="default_currency"
                    type="text"
                    maxLength={3}
                    placeholder="PLN"
                    value={formData.default_currency || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, default_currency: e.target.value.toUpperCase() })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('payment.settings.currencyHint')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (settings) {
                setFormData({
                  stripe_enabled: settings.stripe_enabled,
                  stripe_public_key: settings.stripe_public_key,
                  stripe_secret_key: settings.stripe_secret_key,
                  stripe_webhook_secret: settings.stripe_webhook_secret,
                  przelewy24_enabled: settings.przelewy24_enabled,
                  przelewy24_merchant_id: settings.przelewy24_merchant_id,
                  przelewy24_pos_id: settings.przelewy24_pos_id,
                  przelewy24_crc: settings.przelewy24_crc,
                  przelewy24_api_key: settings.przelewy24_api_key,
                  przelewy24_sandbox: settings.przelewy24_sandbox,
                  default_currency: settings.default_currency,
                  active_payment_provider: settings.active_payment_provider,
                });
              }
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PaymentSettings;

