import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Calendar, DollarSign, MapPin, Truck, Package } from 'lucide-react';
import { toast } from 'sonner';
import { officesApi, type Office } from '../../../crm/api/offices';
import { ordersApi } from '../../../crm/api/orders';
import { getUserIdFromToken } from '../../../notifications/utils/userId';
import { clientsApi } from '../../../crm/api/clients';
import { languagesApi, type Language } from '../../../crm/api/languages';
import { paymentApi } from '../../../payment/api/payment';
import { PaymentProvider } from '../../../payment/api/types';
import { cn } from '@/components/ui/utils';

interface Conversation {
  id: string;
  platform?: 'telegram' | 'whatsapp' | 'email' | 'facebook' | 'instagram';
  external_id?: string;
  subject?: string;
  client_id?: string;
  client_name?: string;
  client_avatar?: string;
}

interface Message {
  id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  meta_data?: Record<string, any>;
}

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSuccess?: (orderId: string) => void;
  conversation?: Conversation | null;
  messages?: Message[];
}

// Типи документів (спрощений список)
const DOCUMENT_TYPES_SIMPLE = [
  { value: 'trc', label: 'TRC - Присяжний переклад', icon: '📜' },
  { value: 'umowa', label: 'Umowa - Договір', icon: '📄' },
  { value: 'zaswiadczenie', label: 'Zaświadczenie - Довідка', icon: '📋' },
  { value: 'szkolne', label: 'Szkolne - Шкільні документи', icon: '🎓' },
  { value: 'samochodowe', label: 'Samochodowe - Автомобільні', icon: '🚗' },
  { value: 'inne', label: 'Inne - Інше', icon: '📁' },
];

// Джерела замовлень
const ORDER_SOURCES = [
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'Email', label: 'Email' },
  { value: 'Formularz kontaktowy', label: 'Formularz kontaktowy' },
  { value: 'Telegram', label: 'Telegram' },
  { value: 'Office visit', label: 'Візит в офіс' },
  { value: 'Phone', label: 'Телефон' },
];

// Способи оплати
const PAYMENT_METHODS = [
  { value: 'none', label: 'Не оплачено' },
  { value: 'cash', label: '💵 Готівка' },
  { value: 'card', label: '💳 Оплата картою' },
  { value: 'payment_link', label: '🔗 Вислано лінк на оплату' },
  { value: 'transfer', label: '🏦 Переказ' },
];

