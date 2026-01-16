import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Card, CardContent } from '../../../components/ui/card';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { cn } from '../../../components/ui/utils';
import { toast } from 'sonner';
import { notesApi, type InternalNote } from '../api/notes';

interface InternalNotesProps {
  entityType: 'client' | 'order' | 'chat' | 'payment';
  entityId: string;
  orderNumber?: string; // Для групування нотаток по замовленнях
  compact?: boolean; // Компактний режим (тільки лічильник + кнопка)
  onNotesChange?: (count: number) => void;
  className?: string;
}

export function InternalNotes({
  entityType,
  entityId,
  orderNumber,
  compact = false,
  onNotesChange,
  className,
}: InternalNotesProps) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [entityType, entityId]);

  useEffect(() => {
    if (onNotesChange) {
      onNotesChange(notes.length);
    }
  }, [notes.length, onNotesChange]);

  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const loadedNotes = await notesApi.getNotes(entityType, entityId);
      setNotes(loadedNotes);
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
      const note = await notesApi.createNote({
        entity_type: entityType,
        entity_id: entityId,
        text: newNote.trim(),
      });
      setNotes([note, ...notes]);
      setNewNote('');
      setShowAddForm(false);
      toast.success('Нотатку додано');
    } catch (error: any) {
      console.error('Error adding note:', error);
      toast.error(error?.message || 'Помилка додавання нотатки');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    try {
      await notesApi.deleteNote(noteId);
      setNotes(notes.filter(n => n.id !== noteId));
      toast.success('Нотатку видалено');
    } catch (error: any) {
      console.error('Error deleting note:', error);
      toast.error(error?.message || 'Помилка видалення нотатки');
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className="h-7 text-xs"
        >
          <MessageSquare className="w-3.5 h-3.5 mr-1" />
          {notes.length > 0 && <span className="mr-1">{notes.length}</span>}
          нотатки
        </Button>
        {showAddForm && (
          <div className="absolute z-50 bg-white border rounded-lg shadow-lg p-3 min-w-[300px]">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Введіть нотатку..."
              rows={3}
              className="text-sm mb-2"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={isAdding || !newNote.trim()}
                className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
              >
                Додати
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setNewNote('');
                }}
              >
                Скасувати
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Internal Notes {notes.length > 0 && `(${notes.length})`}
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
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3 space-y-2">
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
      ) : notes.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center">
          Немає нотаток. Додайте першу нотатку.
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {notes.map((note) => (
              <Card key={note.id} className="border-gray-200">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-900">
                          {note.author_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatNoteDate(note.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{note.text}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNote(note.id)}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

