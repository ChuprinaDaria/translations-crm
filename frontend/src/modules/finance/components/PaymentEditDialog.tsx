import React, { useState, useEffect } from 'react';
import { StickyNote, Plus, X, User } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '../../../components/ui/sheet';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Card, CardContent } from '../../../components/ui/card';
import { Payment } from '../api/transactions';
import { savePaymentCustomization, getPaymentCustomization, getCurrentUserInfo, HiddenNote } from '../utils/paymentStorage';
import { useI18n } from '../../../lib/i18n';
import { formatDistanceToNow } from 'date-fns';
import { pl, uk, enUS, type Locale } from 'date-fns/locale';

interface PaymentEditDialogProps {
  payment: Payment;
  onSave?: (payment: Payment) => void;
  trigger?: React.ReactNode;
}

const localeMap: Record<string, Locale> = {
  pl,
  uk,
  en: enUS,
};

export function PaymentEditDialog({ payment, onSave, trigger }: PaymentEditDialogProps) {
  const { t, language } = useI18n();
  
  // Fallback для language якщо не визначено
  const currentLanguage = language || 'pl';
  const [open, setOpen] = useState(false);
  const [newNote, setNewNote] = useState<string>('');
  const [notesList, setNotesList] = useState<HiddenNote[]>([]);

  useEffect(() => {
    if (open && payment?.id) {
      try {
        // Завантажуємо збережені дані
        const customization = getPaymentCustomization(payment.id);
        
        // Спочатку перевіряємо масив нотаток з customization
        if (customization?.hidden_notes && Array.isArray(customization.hidden_notes)) {
          setNotesList(customization.hidden_notes);
        } 
        // Потім перевіряємо hidden_notes_list з payment
        else if (payment.hidden_notes_list && Array.isArray(payment.hidden_notes_list)) {
          setNotesList(payment.hidden_notes_list);
        }
        // Міграція зі старого формату (рядок) до нового (масив)
        else {
          const oldNotes = customization?.hidden_notes || payment.hidden_notes;
          if (oldNotes && typeof oldNotes === 'string') {
            const userInfo = getCurrentUserInfo();
            setNotesList([{
              id: Date.now().toString(),
              text: oldNotes,
              created_by: userInfo?.name || userInfo?.email || 'Unknown',
              created_at: new Date().toISOString(),
            }]);
          } else {
            setNotesList([]);
          }
        }
        setNewNote('');
      } catch (error) {
        console.error('Error loading payment notes:', error);
        setNotesList([]);
        setNewNote('');
      }
    }
  }, [open, payment]);

  const handleAddNote = () => {
    if (!newNote.trim() || !payment?.id) return;

    try {
      const userInfo = getCurrentUserInfo();
      const newNoteObj: HiddenNote = {
        id: Date.now().toString(),
        text: newNote.trim(),
        created_by: userInfo?.name || userInfo?.email || 'Unknown',
        created_at: new Date().toISOString(),
      };

      const updatedNotes = [...notesList, newNoteObj];
      setNotesList(updatedNotes);
      setNewNote('');

      // Зберігаємо одразу
      savePaymentCustomization(payment.id, {
        color: payment.color || null,
        hidden_notes: updatedNotes,
      });
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleRemoveNote = (noteId: string) => {
    if (!payment?.id) return;
    
    try {
      const updatedNotes = notesList.filter(n => n.id !== noteId);
      setNotesList(updatedNotes);

      savePaymentCustomization(payment.id, {
        color: payment.color || null,
        hidden_notes: updatedNotes.length > 0 ? updatedNotes : null,
      });
    } catch (error) {
      console.error('Error removing note:', error);
    }
  };

  const handleSave = () => {
    if (!payment?.id) return;
    
    try {
      savePaymentCustomization(payment.id, {
        color: payment.color || null,
        hidden_notes: notesList.length > 0 ? notesList : null,
      });

      // Для сумісності з Payment interface
      const hiddenNotesString = notesList.length > 0
        ? notesList.map(n => n.text).join('\n\n---\n\n')
        : null;

      const updatedPayment: Payment = {
        ...payment,
        hidden_notes: hiddenNotesString,
        hidden_notes_list: notesList.length > 0 ? notesList : null,
      };

      onSave?.(updatedPayment);
      setOpen(false);
    } catch (error) {
      console.error('Error saving payment:', error);
    }
  };

  const getRelativeDate = (dateStr: string) => {
    try {
      const locale = localeMap[currentLanguage] || pl;
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale });
    } catch (error) {
      console.error('Error formatting date:', error);
      return new Date(dateStr).toLocaleDateString();
    }
  };

  if (!payment?.id) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <StickyNote className="w-3 h-3" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5" />
            {t('finance.payments.editPayment')} - {payment?.order_number || payment?.id || ''}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-6 px-6 py-6 overflow-y-auto">
          {/* Існуючі примітки */}
          {notesList.length > 0 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-base">
                <StickyNote className="w-4 h-4" />
                {t('finance.payments.existingNotes')} ({notesList.length})
              </Label>
              
              <div className="space-y-3">
                {notesList.map((note) => (
                  <Card key={note.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveNote(note.id)}
                            className="h-6 w-6 p-0 flex-shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t">
                          <User className="w-3 h-3" />
                          <span className="font-medium">{note.created_by}</span>
                          <span>•</span>
                          <span>{getRelativeDate(note.created_at)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Додати нову примітку */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base">
              <Plus className="w-4 h-4" />
              {notesList.length > 0 ? t('finance.payments.addNewNote') : t('finance.payments.hiddenNotes')}
            </Label>
            
            <div className="space-y-3">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={t('finance.payments.hiddenNotesPlaceholder')}
                rows={4}
                className="resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
              />
              
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <StickyNote className="w-4 h-4" />
                <span>{t('finance.payments.hiddenNotesHint')}</span>
              </div>
              
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="w-full"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('finance.payments.addNote')}
              </Button>
            </div>
          </div>
        </div>

        <SheetFooter className="border-t px-6 py-4 mt-auto">
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('orderDetails.actions.cancel')}
            </Button>
            <Button onClick={handleSave}>
              {t('orderDetails.actions.save')}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}


