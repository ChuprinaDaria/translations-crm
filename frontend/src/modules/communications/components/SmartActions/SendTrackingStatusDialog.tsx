import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../../../components/ui/radio-group';
import { Package, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { officesApi, type Office } from '../../../crm/api/offices';

interface Order {
  id: string;
  order_number: string;
  tracking_number?: string;
  office_id?: number;
}

interface SendTrackingStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  officeAddress?: string;
  onSuccess?: () => void;
}

export function SendTrackingStatusDialog({
  open,
  onOpenChange,
  orders,
  officeAddress,
  onSuccess,
}: SendTrackingStatusDialogProps) {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [deliveryType, setDeliveryType] = useState<'inpost' | 'pickup'>('inpost');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [office, setOffice] = useState<Office | null>(null);
  const [isLoadingOffice, setIsLoadingOffice] = useState(false);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  // Завантажуємо офіс при виборі замовлення
  useEffect(() => {
    if (selectedOrder?.office_id) {
      loadOffice(selectedOrder.office_id);
    } else if (selectedOrderId && deliveryType === 'pickup') {
      // Якщо офіс не вказано в замовленні, завантажуємо default
      loadDefaultOffice();
    } else {
      setOffice(null);
    }
  }, [selectedOrderId, selectedOrder?.office_id, deliveryType]);

  const loadOffice = async (officeId: number) => {
    setIsLoadingOffice(true);
    try {
      const data = await officesApi.getOffice(officeId);
      setOffice(data);
    } catch (error: any) {
      console.error('Error loading office:', error);
      // Fallback to default office
      loadDefaultOffice();
    } finally {
      setIsLoadingOffice(false);
    }
  };

  const loadDefaultOffice = async () => {
    setIsLoadingOffice(true);
    try {
      const data = await officesApi.getDefaultOffice();
      setOffice(data);
    } catch (error: any) {
      console.error('Error loading default office:', error);
      setOffice(null);
    } finally {
      setIsLoadingOffice(false);
    }
  };

  const formatOfficeMessage = (office: Office | null) => {
    if (!office) {
      return officeAddress || 'Адреса офісу не вказана';
    }
    
    return `✅ Ваше замовлення готове!

Можете забрати за адресою:
📍 ${office.name}
   ${office.address}
   ${office.postal_code} ${office.city}

🕐 Години роботи:
   ${office.working_hours}

📞 Тел: ${office.phone}`;
  };

  // Автозаповнення tracking number якщо є в замовленні
  React.useEffect(() => {
    if (selectedOrder?.tracking_number) {
      setTrackingNumber(selectedOrder.tracking_number);
    }
  }, [selectedOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOrderId) {
      toast.error('Оберіть замовлення');
      return;
    }

    if (deliveryType === 'inpost' && !trackingNumber.trim()) {
      toast.error('Введіть номер треку');
      return;
    }

    setIsLoading(true);
    try {
      let message = '';
      
      if (deliveryType === 'inpost') {
        const trackingLink = `https://inpost.pl/sledzenie-przesylek?number=${trackingNumber}`;
        message = `Ваше замовлення відправлено. Трек: ${trackingLink}`;
      } else {
        message = formatOfficeMessage(office);
      }

      // TODO: Викликати API для відправки повідомлення
      // await inboxApi.sendMessage(conversationId, message);

      toast.success('Повідомлення відправлено клієнту');
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      console.error('Error sending tracking status:', error);
      toast.error(error?.message || 'Помилка відправки повідомлення');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedOrderId('');
    setDeliveryType('inpost');
    setTrackingNumber('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            📦 Відправити статус
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Оберіть замовлення */}
          <div className="space-y-2">
            <Label htmlFor="order-select">Оберіть замовлення</Label>
            <Select value={selectedOrderId} onValueChange={setSelectedOrderId} required>
              <SelectTrigger id="order-select">
                <SelectValue placeholder="Оберіть замовлення" />
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
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Тип доставки */}
          <div className="space-y-2">
            <Label>Тип доставки</Label>
            <RadioGroup value={deliveryType} onValueChange={(v) => setDeliveryType(v as 'inpost' | 'pickup')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inpost" id="inpost" />
                <Label htmlFor="inpost" className="flex items-center gap-2 cursor-pointer">
                  <Package className="w-4 h-4" />
                  InPost (відправлено)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pickup" id="pickup" />
                <Label htmlFor="pickup" className="flex items-center gap-2 cursor-pointer">
                  <MapPin className="w-4 h-4" />
                  Самовивіз (готове)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Номер треку (тільки для InPost) */}
          {deliveryType === 'inpost' && (
            <div className="space-y-2">
              <Label htmlFor="tracking-number">
                Номер треку <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tracking-number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Введіть номер треку InPost"
                required={deliveryType === 'inpost'}
              />
            </div>
          )}

          {/* Прев'ю повідомлення */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <Label className="text-xs text-gray-500 mb-1 block">Прев'ю повідомлення:</Label>
            {isLoadingOffice && deliveryType === 'pickup' ? (
              <p className="text-sm text-gray-400">Завантаження інформації про офіс...</p>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {deliveryType === 'inpost' && trackingNumber ? (
                  <>Ваше замовлення відправлено. Трек: <a href={`https://inpost.pl/sledzenie-przesylek?number=${trackingNumber}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{trackingNumber}</a></>
                ) : deliveryType === 'pickup' ? (
                  formatOfficeMessage(office)
                ) : (
                  <span className="text-gray-400">Введіть дані для прев'ю</span>
                )}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Скасувати
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !selectedOrderId || orders.length === 0 || (deliveryType === 'inpost' && !trackingNumber.trim())}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            >
              {isLoading ? 'Відправка...' : 'Відправити'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