export function CreateOrderDialog({
  open,
  onOpenChange,
  clientId,
  onSuccess,
  conversation,
  messages = [],
}: CreateOrderDialogProps) {
  const [documentType, setDocumentType] = useState('');
  const [customDocumentType, setCustomDocumentType] = useState('');
  const [language, setLanguage] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priceNetto, setPriceNetto] = useState('');
  const [priceBrutto, setPriceBrutto] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('none');
  const [orderSource, setOrderSource] = useState('');
  
  // Delivery method
  const [deliveryMethod, setDeliveryMethod] = useState<'office' | 'inpost_courier' | 'inpost_locker'>('office');
  const [officeId, setOfficeId] = useState<string>('');
  const [offices, setOffices] = useState<Office[]>([]);
  
  // InPost courier fields
  const [courierAddress, setCourierAddress] = useState('');
  const [courierEmail, setCourierEmail] = useState('');
  const [courierPhone, setCourierPhone] = useState('');
  
  // InPost locker fields
  const [lockerNumber, setLockerNumber] = useState('');
  const [lockerEmail, setLockerEmail] = useState('');
  const [lockerPhone, setLockerPhone] = useState('');
  
  // Client data for auto-fill
  const [clientData, setClientData] = useState<{ email?: string; phone?: string } | null>(null);
  
  // Languages from API
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOffices, setIsLoadingOffices] = useState(false);
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);

  // Генерація номера замовлення
  const generateOrderNumber = (): string => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    
    // Код мови (укорочений до 3 символів)
    const langCode = language ? language.substring(0, 3).toLowerCase() : 'unk';
    
    // Унікальний код на основі timestamp та випадкового числа
    const timestamp = Date.now().toString(36).substring(5).toLowerCase();
    const randomCode = Math.random().toString(36).substring(2, 4).toLowerCase();
    
    return `N/${day}/${month}/${year}/${langCode}/${timestamp}${randomCode}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((!documentType && !customDocumentType) || !language) {
      toast.error('Заповніть обов\'язкові поля: тип документа та мова');
      return;
    }
    
    // Валідація полів доставки
    if (deliveryMethod === 'office' && !officeId) {
      toast.error('Оберіть офіс видачі');
      return;
    }
    
    if (deliveryMethod === 'inpost_courier' && !courierAddress) {
      toast.error('Введіть адресу для доставки кур\'єром');
      return;
    }
    
    if (deliveryMethod === 'inpost_locker' && !lockerNumber) {
      toast.error('Введіть номер автомата');
      return;
    }

    // Отримуємо manager_id з токену
    const managerId = getUserIdFromToken();
    if (!managerId) {
      toast.error('Помилка автентифікації. Будь ласка, увійдіть знову.');
      return;
    }

    setIsLoading(true);
    try {
      // Генеруємо номер замовлення
      const orderNumber = generateOrderNumber();
      
      // Визначаємо тип документа
      let finalDocumentType = '';
      if (customDocumentType) {
        finalDocumentType = customDocumentType;
      } else if (documentType) {
        const foundType = DOCUMENT_TYPES_SIMPLE.find(t => t.value === documentType);
        finalDocumentType = foundType?.label || documentType;
      }
      
      // Знаходимо назву мови
      const selectedLanguage = availableLanguages.find(l => l.name_pl === language);
      const languageLabel = selectedLanguage ? selectedLanguage.name_pl : language;
      
      // Формуємо опис з полів діалогу
      const orderDescriptionParts = [
        `Тип документа: ${finalDocumentType}`,
        `Мова: ${languageLabel}`,
        paymentMethod !== 'none' ? `Оплата: ${PAYMENT_METHODS.find(p => p.value === paymentMethod)?.label || paymentMethod}` : null,
        description ? `Опис: ${description}` : null,
        priceNetto ? `Ціна нетто: ${priceNetto} zł` : null,
        priceBrutto ? `Ціна брутто: ${priceBrutto} zł` : null,
      ];
      
      // Додаємо інформацію про доставку
      if (deliveryMethod === 'office' && officeId) {
        const office = offices.find(o => o.id.toString() === officeId);
        if (office) {
          orderDescriptionParts.push(`Доставка: Офіс - ${office.name}, ${office.city}`);
        }
      } else if (deliveryMethod === 'inpost_courier') {
        orderDescriptionParts.push('Доставка: InPost кур\'єр');
        if (courierAddress) orderDescriptionParts.push(`Адреса: ${courierAddress}`);
        if (courierEmail) orderDescriptionParts.push(`Email: ${courierEmail}`);
        if (courierPhone) orderDescriptionParts.push(`Телефон: ${courierPhone}`);
      } else if (deliveryMethod === 'inpost_locker') {
        orderDescriptionParts.push('Доставка: InPost автомат');
        if (lockerNumber) orderDescriptionParts.push(`Номер автомата: ${lockerNumber}`);
        if (lockerEmail) orderDescriptionParts.push(`Email: ${lockerEmail}`);
        if (lockerPhone) orderDescriptionParts.push(`Телефон: ${lockerPhone}`);
      }
      
      const orderDescription = orderDescriptionParts.filter(Boolean).join('\n');

      // Визначаємо статус замовлення
      // Тільки для готівки встановлюємо статус "Оплачено"
      const orderStatus = paymentMethod === 'cash' ? 'oplacone' : 'do_wykonania';

      // Створюємо замовлення через API
      const order = await ordersApi.createOrder({
        client_id: clientId,
        manager_id: managerId,
        order_number: orderNumber,
        description: orderDescription || undefined,
        deadline: deadline ? `${deadline}T23:59:59.000Z` : undefined,
        office_id: deliveryMethod === 'office' && officeId ? parseInt(officeId) : undefined,
        status: orderStatus,
        language: language || undefined,
        translation_type: documentType || customDocumentType || undefined,
        payment_method: paymentMethod !== 'none' ? paymentMethod : undefined,
        // CSV поля
        price_netto: priceNetto ? parseFloat(priceNetto) : undefined,
        price_brutto: priceBrutto ? parseFloat(priceBrutto) : undefined,
        order_source: orderSource || undefined,
      });

      // Автоматично створюємо Shipment запис з даними доставки, якщо вибрано InPost
      if (deliveryMethod === 'inpost_locker' || deliveryMethod === 'inpost_courier') {
        try {
          const { inboxApi } = await import('../../api/inbox');
          
          // Визначаємо адресу та пачкомат
          const address = deliveryMethod === 'inpost_courier' ? courierAddress : undefined;
          const paczkomatCode = deliveryMethod === 'inpost_locker' ? lockerNumber : undefined;
          const isPaczkomat = deliveryMethod === 'inpost_locker';
          
          // Перевіряємо, що для пачкомату є код
          if (isPaczkomat && !paczkomatCode) {
            throw new Error('Номер пачкомату обов\'язковий для доставки InPost автомат');
          }
          
          // Перевіряємо, що для кур\'єра є адреса
          if (!isPaczkomat && !address) {
            throw new Error('Адреса доставки обов\'язкова для кур\'єрської доставки InPost');
          }
          
          // Створюємо Shipment запис через API
          // Дані про email та телефон будуть взяті з клієнта автоматично на бекенді
          const shipmentResult = await inboxApi.addAddressToOrder(
            order.id,
            address || paczkomatCode || '',
            isPaczkomat,
            paczkomatCode
          );
          
          if (!shipmentResult) {
            throw new Error('Не вдалося створити запис відправки');
          }
          
          console.log('Shipment created successfully:', shipmentResult);
        } catch (shipmentError: any) {
          console.error('Error creating shipment record:', shipmentError);
          const errorMessage = shipmentError?.response?.data?.detail || shipmentError?.message || 'Невідома помилка';
          // Показуємо помилку, але не блокуємо створення замовлення
          toast.error(`Замовлення створено, але не вдалося зберегти дані доставки: ${errorMessage}. Будь ласка, додайте їх вручну.`);
        }
      }

      // Якщо вибрано оплату картою або лінк на оплату, створюємо payment transaction/link
      if ((paymentMethod === 'card' || paymentMethod === 'payment_link') && priceBrutto && parseFloat(priceBrutto) > 0) {
        try {
          // Отримуємо дані клієнта
          const client = await clientsApi.getClient(clientId);
          const customerEmail = client.email || conversation?.client_id || 'customer@example.com';
          const customerName = client.full_name || conversation?.client_name || 'Клієнт';

          // Отримуємо активний payment provider
          const methods = await paymentApi.getAvailableMethods();
          const activeProvider = methods.stripe_enabled 
            ? PaymentProvider.STRIPE 
            : methods.przelewy24_enabled 
            ? PaymentProvider.PRZELEWY24 
            : null;

          if (!activeProvider) {
            toast.warning('Платіжні провайдери не налаштовані. Замовлення створено без платежу.');
          } else {
            if (paymentMethod === 'card') {
              // Створюємо payment transaction для оплати картою
              await paymentApi.createTransaction({
                order_id: order.id,
                provider: activeProvider,
                amount: parseFloat(priceBrutto),
                currency: 'PLN',
                customer_email: customerEmail,
                customer_name: customerName,
                description: `Оплата за замовлення ${orderNumber}`,
              });
              toast.success('Zlecenie zostało utworzone. Transakcja płatności kartą została utworzona.');
            } else if (paymentMethod === 'payment_link') {
              // Створюємо payment link
              await paymentApi.createPaymentLink({
                order_id: order.id,
                provider: activeProvider,
                amount: parseFloat(priceBrutto),
                currency: 'PLN',
                customer_email: customerEmail,
                customer_name: customerName,
                description: `Оплата за замовлення ${orderNumber}`,
              });
              toast.success('Zlecenie zostało utworzone. Link płatności został utworzony.');
            }
          }
        } catch (paymentError: any) {
          console.error('Error creating payment:', paymentError);
          toast.warning('Zlecenie zostało utworzone, ale nie udało się utworzyć płatności: ' + (paymentError?.message || 'Nieznany błąd'));
        }
      } else {
        toast.success('Zlecenie zostało utworzone');
      }

      onSuccess?.(order.id);
      handleClose();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(error?.message || 'Błąd tworzenia zlecenia');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setDocumentType('');
    setCustomDocumentType('');
    setLanguage('');
    setDeadline('');
    setPriceNetto('');
    setPriceBrutto('');
    setDescription('');
    setPaymentMethod('none');
    setOrderSource('');
    setDeliveryMethod('office');
    setOfficeId('');
    setCourierAddress('');
    setCourierEmail('');
    setCourierPhone('');
    setLockerNumber('');
    setLockerEmail('');
    setLockerPhone('');
    onOpenChange(false);
  };

  // Встановлюємо дедлайн на завтра за замовчуванням
  React.useEffect(() => {
    if (open && !deadline) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDeadline(tomorrow.toISOString().split('T')[0]);
    }
  }, [open]);

  // Автоматично вибираємо джерело замовлення на основі платформи розмови
  useEffect(() => {
    if (open && conversation?.platform && !orderSource) {
      const platformToSource: Record<string, string> = {
        'telegram': 'Telegram',
        'whatsapp': 'WhatsApp',
        'instagram': 'Instagram',
        'facebook': 'Facebook',
        'email': 'Email',
      };
      
      const source = platformToSource[conversation.platform.toLowerCase()];
      if (source) {
        setOrderSource(source);
      }
    }
  }, [open, conversation?.platform, orderSource]);

  // Функція для визначення пачкоматів та адрес з повідомлень
  const detectPaczkomatAndAddress = () => {
    if (!messages || messages.length === 0) return { paczkomat: null, address: null };
    
    let detectedPaczkomat: { code: string; fullAddress: string } | null = null;
    let detectedAddress: string | null = null;
    
    // Перевіряємо всі вхідні повідомлення
    for (const message of messages) {
      if (message.direction !== 'inbound' || !message.content) continue;
      
      const content = message.content;
      
      // Визначення пачкомату - формат 1: повна адреса
      const paczkomatFullPattern = /([A-Z]{3,6}\d{0,3}[A-Z]{0,3}),\s*(\d{2}-\d{3})\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?,\s*([^,\n]+)/g;
      let paczkomatFullMatch;
      while ((paczkomatFullMatch = paczkomatFullPattern.exec(content)) !== null) {
        const code = paczkomatFullMatch[1].trim();
        const postalCode = paczkomatFullMatch[2].trim();
        const city = paczkomatFullMatch[3].trim().replace(/\*\*/g, '');
        const street = paczkomatFullMatch[4].trim();
        detectedPaczkomat = {
          code,
          fullAddress: `${code}, ${postalCode} ${city}, ${street}`,
        };
        break;
      }
      
      // Визначення пачкомату - формат 2: просто код
      if (!detectedPaczkomat) {
        const paczkomatCodePattern = /\b([A-Z]{3,6}\d{0,3}[A-Z]{0,3})\b/g;
        let paczkomatCodeMatch;
        while ((paczkomatCodeMatch = paczkomatCodePattern.exec(content)) !== null) {
          const code = paczkomatCodeMatch[1].trim();
          const beforeCode = content.substring(Math.max(0, paczkomatCodeMatch.index - 1), paczkomatCodeMatch.index);
          const afterCode = content.substring(paczkomatCodeMatch.index + code.length, paczkomatCodeMatch.index + code.length + 1);
          const isWordBoundary = (!beforeCode || /[\s,;:!?.\n]/.test(beforeCode)) && (!afterCode || /[\s,;:!?.\n]/.test(afterCode));
          
          if (isWordBoundary && code.length >= 5) {
            detectedPaczkomat = { code, fullAddress: code };
            break;
          }
        }
      }
      
      // Визначення адреси - формат 1: поштовий індекс, місто, вулиця
      const addressPattern1 = /(\d{2}-\d{3})\s+(?:\*\*)?([^*\n]+?)(?:\*\*)?,\s*([^,\n]+)/g;
      let addressMatch1;
      while ((addressMatch1 = addressPattern1.exec(content)) !== null) {
        const postalCode = addressMatch1[1].trim();
        const city = addressMatch1[2].trim().replace(/\*\*/g, '');
        const street = addressMatch1[3].trim();
        const beforeAddress = content.substring(Math.max(0, addressMatch1.index - 30), addressMatch1.index);
        const hasPaczkomatCode = /[A-Z]{3,6}\d{0,3}[A-Z]{0,3},/.test(beforeAddress);
        
        if (!hasPaczkomatCode) {
          detectedAddress = `${postalCode} ${city}, ${street}`;
          break;
        }
      }
      
      // Визначення адреси - формат 2: Місто, Вулиця, Номер, Поштовий індекс
      if (!detectedAddress) {
        const addressPattern2 = /([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)*),\s*([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)*),\s*([^,]+),\s*(\d{2}-\d{3})/g;
        let addressMatch2;
        while ((addressMatch2 = addressPattern2.exec(content)) !== null) {
          const city = addressMatch2[1].trim();
          const street = addressMatch2[2].trim();
          const number = addressMatch2[3].trim();
          const postalCode = addressMatch2[4].trim();
          detectedAddress = `${postalCode} ${city}, ${street} ${number}`;
          break;
        }
      }
      
      if (detectedPaczkomat || detectedAddress) break;
    }
    
    return { paczkomat: detectedPaczkomat, address: detectedAddress };
  };

  // Завантажуємо офіси, мови та дані клієнта при відкритті діалогу
  useEffect(() => {
    if (open) {
      loadOffices();
      loadClientData();
      loadLanguages();
      checkExistingOrders();
    }
  }, [open, clientId]);

  // Автоматично заповнюємо пачкомат/адресу при виборі способу доставки InPost
  useEffect(() => {
    if (!open) return;
    
    if (deliveryMethod === 'inpost_locker' && !lockerNumber) {
      const { paczkomat } = detectPaczkomatAndAddress();
      if (paczkomat) {
        setLockerNumber(paczkomat.code);
        toast.info(`Автоматично визначено пачкомат: ${paczkomat.code}`);
      }
    } else if (deliveryMethod === 'inpost_courier' && !courierAddress) {
      const { address } = detectPaczkomatAndAddress();
      if (address) {
        setCourierAddress(address);
        toast.info(`Автоматично визначено адресу: ${address}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deliveryMethod]);

  // Перевіряємо, чи вже є замовлення для клієнта
  const checkExistingOrders = async () => {
    if (!clientId) return;
    
    try {
      const existingOrders = await ordersApi.getOrders({ client_id: clientId, limit: 1 });
      if (existingOrders && existingOrders.length > 0) {
        const firstOrder = existingOrders[0];
        toast.info('Для цього клієнта вже є замовлення. Переходимо до нього...', {
          duration: 3000,
        });
        
        // Закриваємо діалог
        handleClose();
        
        // Переспрямовуємо на замовлення через невелику затримку
        setTimeout(() => {
          // Використовуємо window.location для навігації
          window.location.href = `/crm/orders?orderId=${firstOrder.id}`;
          
          // Або через custom event для навігації в SPA
          window.dispatchEvent(
            new CustomEvent('command:navigate', {
              detail: { path: '/crm/orders', orderId: firstOrder.id }
            })
          );
          
          // Викликаємо onSuccess з ID існуючого замовлення
          if (onSuccess) {
            onSuccess(firstOrder.id);
          }
        }, 300);
        
        return true; // Повертаємо true, якщо знайдено існуюче замовлення
      }
    } catch (error) {
      console.error('Error checking existing orders:', error);
      // Продовжуємо створення, якщо помилка
    }
    return false;
  };
  
  const loadLanguages = async () => {
    setIsLoadingLanguages(true);
    try {
      const languages = await languagesApi.getLanguages();
      setAvailableLanguages(languages);
    } catch (error: any) {
      console.error('Error loading languages:', error);
      toast.error('Помилка завантаження мов');
    } finally {
      setIsLoadingLanguages(false);
    }
  };
  
  const loadClientData = async () => {
    setIsLoadingClient(true);
    try {
      const client = await clientsApi.getClient(clientId);
      const clientInfo = {
        email: client.email,
        phone: client.phone,
      };
      setClientData(clientInfo);
      
      // Автозаповнюємо поля доставки, якщо вони порожні
      setCourierEmail(prev => prev || clientInfo.email || '');
      setCourierPhone(prev => prev || clientInfo.phone || '');
      setLockerEmail(prev => prev || clientInfo.email || '');
      setLockerPhone(prev => prev || clientInfo.phone || '');
    } catch (error: any) {
      console.error('Error loading client data:', error);
      // Не показуємо помилку, просто не завантажуємо дані
    } finally {
      setIsLoadingClient(false);
    }
  };

  const loadOffices = async () => {
    setIsLoadingOffices(true);
    try {
      const data = await officesApi.getOffices({ is_active: true });
      setOffices(data);
      
      // Встановлюємо default офіс якщо він є
      const defaultOffice = data.find(o => o.is_default);
      if (defaultOffice) {
        setOfficeId(defaultOffice.id.toString());
      } else if (data.length > 0) {
        setOfficeId(data[0].id.toString());
      }
    } catch (error: any) {
      console.error('Error loading offices:', error);
      toast.error('Помилка завантаження офісів');
    } finally {
      setIsLoadingOffices(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Nowe zlecenie
          </DialogTitle>
          <DialogDescription className="sr-only">
            Діалогове вікно для створення нового замовлення
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Тип документа - компактні чіпси */}
          <div className="space-y-2">
            <Label className="text-sm">
              Тип документа <span className="text-red-500">*</span>
            </Label>
            
            {/* Типи документів як горизонтальні чіпси */}
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_TYPES_SIMPLE.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setDocumentType(type.value);
                    setCustomDocumentType('');
                  }}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-full border transition-colors",
                    documentType === type.value
                      ? "bg-[#FF5A00] text-white border-[#FF5A00]"
                      : "bg-white hover:bg-gray-50 border-gray-200"
                  )}
                >
                  <span className="mr-1.5">{type.icon}</span>
                  {type.label.split(' - ')[0]}
                </button>
              ))}
            </div>
            
            {/* Кастомний тип документа */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">
                Або введіть власний тип:
              </Label>
              <Input
                value={customDocumentType}
                onChange={(e) => {
                  setCustomDocumentType(e.target.value);
                  if (e.target.value) {
                    setDocumentType(''); // Скидаємо вибір типу
                  }
                }}
                placeholder="Введіть тип документа вручну..."
                className="w-full"
              />
            </div>
          </div>

          {/* Мова та Джерело замовлення - 2 колонки */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="language" className="text-sm">
                Мова <span className="text-red-500">*</span>
              </Label>
              {isLoadingLanguages ? (
                <div className="h-10 flex items-center text-xs text-gray-500">
                  Завантаження...
                </div>
              ) : (
                <Select value={language} onValueChange={setLanguage} required>
                  <SelectTrigger id="language" className="h-9">
                    <SelectValue placeholder="Оберіть мову" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((lang) => (
                      <SelectItem key={lang.id} value={lang.name_pl}>
                        {lang.name_pl} {lang.base_client_price > 0 && `(${lang.base_client_price} PLN)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="order_source" className="text-sm">
                Джерело замовлення
              </Label>
              <Select value={orderSource} onValueChange={setOrderSource}>
                <SelectTrigger id="order_source" className="h-9">
                  <SelectValue placeholder="Оберіть джерело" />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_SOURCES.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Дедлайн та Статус оплати - 2 колонки */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="deadline" className="text-sm flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Дедлайн
              </Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="h-9"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Статус оплати
              </Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {paymentMethod === 'cash' && (
            <p className="text-xs text-green-600 -mt-2">
              ✅ Zlecenie zostanie utworzone ze statusem "Opłacone"
            </p>
          )}
          {paymentMethod === 'card' && (
            <p className="text-xs text-blue-600 -mt-2">
              💳 Zlecenie zostanie utworzone ze statusem "Do wykonania". Transakcja płatności kartą zostanie utworzona.
            </p>
          )}
          {paymentMethod === 'payment_link' && (
            <p className="text-xs text-blue-600 -mt-2">
              🔗 Zlecenie zostanie utworzone ze statusem "Do wykonania". Link płatności zostanie utworzony.
            </p>
          )}

          {/* Ціни - 2 колонки */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="price_netto" className="text-sm flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Ціна нетто (zł)
              </Label>
              <Input
                id="price_netto"
                type="number"
                step="0.01"
                value={priceNetto}
                onChange={(e) => setPriceNetto(e.target.value)}
                placeholder="0.00"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_brutto" className="text-sm flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />
                Ціна брутто (zł)
              </Label>
              <Input
                id="price_brutto"
                type="number"
                step="0.01"
                value={priceBrutto}
                onChange={(e) => setPriceBrutto(e.target.value)}
                placeholder="0.00"
                className="h-9"
              />
            </div>
          </div>

          {/* Спосіб доставки */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              Спосіб доставки
            </Label>
            <Select value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as 'office' | 'inpost_courier' | 'inpost_locker')}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Офіс
                  </div>
                </SelectItem>
                <SelectItem value="inpost_courier">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    InPost кур'єр
                  </div>
                </SelectItem>
                <SelectItem value="inpost_locker">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    InPost автомат
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Офіс (якщо вибрано офіс) */}
          {deliveryMethod === 'office' && (
            <div className="space-y-2">
              <Label htmlFor="office" className="text-sm flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Офіс видачі
              </Label>
              {isLoadingOffices ? (
                <div className="text-xs text-gray-500 py-2">Завантаження офісів...</div>
              ) : (
                <Select value={officeId} onValueChange={setOfficeId}>
                  <SelectTrigger id="office" className="h-9">
                    <SelectValue placeholder="Оберіть офіс" />
                  </SelectTrigger>
                  <SelectContent>
                    {offices.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Немає доступних офісів
                      </SelectItem>
                    ) : (
                      offices.map((office) => (
                        <SelectItem key={office.id} value={office.id.toString()}>
                          <div className="flex flex-col">
                            <span className="font-medium">{office.name}</span>
                            <span className="text-xs text-gray-500">{office.city}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              {officeId && offices.find(o => o.id.toString() === officeId) && (
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>{offices.find(o => o.id.toString() === officeId)?.address}</div>
                  <div>📞 {offices.find(o => o.id.toString() === officeId)?.phone}</div>
                  <div>🕐 {offices.find(o => o.id.toString() === officeId)?.working_hours}</div>
                </div>
              )}
            </div>
          )}

          {/* InPost кур'єр поля */}
          {deliveryMethod === 'inpost_courier' && (
            <div className="space-y-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Label className="text-sm font-medium text-blue-900">Дані для доставки кур'єром</Label>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="courier-address" className="text-xs">Адреса *</Label>
                  <Input
                    id="courier-address"
                    value={courierAddress}
                    onChange={(e) => setCourierAddress(e.target.value)}
                    placeholder="Введіть адресу доставки"
                    required
                    className="h-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="courier-email" className="text-xs">Email</Label>
                    <Input
                      id="courier-email"
                      type="email"
                      value={courierEmail}
                      onChange={(e) => setCourierEmail(e.target.value)}
                      placeholder={clientData?.email || "Email"}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="courier-phone" className="text-xs">Телефон</Label>
                    <Input
                      id="courier-phone"
                      type="tel"
                      value={courierPhone}
                      onChange={(e) => setCourierPhone(e.target.value)}
                      placeholder={clientData?.phone || "Телефон"}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* InPost автомат поля */}
          {deliveryMethod === 'inpost_locker' && (
            <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <Label className="text-sm font-medium text-green-900">Дані для доставки в автомат</Label>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="locker-number" className="text-xs">Номер автомата *</Label>
                  <Input
                    id="locker-number"
                    value={lockerNumber}
                    onChange={(e) => setLockerNumber(e.target.value)}
                    placeholder="Введіть номер автомата"
                    required
                    className="h-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="locker-email" className="text-xs">Email</Label>
                    <Input
                      id="locker-email"
                      type="email"
                      value={lockerEmail}
                      onChange={(e) => setLockerEmail(e.target.value)}
                      placeholder={clientData?.email || "Email"}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="locker-phone" className="text-xs">Телефон</Label>
                    <Input
                      id="locker-phone"
                      type="tel"
                      value={lockerPhone}
                      onChange={(e) => setLockerPhone(e.target.value)}
                      placeholder={clientData?.phone || "Телефон"}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Опис */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm">Опис (опціонально)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dodatkowe szczegóły zlecenia..."
              rows={3}
              className="text-sm"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-[#FF5A00] hover:bg-[#FF5A00]/90">
              {isLoading ? 'Tworzenie...' : 'Utwórz zlecenie'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

