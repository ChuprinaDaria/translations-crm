import React, { useState, useEffect, useMemo } from 'react';
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
import { LanguageCombobox, type LanguageOption } from '../../../components/ui/language-combobox';
import { useI18n } from '../../../lib/i18n';
import { formatDistanceToNow, format } from 'date-fns';
import { pl, uk, enUS, type Locale } from 'date-fns/locale';
import { notesApi, type InternalNote } from '../api/notes';
import { translatorsApi, type Translator } from '../api/translators';
import { ordersApi } from '../api/orders';
import { languagesApi, type Language } from '../api/languages';
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
  requestId?: number; // ID translation request для оновлення
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

// Типи документів
const DOCUMENT_TYPES = [
  { value: 'trc', label: 'TRC - Присяжний переклад' },
  { value: 'umowa', label: 'Umowa - Договір' },
  { value: 'zaswiadczenie', label: 'Zaświadczenie - Довідка' },
  { value: 'szkolne', label: 'Szkolne - Шкільні документи' },
  { value: 'samochodowe', label: 'Samochodowe - Автомобільні' },
  { value: 'inne', label: 'Inne - Інше' },
];

// Мапінг польських назв на українські
const plToUkrainianName: Record<string, string> = {
  'Ukraiński': 'Українська',
  'Polski': 'Польська',
  'Angielski': 'Англійська',
  'Niemiecki': 'Німецька',
  'Rosyjski': 'Російська',
  'Francuski': 'Французька',
  'Włoski': 'Італійська',
  'Hiszpański': 'Іспанська',
  'Czeski': 'Чеська',
  'Słowacki': 'Словацька',
  'Węgierski': 'Угорська',
  'Rumuński': 'Румунська',
  'Bułgarski': 'Болгарська',
  'Serbski': 'Сербська',
  'Chorwacki': 'Хорватська',
  'Słoweński': 'Словенська',
  'Grecki': 'Грецька',
  'Turecki': 'Турецька',
  'Arabski': 'Арабська',
  'Chiński': 'Китайська',
  'Japoński': 'Японська',
  'Koreański': 'Корейська',
  'Wietnamski': 'В\'єтнамська',
  'Tajski': 'Тайська',
  'Indonezyjski': 'Індонезійська',
  'Hindi': 'Хінді',
  'Portugalski': 'Португальська',
  'Holenderski': 'Голландська',
  'Szwedzki': 'Шведська',
  'Norweski': 'Норвезька',
  'Duński': 'Данська',
  'Fiński': 'Фінська',
  'Estoński': 'Естонська',
  'Łotewski': 'Латвійська',
  'Litewski': 'Литовська',
  'Białoruski': 'Білоруська',
  'Gruziński': 'Грузинська',
  'Ormiański': 'Вірменська',
  'Azerski': 'Азербайджанська',
  'Kazachski': 'Казахська',
  'Uzbecki': 'Узбецька',
  'Hebrajski': 'Іврит',
  'Perski': 'Перська',
};

// Функція для конвертації мов API у формат для Combobox
const convertLanguagesToOptions = (languages: Language[]): LanguageOption[] => {
  return languages.map(lang => ({
    value: lang.name_pl,
    label: plToUkrainianName[lang.name_pl] || lang.name_pl,
    labelPl: lang.name_pl,
  }));
};

