import React, { useState, useEffect } from 'react';
import { StickyNote, Plus, X, User } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from './ui/sheet';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent } from './ui/card';
import { useI18n } from '../lib/i18n';
import { formatDistanceToNow } from 'date-fns';
import { pl, uk, enUS, type Locale } from 'date-fns/locale';

export interface Note {
  id: string;
  text: string;
  created_by: string;
  created_at: string;
}

interface NotesManagerProps {
  /** Унікальний ідентифікатор об'єкта, до якого додаються нотатки */
  entityId: string;
  /** Назва об'єкта для відображення в заголовку (опціонально) */
  entityName?: string;
  /** Callback для збереження нотаток */
  onSave?: (notes: Note[]) => void;
  /** Callback для завантаження нотаток (якщо не використовується localStorage) */
  onLoad?: () => Promise<Note[]> | Note[];
  /** Кастомна кнопка-тригер (опціонально) */
  trigger?: React.ReactNode;
  /** Розмір іконки кнопки */
  iconSize?: 'sm' | 'md' | 'lg';
  /** Ключ для localStorage (опціонально, за замовчуванням використовується entityId) */
  storageKey?: string;
  /** Функція для отримання інформації про поточного користувача */
  getUserInfo?: () => { email: string; name?: string } | null;
}

const localeMap: Record<string, Locale> = {
  pl,
  uk,
  en: enUS,
};

const STORAGE_PREFIX = 'crm_notes_';

/**
 * Універсальний компонент для додавання та управління примітками
 * Може використовуватися в різних частинах CRM системи
 */
export function NotesManager({
  entityId,
  entityName,
  onSave,
  onLoad,
  trigger,
  iconSize = 'sm',
  storageKey,
  getUserInfo,
}: NotesManagerProps) {
  const { t, language } = useI18n();
  const currentLanguage = language || 'pl';
  const [open, setOpen] = useState(false);
  const [newNote, setNewNote] = useState<string>('');
  const [notesList, setNotesList] = useState<Note[]>([]);

  const storageKeyFinal = storageKey || `${STORAGE_PREFIX}${entityId}`;

  // Функція для отримання інформації про користувача
  const getCurrentUserInfo = () => {
    if (getUserInfo) {
      return getUserInfo();
    }
    // Fallback - отримуємо з токену
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) return null;
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        email: payload.email || payload.sub || 'Unknown',
        name: payload.name || `${payload.first_name || ''} ${payload.last_name || ''}`.trim() || payload.email,
      };
    } catch (error) {
      console.error('Failed to get user info from token:', error);
      return null;
    }
  };

  // Завантаження нотаток
  const loadNotes = async () => {
    try {
      if (onLoad) {
        const notes = await Promise.resolve(onLoad());
        setNotesList(Array.isArray(notes) ? notes : []);
      } else {
        // Завантажуємо з localStorage
        const stored = localStorage.getItem(storageKeyFinal);
        if (stored) {
          const notes = JSON.parse(stored);
          setNotesList(Array.isArray(notes) ? notes : []);
        } else {
          setNotesList([]);
        }
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      setNotesList([]);
    }
  };

  // Збереження нотаток
  const saveNotes = (notes: Note[]) => {
    try {
      if (onSave) {
        onSave(notes);
      } else {
        // Зберігаємо в localStorage
        localStorage.setItem(storageKeyFinal, JSON.stringify(notes));
      }
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  useEffect(() => {
    if (open && entityId) {
      loadNotes();
      setNewNote('');
    }
  }, [open, entityId]);

  const handleAddNote = () => {
    if (!newNote.trim() || !entityId) return;

    try {
      const userInfo = getCurrentUserInfo();
      const newNoteObj: Note = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: newNote.trim(),
        created_by: userInfo?.name || userInfo?.email || 'Unknown',
        created_at: new Date().toISOString(),
      };

      const updatedNotes = [...notesList, newNoteObj];
      setNotesList(updatedNotes);
      setNewNote('');
      saveNotes(updatedNotes);
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleRemoveNote = (noteId: string) => {
    if (!entityId) return;
    
    try {
      const updatedNotes = notesList.filter(n => n.id !== noteId);
      setNotesList(updatedNotes);
      saveNotes(updatedNotes.length > 0 ? updatedNotes : []);
    } catch (error) {
      console.error('Error removing note:', error);
    }
  };

  const handleSave = () => {
    if (!entityId) return;
    
    try {
      saveNotes(notesList);
      setOpen(false);
    } catch (error) {
      console.error('Error saving notes:', error);
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

  if (!entityId) {
    return null;
  }

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const buttonSizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className={`${buttonSizeClasses[iconSize]} p-0`}>
            <StickyNote className={iconSizeClasses[iconSize]} />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5" />
            {entityName 
              ? `${t('finance.payments.editPayment')} - ${entityName}`
              : t('finance.payments.hiddenNotes')
            }
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

