import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { MapPin, Package } from 'lucide-react';
import { toast } from 'sonner';
import { inboxApi } from '../../api/inbox';

interface AddAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  initialAddress?: string;
  initialIsPaczkomat?: boolean;
  initialPaczkomatCode?: string;
  onSuccess?: () => void;
}

export function AddAddressDialog({
  open,
  onOpenChange,
  orderId,
  initialAddress = '',
  initialIsPaczkomat = false,
  initialPaczkomatCode = '',
  onSuccess,
}: AddAddressDialogProps) {
  const [address, setAddress] = useState(initialAddress);
  const [isPaczkomat, setIsPaczkomat] = useState(initialIsPaczkomat);
  const [paczkomatCode, setPaczkomatCode] = useState(initialPaczkomatCode);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address.trim()) {
      toast.error('Введіть адресу або номер пачкомата');
      return;
    }

    if (isPaczkomat && !paczkomatCode.trim()) {
      toast.error('Введіть номер пачкомата');
      return;
    }

    setIsLoading(true);
    try {
      await inboxApi.addAddressToOrder(
        orderId,
        address.trim(),
        isPaczkomat,
        isPaczkomat ? paczkomatCode.trim() : undefined
      );

      toast.success(isPaczkomat ? 'Пачкомат додано до замовлення' : 'Адресу додано до замовлення');
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      console.error('Error adding address:', error);
      const errorMessage = error?.message || error?.data?.detail || 'Помилка додавання адреси';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setAddress(initialAddress);
    setIsPaczkomat(initialIsPaczkomat);
    setPaczkomatCode(initialPaczkomatCode);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Додати адресу доставки
          </DialogTitle>
          <DialogDescription className="sr-only">
            Діалогове вікно для додавання адреси або пачкомата до замовлення
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Тип доставки */}
          <div className="space-y-2">
            <Label>Тип доставки</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!isPaczkomat ? 'default' : 'outline'}
                onClick={() => setIsPaczkomat(false)}
                className="flex-1"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Адреса
              </Button>
              <Button
                type="button"
                variant={isPaczkomat ? 'default' : 'outline'}
                onClick={() => setIsPaczkomat(true)}
                className="flex-1"
              >
                <Package className="w-4 h-4 mr-2" />
                Пачкомат
              </Button>
            </div>
          </div>

          {/* Номер пачкомата */}
          {isPaczkomat && (
            <div className="space-y-2">
              <Label htmlFor="paczkomat-code">
                Номер пачкомата <span className="text-red-500">*</span>
              </Label>
              <Input
                id="paczkomat-code"
                value={paczkomatCode}
                onChange={(e) => setPaczkomatCode(e.target.value.toUpperCase())}
                placeholder="KRA010"
                required
                maxLength={20}
              />
            </div>
          )}

          {/* Адреса */}
          <div className="space-y-2">
            <Label htmlFor="address">
              {isPaczkomat ? 'Адреса пачкомата' : 'Адреса доставки'} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={isPaczkomat ? 'Введіть адресу пачкомата' : 'Введіть повну адресу доставки'}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-[#FF5A00] hover:bg-[#FF5A00]/90">
              {isLoading ? 'Додавання...' : 'Додати'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