// Способи оплати
const PAYMENT_METHODS = [
  { value: 'none', label: 'Не оплачено' },
  { value: 'cash', label: 'Готівка' },
  { value: 'card', label: 'Картка' },
  { value: 'transfer', label: 'Переказ' },
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
  
  // Editable fields (завжди редагувані)
  const [editDeadline, setEditDeadline] = useState('');
  const [editTranslationType, setEditTranslationType] = useState('');
  const [editLanguage, setEditLanguage] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('none');
  const [editClientPrice, setEditClientPrice] = useState<string>('');
  // CSV поля
  const [editPriceNetto, setEditPriceNetto] = useState<string>('');
  const [editPriceBrutto, setEditPriceBrutto] = useState<string>('');
  const [editReferenceCode, setEditReferenceCode] = useState<string>('');
  const [editRepertoriumNumber, setEditRepertoriumNumber] = useState<string>('');
  const [editFollowUpDate, setEditFollowUpDate] = useState<string>('');
  const [editOrderSource, setEditOrderSource] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Languages
  const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
  
  // Translators
  const [availableTranslators, setAvailableTranslators] = useState<Translator[]>([]);
  const [filteredTranslators, setFilteredTranslators] = useState<Translator[]>([]);
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

  // Load languages
  const loadLanguages = async () => {
    setIsLoadingLanguages(true);
    try {
      const languages = await languagesApi.getLanguages();
      const options = convertLanguagesToOptions(languages);
      setAvailableLanguages(options);
    } catch (error) {
      console.error('Error loading languages:', error);
      toast.error('Помилка завантаження мов');
      setAvailableLanguages([]);
    } finally {
      setIsLoadingLanguages(false);
    }
  };

  // Load translators - filtered by selected language if available
  const loadTranslators = async (languageName?: string) => {
    setIsLoadingTranslators(true);
    try {
      const params: { status?: string; language?: string } = { status: 'active' };
      
      // If language is selected, filter translators by that language
      // languageName is Polish name (e.g., "Angielski") from LanguageCombobox
      if (languageName) {
        params.language = languageName;
      }
      
      const translators = await translatorsApi.getTranslators(params);
      setAvailableTranslators(translators);
      setFilteredTranslators(translators);
      
      // Load order translators from translation requests
      const requests = await translatorsApi.getOrderTranslationRequests(order.id);
      const acceptedTranslators = requests
        .filter(req => req.status === 'accepted')
        .map(req => ({
          id: String(req.id),
          translatorId: req.translator_id,
          translatorName: req.translator?.name || `ID: ${req.translator_id}`,
          rate: req.offered_rate,
          requestId: req.id,
        }));
      setOrderTranslators(acceptedTranslators);
    } catch (error) {
      console.error('Error loading translators:', error);
      toast.error('Помилка завантаження перекладачів');
    } finally {
      setIsLoadingTranslators(false);
    }
  };

  // Auto-filter translators when language changes
  useEffect(() => {
    if (open && order.id) {
      if (editLanguage) {
        loadTranslators(editLanguage);
      } else {
        // If no language selected, show all active translators
        loadTranslators();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editLanguage, open, order.id]);

  useEffect(() => {
    if (open && order.id) {
      loadNotes();
      loadLanguages();
      // Завжди завантажуємо актуальні дані перекладачів з API
      loadTranslators();
      setNewNote('');
      setHasChanges(false);
      
      // Завантажуємо актуальні дані замовлення з API для отримання правильних значень
      const loadOrderData = async () => {
        try {
          const updatedOrder = await ordersApi.getOrder(order.id);
          setEditDeadline(updatedOrder.deadline ? format(new Date(updatedOrder.deadline), 'yyyy-MM-dd') : '');
          
          // Convert language code to Polish name if needed
          let orderLanguage = (updatedOrder as any).language || '';
          if (orderLanguage) {
            // Check if it's a code (uk, pl, en) or already a Polish name
            const codeToPolish: Record<string, string> = {
              'uk': 'Ukraiński',
              'pl': 'Polski',
              'en': 'Angielski',
              'de': 'Niemiecki',
              'ru': 'Rosyjski',
              'fr': 'Francuski',
              'it': 'Włoski',
              'es': 'Hiszpański',
            };
            // If it's a code, convert to Polish name; otherwise use as is
            orderLanguage = codeToPolish[orderLanguage.toLowerCase()] || orderLanguage;
          }
          setEditLanguage(orderLanguage);
          setEditTranslationType((updatedOrder as any).translation_type || updatedOrder.description || '');
          
          // Payment method from order or determine from transactions
          const orderPaymentMethod = (updatedOrder as any).payment_method;
          if (orderPaymentMethod) {
            setEditPaymentMethod(orderPaymentMethod);
          } else {
            const hasPaid = updatedOrder.transactions?.some((t: any) => t.type === 'income');
            setEditPaymentMethod(hasPaid ? 'transfer' : 'none');
          }
          
          // Client price from transactions
          const clientPayment = updatedOrder.transactions
            ?.filter((t: any) => t.type === 'income')
            .reduce((sum: number, t: any) => sum + t.amount, 0) || 0;
          setEditClientPrice(clientPayment > 0 ? clientPayment.toString() : '');
          
          // CSV поля
          setEditPriceNetto((updatedOrder as any).price_netto ? String((updatedOrder as any).price_netto) : '');
          setEditPriceBrutto((updatedOrder as any).price_brutto ? String((updatedOrder as any).price_brutto) : '');
          setEditReferenceCode((updatedOrder as any).reference_code || '');
          setEditRepertoriumNumber((updatedOrder as any).repertorium_number || '');
          setEditFollowUpDate((updatedOrder as any).follow_up_date ? format(new Date((updatedOrder as any).follow_up_date), 'yyyy-MM-dd') : '');
          setEditOrderSource((updatedOrder as any).order_source || '');
        } catch (error) {
          console.error('Error loading order data:', error);
          // Fallback to order prop data
          setEditDeadline(order.deadline ? format(new Date(order.deadline), 'yyyy-MM-dd') : '');
          
          // Convert language code to Polish name if needed
          let orderLanguage = (order as any).language || '';
          if (orderLanguage) {
            const codeToPolish: Record<string, string> = {
              'uk': 'Ukraiński',
              'pl': 'Polski',
              'en': 'Angielski',
              'de': 'Niemiecki',
              'ru': 'Rosyjski',
              'fr': 'Francuski',
              'it': 'Włoski',
              'es': 'Hiszpański',
            };
            orderLanguage = codeToPolish[orderLanguage.toLowerCase()] || orderLanguage;
          }
          setEditLanguage(orderLanguage);
          setEditTranslationType((order as any).translation_type || (order as any).documentType || '');
          const orderPaymentMethod = (order as any).payment_method;
          if (orderPaymentMethod) {
            setEditPaymentMethod(orderPaymentMethod);
          } else {
            const hasPaid = order.transactions?.some(t => t.type === 'income');
            setEditPaymentMethod(hasPaid ? 'transfer' : 'none');
          }
          const clientPayment = order.transactions
            ?.filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0) || 0;
          setEditClientPrice(clientPayment > 0 ? clientPayment.toString() : '');
          
          // CSV поля
          setEditPriceNetto((order as any).price_netto ? String((order as any).price_netto) : '');
          setEditPriceBrutto((order as any).price_brutto ? String((order as any).price_brutto) : '');
          setEditReferenceCode((order as any).reference_code || '');
          setEditRepertoriumNumber((order as any).repertorium_number || '');
          setEditFollowUpDate((order as any).follow_up_date ? format(new Date((order as any).follow_up_date), 'yyyy-MM-dd') : '');
          setEditOrderSource((order as any).order_source || '');
        }
      };
      
      loadOrderData();
    }
  }, [open, order.id]);

  // Синхронізуємо термін виконання при зміні order.deadline
  useEffect(() => {
    if (order.deadline) {
      setEditDeadline(format(new Date(order.deadline), 'yyyy-MM-dd'));
    }
  }, [order.deadline]);

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
        requestId: request.id,
      }]);
      
      setSelectedTranslatorId('');
      setTranslatorRate(0);
      toast.success(`Перекладач ${translator.name} призначений`);
      
      // Сповіщаємо про оновлення перекладачів для синхронізації з карткою клієнта
      window.dispatchEvent(new CustomEvent('orderTranslatorsUpdated', {
        detail: { orderId: order.id, clientId: order.clientId }
      }));
    } catch (error) {
      console.error('Error adding translator:', error);
      toast.error('Помилка призначення перекладача');
    }
  };

  const handleRemoveTranslator = async (id: string) => {
    const translator = orderTranslators.find(t => t.id === id);
    if (translator?.requestId) {
      try {
        // Відхиляємо запит на бекенді
        await translatorsApi.declineTranslationRequest(translator.requestId, 'Видалено вручну');
      } catch (error) {
        console.error('Error removing translator:', error);
        toast.error('Помилка видалення перекладача');
        return;
      }
    }
    setOrderTranslators(prev => prev.filter(t => t.id !== id));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // Підготовка даних для оновлення
      const updateData: any = {};
      
      if (editDeadline) {
        updateData.deadline = `${editDeadline}T23:59:59.000Z`;
      }
      if (editLanguage) {
        updateData.language = editLanguage;
      }
      if (editTranslationType) {
        updateData.translation_type = editTranslationType;
      }
      if (editPaymentMethod) {
        updateData.payment_method = editPaymentMethod;
        // Якщо оплачено (не 'none'), автоматично змінюємо статус на oplacone
        if (editPaymentMethod !== 'none') {
          updateData.status = 'oplacone';
        }
      }
      
      // Якщо введено ціну клієнта, додаємо її до оновлення
      if (editClientPrice && parseFloat(editClientPrice) > 0) {
        updateData.amount_gross = parseFloat(editClientPrice);
      }
      
      // CSV поля
      if (editPriceNetto) {
        updateData.price_netto = parseFloat(editPriceNetto);
      }
      if (editPriceBrutto) {
        updateData.price_brutto = parseFloat(editPriceBrutto);
      }
      if (editReferenceCode) {
        updateData.reference_code = editReferenceCode;
      }
      if (editRepertoriumNumber) {
        updateData.repertorium_number = editRepertoriumNumber;
      }
      if (editFollowUpDate) {
        updateData.follow_up_date = `${editFollowUpDate}T23:59:59.000Z`;
      }
      if (editOrderSource) {
        updateData.order_source = editOrderSource;
      }

      const updatedOrder = await ordersApi.updateOrder(order.id, updateData);
      
      // Оновлюємо ціни перекладачів, якщо вони змінилися
      for (const translator of orderTranslators) {
        if (translator.requestId && translator.rate > 0) {
          try {
            await translatorsApi.updateTranslationRequest(translator.requestId, {
              offered_rate: translator.rate,
            });
          } catch (error) {
            console.error('Error updating translator rate:', error);
            // Не показуємо помилку, щоб не переривати процес збереження
          }
        }
      }
      
      // Перезавантажуємо перекладачів для отримання актуальних даних
      await loadTranslators();
      
      toast.success('Зміни збережено');
      setHasChanges(false);
      
      // Оновлюємо локальний стан з актуальними даними
      if (updatedOrder.deadline) {
        setEditDeadline(format(new Date(updatedOrder.deadline), 'yyyy-MM-dd'));
      }
      
      // Перезавантажуємо дані з API для отримання актуальних даних перекладачів
      await loadTranslators();
      
      // Якщо змінився payment_method, сповіщаємо FinancePage про необхідність оновлення
      if (editPaymentMethod && editPaymentMethod !== 'none') {
        window.dispatchEvent(new CustomEvent('orderPaymentMethodChanged', {
          detail: { orderId: order.id, paymentMethod: editPaymentMethod }
        }));
      }
      
      // Сповіщаємо про оновлення замовлення для синхронізації з карткою клієнта
      window.dispatchEvent(new CustomEvent('orderUpdated', {
        detail: { orderId: order.id, clientId: order.clientId }
      }));
      
      // Сповіщаємо про оновлення перекладачів
      window.dispatchEvent(new CustomEvent('orderTranslatorsUpdated', {
        detail: { orderId: order.id, clientId: order.clientId }
      }));
      
      if (onOrderUpdate) {
        onOrderUpdate({
          ...order,
          deadline: updatedOrder.deadline ? new Date(updatedOrder.deadline) : order.deadline,
          language: (updatedOrder as any).language || order.language,
          documentType: (updatedOrder as any).translation_type || updatedOrder.description || order.documentType,
          status: editPaymentMethod !== 'none' ? 'PAID' : order.status,
        } as Order);
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Помилка збереження');
    } finally {
      setIsSaving(false);
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

  // Auto-set rate when translator selected - use rate for selected language if available
  useEffect(() => {
    if (selectedTranslatorId && editLanguage) {
      const translator = filteredTranslators.find(t => String(t.id) === selectedTranslatorId);
      if (translator) {
        // Try to find rate for selected language first
        const langRate = translator.languages.find(l => l.language === editLanguage);
        if (langRate) {
          setTranslatorRate(langRate.rate_per_page || 0);
        } else if (translator.languages.length > 0) {
          // Fallback to first available rate
          setTranslatorRate(translator.languages[0].rate_per_page || 0);
        }
      }
    } else if (selectedTranslatorId) {
      // If no language selected, use first available rate
      const translator = availableTranslators.find(t => String(t.id) === selectedTranslatorId);
      if (translator && translator.languages.length > 0) {
        setTranslatorRate(translator.languages[0].rate_per_page || 0);
      }
    }
  }, [selectedTranslatorId, editLanguage, filteredTranslators, availableTranslators]);

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
              Nr. {order.orderNumber}
            </SheetTitle>
            {activeTab === 'details' && hasChanges && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="h-7 px-2"
              >
                {isSaving ? (
                  <>Збереження...</>
                ) : (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Зберегти
                  </>
                )}
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
                <Input
                  type="date"
                  value={editDeadline}
                  onChange={(e) => {
                    setEditDeadline(e.target.value);
                    setHasChanges(true);
                  }}
                  className="h-8 text-sm"
                />
              </div>

              {/* Document Type */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Тип документа</Label>
                <Select 
                  value={editTranslationType} 
                  onValueChange={(value) => {
                    setEditTranslationType(value);
                    setHasChanges(true);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Виберіть тип" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="text-sm">
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Language */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Мова</Label>
                {isLoadingLanguages ? (
                  <div className="h-8 text-xs text-gray-400 flex items-center">
                    Завантаження...
                  </div>
                ) : (
                  <LanguageCombobox
                    value={editLanguage}
                    onValueChange={(value) => {
                      const previousLanguage = editLanguage;
                      setEditLanguage(value);
                      setHasChanges(true);
                      
                      // If language changed, dispatch update event immediately for real-time sync
                      if (value !== previousLanguage && value) {
                        // Dispatch event to notify other components about language change
                        window.dispatchEvent(new CustomEvent('orderLanguageChanged', {
                          detail: { orderId: order.id, language: value, clientId: order.clientId }
                        }));
                      }
                    }}
                    languages={availableLanguages}
                    placeholder="Виберіть мову"
                    searchPlaceholder="Введіть назву мови..."
                    emptyText="Мову не знайдено"
                    triggerClassName="h-8 text-sm"
                    className="w-[280px]"
                  />
                )}
              </div>

              {/* Payment Status */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Статус оплати</Label>
                <Select 
                  value={editPaymentMethod} 
                  onValueChange={(value) => {
                    setEditPaymentMethod(value);
                    setHasChanges(true);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Виберіть спосіб" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value} className="text-sm">
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Client Payment Amount */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Ціна для клієнта (сплачено)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editClientPrice}
                    onChange={(e) => {
                      setEditClientPrice(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="0.00"
                    className="h-8 text-sm"
                  />
                  <span className="text-xs text-gray-500">zł</span>
                </div>
              </div>

              {/* Ціни нетто/брутто */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Ціна нетто</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editPriceNetto}
                      onChange={(e) => {
                        setEditPriceNetto(e.target.value);
                        setHasChanges(true);
                      }}
                      className="h-8 text-sm"
                      placeholder="0.00"
                    />
                    <span className="text-xs text-gray-500">zł</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Ціна брутто</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editPriceBrutto}
                      onChange={(e) => {
                        setEditPriceBrutto(e.target.value);
                        setHasChanges(true);
                      }}
                      className="h-8 text-sm"
                      placeholder="0.00"
                    />
                    <span className="text-xs text-gray-500">zł</span>
                  </div>
                </div>
              </div>

              {/* Reference Code & Repertorium Number */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Код референційний</Label>
                  <Input
                    type="text"
                    value={editReferenceCode}
                    onChange={(e) => {
                      setEditReferenceCode(e.target.value);
                      setHasChanges(true);
                    }}
                    className="h-8 text-sm"
                    placeholder="Kod_ref"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Номер реперторію</Label>
                  <Input
                    type="text"
                    value={editRepertoriumNumber}
                    onChange={(e) => {
                      setEditRepertoriumNumber(e.target.value);
                      setHasChanges(true);
                    }}
                    className="h-8 text-sm"
                    placeholder="Nr_repertorium"
                  />
                </div>
              </div>

              {/* Follow-up Date & Order Source */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Дата повторного контакту</Label>
                  <Input
                    type="date"
                    value={editFollowUpDate}
                    onChange={(e) => {
                      setEditFollowUpDate(e.target.value);
                      setHasChanges(true);
                    }}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Джерело замовлення</Label>
                  <Select 
                    value={editOrderSource} 
                    onValueChange={(value) => {
                      setEditOrderSource(value);
                      setHasChanges(true);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Джерело" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Не вказано</SelectItem>
                      <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="Formularz kontaktowy">Formularz kontaktowy</SelectItem>
                      <SelectItem value="Telegram">Telegram</SelectItem>
                      <SelectItem value="Office visit">Візит в офіс</SelectItem>
                      <SelectItem value="Phone">Телефон</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Users className="w-3 h-3 text-gray-500 flex-shrink-0" />
                          <span className="text-xs font-medium truncate">{translator.translatorName}</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={translator.rate || ''}
                            onChange={(e) => {
                              const newRate = parseFloat(e.target.value) || 0;
                              setOrderTranslators(prev =>
                                prev.map(t =>
                                  t.id === translator.id ? { ...t, rate: newRate } : t
                                )
                              );
                              setHasChanges(true);
                            }}
                            className="h-6 w-20 text-xs ml-auto"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTranslator(translator.id)}
                          className="h-5 w-5 p-0 flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add translator */}
                <div className="space-y-2">
                  <div className="flex gap-1">
                    <Select 
                      value={selectedTranslatorId} 
                      onValueChange={(value) => {
                        setSelectedTranslatorId(value);
                        setHasChanges(true);
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="Перекладач..." />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingTranslators ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            Завантаження...
                          </div>
                        ) : filteredTranslators.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            {editLanguage 
                              ? 'Немає перекладачів для обраної мови' 
                              : 'Виберіть мову для фільтрації перекладачів'}
                          </div>
                        ) : (
                          filteredTranslators
                            .filter(t => !orderTranslators.some(ot => ot.translatorId === t.id))
                            .map((translator) => {
                              // Find translator's rate for selected language
                              const langRate = translator.languages.find(
                                l => l.language === editLanguage
                              );
                              return (
                                <SelectItem key={translator.id} value={String(translator.id)} className="text-xs">
                                  {translator.name}
                                  {langRate && ` (${langRate.rate_per_page} zł)`}
                                </SelectItem>
                              );
                            })
                        )}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={translatorRate || ''}
                      onChange={(e) => {
                        setTranslatorRate(Number(e.target.value));
                        setHasChanges(true);
                      }}
                      placeholder="zł"
                      className="w-20 h-7 text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddTranslator}
                      disabled={!selectedTranslatorId || translatorRate <= 0 || isLoadingTranslators}
                      className="h-7 px-2"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
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
