import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Card, CardContent } from '../../../components/ui/card';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { notesApi, type InternalNote } from '../api/notes';
import { toast } from 'sonner';

interface ClientNotesProps {
  clientId: string;
  orders?: Array<{
    id: string;
    order_number: string;
  }>;
  className?: string;
}

export function ClientNotes({ clientId, orders = [], className }: ClientNotesProps) {
  const [allNotes, setAllNotes] = useState<InternalNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  useEffect(() => {
    loadAllNotes();
  }, [clientId, orders]);

  const loadAllNotes = async () => {
    setIsLoading(true);
    try {
      // Завантажуємо нотатки клієнта
      const clientNotes = await notesApi.getNotes('client', clientId);
      
      // Завантажуємо нотатки замовлень
      const orderNotesPromises = orders.map(order => 
        notesApi.getNotes('order', order.id)
      );
      const orderNotesArrays = await Promise.all(orderNotesPromises);
      const orderNotes = orderNotesArrays.flat();
      
      setAllNotes([...clientNotes, ...orderNotes]);
    } catch (error) {
      console.error('Error loading notes:', error);
      toast.error('Помилка завантаження нотаток');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error('Введіть текст нотатки');
      return;
    }

    setIsAdding(true);
    try {
      const entityType = selectedOrderId ? 'order' : 'client';
      const entityId = selectedOrderId || clientId;

      await notesApi.createNote({
        entity_type: entityType,
        entity_id: entityId,
        text: newNote.trim(),
      });

      setNewNote('');
      setSelectedOrderId('');
      setShowAddForm(false);
      await loadAllNotes();
      toast.success('Нотатку додано');
    } catch (error: any) {
      console.error('Error adding note:', error);
      toast.error(error?.message || 'Помилка додавання нотатки');
    } finally {
      setIsAdding(false);
    }
  };

  const formatNoteDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const lang = localStorage.getItem('app_language') || 'pl';
    const localeMap: Record<string, string> = {
      pl: 'pl-PL',
      uk: 'uk-UA',
      en: 'en-US',
    };
    return date.toLocaleDateString(localeMap[lang] || 'pl-PL', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  // Групуємо нотатки по замовленнях
  const groupedNotes = orders.reduce((acc, order) => {
    const orderNotes = allNotes.filter(
      note => note.entity_type === 'order' && note.entity_id === order.id
    );
    if (orderNotes.length > 0) {
      acc[order.order_number] = orderNotes;
    }
    return acc;
  }, {} as Record<string, InternalNote[]>);

  const clientNotes = allNotes.filter(
    note => note.entity_type === 'client' && note.entity_id === clientId
  );

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Всі нотатки клієнта ({allNotes.length})
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className="h-7 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Додати нотатку
        </Button>
      </div>

      {showAddForm && (
        <Card className="border-blue-200 bg-blue-50 mb-4">
          <CardContent className="p-3 space-y-2">
            {orders.length > 0 && (
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full text-xs border rounded px-2 py-1.5 mb-2"
              >
                <option value="">До клієнта</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    Zlecenie Nr. {order.order_number}
                  </option>
                ))}
              </select>
            )}
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Введіть нотатку..."
              rows={3}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={isAdding || !newNote.trim()}
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
              >
                {isAdding ? 'Додавання...' : 'Додати'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setNewNote('');
                  setSelectedOrderId('');
                }}
              >
                Скасувати
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-sm text-gray-500 py-4 text-center">Завантаження...</div>
      ) : allNotes.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center">
          Немає нотаток. Додайте першу нотатку.
        </div>
      ) : (
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-4">
            {/* Нотатки клієнта */}
            {clientNotes.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Клієнт:</h4>
                <div className="space-y-2">
                  {clientNotes.map((note) => (
                    <Card key={note.id} className="border-gray-200">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-900">
                            {note.author_name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatNoteDate(note.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{note.text}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Нотатки по замовленнях */}
            {Object.entries(groupedNotes).map(([orderNumber, notes]) => (
              <div key={orderNumber}>
                <h4 className="text-xs font-semibold text-gray-700 mb-2">
                  Zlecenie Nr. {orderNumber}:
                </h4>
                <div className="space-y-2">
                  {notes.map((note) => (
                    <Card key={note.id} className="border-gray-200">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-900">
                            {note.author_name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatNoteDate(note.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{note.text}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

