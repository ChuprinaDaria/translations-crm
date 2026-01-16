import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Textarea } from '../../../../components/ui/textarea';
import { Label } from '../../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { FileText, User, Package } from 'lucide-react';
import { toast } from 'sonner';
import { notesApi } from '../../../crm/api/notes';

interface Order {
  id: string;
  order_number: string;
}

interface AddInternalNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string;
  clientId?: string;
  orders: Order[];
  onSuccess?: () => void;
}

export function AddInternalNoteDialog({
  open,
  onOpenChange,
  conversationId,
  clientId,
  orders,
  onSuccess,
}: AddInternalNoteDialogProps) {
  const [note, setNote] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!note.trim()) {
      toast.error('Введіть текст нотатки');
      return;
    }

    setIsLoading(true);
    try {
      // Визначаємо entity_type та entity_id
      let entityType: 'client' | 'order' | 'chat' | 'payment' = 'chat';
      let entityId = conversationId || '';

      if (selectedOrderId) {
        entityType = 'order';
        entityId = selectedOrderId;
      } else if (clientId) {
        entityType = 'client';
        entityId = clientId;
      } else if (conversationId) {
        entityType = 'chat';
        entityId = conversationId;
      }

      await notesApi.createNote({
        entity_type: entityType,
        entity_id: entityId,
        text: note.trim(),
      });

      toast.success('Нотатку збережено');
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      console.error('Error saving note:', error);
      toast.error(error?.message || 'Помилка збереження нотатки');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setNote('');
    setSelectedOrderId('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            📝 Нотатка
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Прив'язка до замовлення (опціонально) */}
          {orders.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="order-select" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Прив'язати до замовлення (опціонально)
              </Label>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger id="order-select">
                  <SelectValue placeholder="Оберіть замовлення або залиште порожнім" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Не прив'язувати</SelectItem>
                  {orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Текст нотатки */}
          <div className="space-y-2">
            <Label htmlFor="note-content">
              Текст нотатки <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="note-content"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Введіть текст нотатки..."
              rows={6}
              required
            />
            <p className="text-xs text-gray-500">
              Нотатка буде прив'язана до {clientId ? 'клієнта' : 'діалогу'}
              {selectedOrderId && ' та замовлення'}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Скасувати
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !note.trim()}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            >
              {isLoading ? 'Збереження...' : 'Зберегти нотатку'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

