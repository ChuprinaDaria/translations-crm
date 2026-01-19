import React, { useState, useEffect } from 'react';
import { StickyNote, Plus, X, User, FileText, Calendar, DollarSign, Download, Users, Edit, Check, Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '../../../components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Card, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Badge } from '../../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { useI18n } from '../../../lib/i18n';
import { formatDistanceToNow, format } from 'date-fns';
import { pl, uk, enUS, type Locale } from 'date-fns/locale';
import { notesApi, type InternalNote } from '../api/notes';
import { translatorsApi, type Translator } from '../api/translators';
import { ordersApi } from '../api/orders';
import { Order } from './KanbanCard';
import { toast } from 'sonner';

export interface Note {
  id: string;
  text: string;
  created_by: string;
  created_at: string;
}

interface OrderTranslator {
  id: string;
  translatorId: number;
  translatorName: string;
  rate: number;
}

interface OrderNotesSheetProps {
  order: Order;
  trigger?: React.ReactNode;
  defaultTab?: 'notes' | 'details';
  onOrderUpdate?: (order: Order) => void;
}

const localeMap: Record<string, Locale> = {
  pl,
  uk,
  en: enUS,
};

// Типи перекладів
const TRANSLATION_TYPES = [
  { value: 'zwykle', label: 'Zwykłe (звичайний)' },
  { value: 'przysiegle', label: 'Przysięgłe (присяжний)' },
  { value: 'ustne', label: 'Ustne (усний)' },
  { value: 'ekspresowe', label: 'Ekspresowe (терміновий)' },
];

// Мови
const LANGUAGES = [
  { value: 'uk', label: 'Українська' },
  { value: 'pl', label: 'Польська' },
  { value: 'en', label: 'Англійська' },
  { value: 'de', label: 'Німецька' },
  { value: 'ru', label: 'Російська' },
  { value: 'fr', label: 'Французька' },
];

export function OrderNotesSheet({
  order,
  trigger,
  defaultTab = 'notes',
  onOrderUpdate,
}: OrderNotesSheetProps) {
  const { t, language } = useI18n();
  const currentLanguage = language || 'pl';
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [newNote, setNewNote] = useState<string>('');
  const [notesList, setNotesList] = useState<Note[]>([]);
  
  // Editable fields
  const [isEditing, setIsEditing] = useState(false);
  const [editDeadline, setEditDeadline] = useState('');
  const [editTranslationType, setEditTranslationType] = useState('');
  const [editLanguage, setEditLanguage] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  
  // Translators
  const [availableTranslators, setAvailableTranslators] = useState<Translator[]>([]);
  const [orderTranslators, setOrderTranslators] = useState<OrderTranslator[]>([]);
  const [selectedTranslatorId, setSelectedTranslatorId] = useState<string>('');
  const [translatorRate, setTranslatorRate] = useState<number>(0);
  const [isLoadingTranslators, setIsLoadingTranslators] = useState(false);

  // Parse files from description
  const parseFilesFromDescription = (description: string | null | undefined): Array<{ name: string; url: string }> => {
    if (!description) return [];
    
    const files: Array<{ name: string; url: string }> = [];
    const filePattern = /Файл:\s*([^\n(]+)\s*\(([^)]+)\)/g;
    let match;
    
    while ((match = filePattern.exec(description)) !== null) {
      files.push({
        name: match[1].trim(),
        url: match[2].trim(),
      });
    }
    
    return files;
  };

  const getImageUrl = (imagePath?: string | null): string | undefined => {
    if (!imagePath) return undefined;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    if (imagePath.startsWith('/api/v1')) {
      return imagePath;
    }
    return `/api/v1/${imagePath}`;
  };

  // Get all files
  const filesFromDescription = parseFilesFromDescription(order.description);
  const allFiles: Array<{ name: string; url: string }> = [];
  
  if (order.file_url) {
    const fileName = order.file_url.split('/').pop() || 'Файл';
    const isInDescription = filesFromDescription.some(f => f.url === order.file_url);
    if (!isInDescription) {
      allFiles.push({ name: fileName, url: order.file_url });
    }
  }
  allFiles.push(...filesFromDescription);

  // Load notes
  const loadNotes = async () => {
    try {
      const internalNotes = await notesApi.getNotes('order', order.id);
      setNotesList(internalNotes.map((note: InternalNote) => ({
        id: note.id.toString(),
        text: note.text,
        created_by: note.author_name,
        created_at: note.created_at,
      })));
    } catch (error) {
      console.error('Error loading notes:', error);
      setNotesList([]);
    }
  };

  // Load translators
  const loadTranslators = async () => {
    setIsLoadingTranslators(true);
    try {
      const translators = await translatorsApi.getTranslators({ status: 'active' });
      setAvailableTranslators(translators);
      
      // Load order translators from translation requests
      const requests = await translatorsApi.getOrderTranslationRequests(order.id);
      const acceptedTranslators = requests
        .filter(req => req.status === 'accepted')
        .map(req => ({
          id: String(req.id),
          translatorId: req.translator_id,
          translatorName: req.translator?.name || `ID: ${req.translator_id}`,
          rate: req.offered_rate,
        }));
      setOrderTranslators(acceptedTranslators);
    } catch (error) {
      console.error('Error loading translators:', error);
    } finally {
      setIsLoadingTranslators(false);
    }
  };

  useEffect(() => {
    if (open && order.id) {
      loadNotes();
      loadTranslators();
      setNewNote('');
      setEditDeadline(order.deadline ? format(new Date(order.deadline), 'yyyy-MM-dd') : '');
      setEditLanguage(order.language || '');
      // Determine payment status from transactions
      const hasPaid = order.transactions?.some(t => t.type === 'income');
      setPaymentStatus(hasPaid ? 'paid' : 'unpaid');
    }
  }, [open, order.id]);

  const getCurrentUserInfo = () => {
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      if (!token) return null;
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        email: payload.email || payload.sub || 'Unknown',
        name: payload.name || `${payload.first_name || ''} ${payload.last_name || ''}`.trim() || payload.email,
      };
    } catch (error) {
      return null;
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !order.id) return;

    try {
      const createdNote = await notesApi.createNote({
        entity_type: 'order',
        entity_id: order.id,
        text: newNote.trim(),
      });
      
      setNotesList(prev => [...prev, {
        id: createdNote.id.toString(),
        text: createdNote.text,
        created_by: createdNote.author_name,
        created_at: createdNote.created_at,
      }]);
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleRemoveNote = async (noteId: string) => {
    try {
      const noteIdNum = parseInt(noteId);
      if (!isNaN(noteIdNum)) {
        await notesApi.deleteNote(noteIdNum);
      }
      setNotesList(prev => prev.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Error removing note:', error);
    }
  };

  const handleAddTranslator = async () => {
    if (!selectedTranslatorId || translatorRate <= 0) return;
    
    const translator = availableTranslators.find(t => String(t.id) === selectedTranslatorId);
    if (!translator) return;

    try {
      const request = await translatorsApi.createTranslationRequest({
        order_id: order.id,
        translator_id: translator.id,
        sent_via: 'telegram',
        offered_rate: translatorRate,
      });
      
      // Auto-accept
      await translatorsApi.acceptTranslationRequest(request.id);
      
      setOrderTranslators(prev => [...prev, {
        id: String(request.id),
        translatorId: translator.id,
        translatorName: translator.name,
        rate: translatorRate,
      }]);
      
      setSelectedTranslatorId('');
      setTranslatorRate(0);
      toast.success(`Перекладач ${translator.name} призначений`);
    } catch (error) {
      console.error('Error adding translator:', error);
      toast.error('Помилка призначення перекладача');
    }
  };

  const handleRemoveTranslator = (id: string) => {
    setOrderTranslators(prev => prev.filter(t => t.id !== id));
  };

  const handleSaveChanges = async () => {
    try {
      await ordersApi.updateOrder(order.id, {
        deadline: editDeadline ? `${editDeadline}T23:59:59.000Z` : undefined,
      });
      
      toast.success('Зміни збережено');
      setIsEditing(false);
      
      if (onOrderUpdate) {
        onOrderUpdate({
          ...order,
          deadline: editDeadline ? new Date(editDeadline) : order.deadline,
          language: editLanguage || order.language,
        });
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Помилка збереження');
    }
  };

  const getRelativeDate = (dateStr: string) => {
    try {
      const locale = localeMap[currentLanguage] || pl;
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale });
    } catch (error) {
      return new Date(dateStr).toLocaleDateString();
    }
  };

  const formatDate = (date: Date | string) => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return format(d, 'dd.MM.yyyy');
    } catch {
      return '';
    }
  };

  // Auto-set rate when translator selected
  useEffect(() => {
    if (selectedTranslatorId) {
      const translator = availableTranslators.find(t => String(t.id) === selectedTranslatorId);
      if (translator && translator.languages.length > 0) {
        setTranslatorRate(translator.languages[0].rate_per_page || 0);
      }
    }
  }, [selectedTranslatorId, availableTranslators]);

  if (!order.id) {
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
      <SheetContent side="right" className="!w-[380px] !max-w-[380px] !min-w-[380px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4" />
              {order.orderNumber}
            </SheetTitle>
            {activeTab === 'details' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="h-7 px-2"
              >
                <Edit className="w-3 h-3 mr-1" />
                {isEditing ? 'Скасувати' : 'Редагувати'}
              </Button>
            )}
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'notes' | 'details')} className="flex-1 flex flex-col min-h-0 w-full">
          <div className="px-4 pt-2 flex-shrink-0 w-full">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="details" className="text-xs">
                <FileText className="w-3 h-3 mr-1" />
                Деталі
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs">
                <StickyNote className="w-3 h-3 mr-1" />
                Нотатки ({notesList.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 min-h-0 w-full overflow-auto">
            {/* Details Tab */}
            <TabsContent value="details" className="mt-0 px-4 py-3 space-y-3 w-full">
              {/* Client */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Клієнт</Label>
                <p className="font-medium text-sm">{order.clientName}</p>
              </div>

              {/* Deadline */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Термін виконання</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="h-8 text-sm"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{formatDate(order.deadline)}</span>
                  </div>
                )}
              </div>

              {/* Translation Type */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Тип перекладу</Label>
                {isEditing ? (
                  <Select value={editTranslationType} onValueChange={setEditTranslationType}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Виберіть тип" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSLATION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value} className="text-sm">
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">{order.documentType || '-'}</p>
                )}
              </div>

              {/* Language */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Мова</Label>
                {isEditing ? (
                  <Select value={editLanguage} onValueChange={setEditLanguage}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Виберіть мову" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value} className="text-sm">
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">{order.language || '-'}</p>
                )}
              </div>

              {/* Payment Status */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Статус оплати</Label>
                <Badge 
                  variant={paymentStatus === 'paid' ? 'default' : 'destructive'}
                  className={paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                >
                  {paymentStatus === 'paid' ? 'Оплачено' : 'Не оплачено'}
                </Badge>
              </div>

              {/* Translators Section */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-500">Перекладачі</Label>
                  <span className="text-xs text-gray-400">{orderTranslators.length} призначено</span>
                </div>
                
                {/* Assigned translators */}
                {orderTranslators.length > 0 && (
                  <div className="space-y-1">
                    {orderTranslators.map((translator) => (
                      <div key={translator.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-3 h-3 text-gray-500" />
                          <span className="text-xs font-medium">{translator.translatorName}</span>
                          <span className="text-xs text-gray-500">{translator.rate} zł</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTranslator(translator.id)}
                          className="h-5 w-5 p-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add translator */}
                <div className="flex gap-1">
                  <Select value={selectedTranslatorId} onValueChange={setSelectedTranslatorId}>
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue placeholder="Перекладач..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTranslators
                        .filter(t => !orderTranslators.some(ot => ot.translatorId === t.id))
                        .map((translator) => (
                          <SelectItem key={translator.id} value={String(translator.id)} className="text-xs">
                            {translator.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={translatorRate || ''}
                    onChange={(e) => setTranslatorRate(Number(e.target.value))}
                    placeholder="zł"
                    className="w-16 h-7 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddTranslator}
                    disabled={!selectedTranslatorId || translatorRate <= 0}
                    className="h-7 px-2"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Files */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs text-gray-500">Документи ({allFiles.length})</Label>
                {allFiles.length === 0 ? (
                  <p className="text-xs text-gray-400">Немає файлів</p>
                ) : (
                  <div className="space-y-1">
                    {allFiles.map((file, index) => {
                      const fileUrl = getImageUrl(file.url);
                      return (
                        <div key={index} className="flex items-center justify-between bg-gray-50 rounded p-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="w-3 h-3 text-red-500 flex-shrink-0" />
                            <span className="text-xs truncate">{file.name}</span>
                          </div>
                          {fileUrl && (
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" asChild>
                              <a href={fileUrl} download={file.name} target="_blank" rel="noopener noreferrer">
                                <Download className="w-3 h-3" />
                              </a>
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Save button when editing */}
              {isEditing && (
                <Button onClick={handleSaveChanges} className="w-full mt-3" size="sm">
                  <Check className="w-3 h-3 mr-1" />
                  Зберегти зміни
                </Button>
              )}
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-0 px-4 py-3 space-y-3 w-full">
              {/* Existing notes */}
              {notesList.length > 0 && (
                <div className="space-y-2">
                  {notesList.map((note) => (
                    <Card key={note.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-2">
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs whitespace-pre-wrap flex-1">{note.text}</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveNote(note.id)}
                              className="h-5 w-5 p-0 flex-shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 pt-1 border-t">
                            <User className="w-2 h-2" />
                            <span>{note.created_by}</span>
                            <span>•</span>
                            <span>{getRelativeDate(note.created_at)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Add note */}
              <div className="space-y-2">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Введіть нотатку..."
                  rows={3}
                  className="resize-none text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                />
                
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  className="w-full"
                  variant="outline"
                  size="sm"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Додати нотатку
                </Button>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <SheetFooter className="border-t px-4 py-2 flex-shrink-0 w-full">
          <Button variant="outline" onClick={() => setOpen(false)} className="w-full h-8 text-sm">
            Закрити
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
