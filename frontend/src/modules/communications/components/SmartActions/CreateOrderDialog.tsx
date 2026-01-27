import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Textarea } from '../../../../components/ui/textarea';
import { FileText, Calendar, DollarSign, MapPin, Truck, Package } from 'lucide-react';
import { toast } from 'sonner';
import { officesApi, type Office } from '../../../crm/api/offices';
import { ordersApi } from '../../../crm/api/orders';
import { getUserIdFromToken } from '../../../notifications/utils/userId';
import { clientsApi } from '../../../crm/api/clients';
import { languagesApi, type Language } from '../../../crm/api/languages';

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSuccess?: (orderId: string) => void;
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
  { value: 'card', label: '💳 Картка' },
  { value: 'transfer', label: '🏦 Переказ' },
];

export function CreateOrderDialog({
  open,
  onOpenChange,
  clientId,
  onSuccess,
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

      // Створюємо замовлення через API
      const order = await ordersApi.createOrder({
        client_id: clientId,
        manager_id: managerId,
        order_number: orderNumber,
        description: orderDescription || undefined,
        deadline: deadline ? `${deadline}T23:59:59.000Z` : undefined,
        office_id: deliveryMethod === 'office' && officeId ? parseInt(officeId) : undefined,
        status: paymentMethod !== 'none' ? 'oplacone' : 'do_wykonania',
        language: language || undefined,
        translation_type: documentType || customDocumentType || undefined,
        payment_method: paymentMethod !== 'none' ? paymentMethod : undefined,
        // CSV поля
        price_netto: priceNetto ? parseFloat(priceNetto) : undefined,
        price_brutto: priceBrutto ? parseFloat(priceBrutto) : undefined,
        order_source: orderSource || undefined,
      });

      toast.success('Zlecenie zostało utworzone');
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

  // Завантажуємо офіси, мови та дані клієнта при відкритті діалогу
  useEffect(() => {
    if (open) {
      loadOffices();
      loadClientData();
      loadLanguages();
    }
  }, [open, clientId]);
  
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            📝 Nowe zlecenie
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Тип документа */}
          <div className="space-y-3">
            <Label>
              Тип документа <span className="text-red-500">*</span>
            </Label>
            
            {/* Типи документів як кнопки */}
            <div className="grid grid-cols-2 gap-2">
              {DOCUMENT_TYPES_SIMPLE.map((type) => (
                <Button
                  key={type.value}
                  type="button"
                  variant={documentType === type.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setDocumentType(type.value);
                    setCustomDocumentType('');
                  }}
                  className={`justify-start ${
                    documentType === type.value
                      ? "bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white"
                      : ""
                  }`}
                >
                  <span className="mr-2">{type.icon}</span>
                  {type.label.split(' - ')[0]}
                </Button>
              ))}
            </div>
            
            {/* Кастомний тип документа */}
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">
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

          {/* Мова */}
          <div className="space-y-2">
            <Label htmlFor="language">
              Мова <span className="text-red-500">*</span>
            </Label>
            {isLoadingLanguages ? (
              <div className="h-10 flex items-center text-sm text-gray-500">
                Завантаження мов...
              </div>
            ) : (
              <Select value={language} onValueChange={setLanguage} required>
                <SelectTrigger id="language">
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
          
          {/* Джерело замовлення */}
          <div className="space-y-2">
            <Label htmlFor="order_source">
              Джерело замовлення
            </Label>
            <Select value={orderSource} onValueChange={setOrderSource}>
              <SelectTrigger id="order_source">
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

          {/* Дедлайн */}
          <div className="space-y-2">
            <Label htmlFor="deadline" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Дедлайн
            </Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {/* Ціни */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="price_netto" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Ціна нетто (zł)
              </Label>
              <Input
                id="price_netto"
                type="number"
                step="0.01"
                value={priceNetto}
                onChange={(e) => setPriceNetto(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price_brutto" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Ціна брутто (zł)
              </Label>
              <Input
                id="price_brutto"
                type="number"
                step="0.01"
                value={priceBrutto}
                onChange={(e) => setPriceBrutto(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Спосіб оплати */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Статус оплати
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
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
            {paymentMethod !== 'none' && (
              <p className="text-xs text-green-600">
                ✅ Zlecenie zostanie utworzone ze statusem "Opłacone"
              </p>
            )}
          </div>

          {/* Спосіб доставки */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Спосіб доставки
            </Label>
            <Select value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as 'office' | 'inpost_courier' | 'inpost_locker')}>
              <SelectTrigger>
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
              <Label htmlFor="office" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Офіс видачі
              </Label>
              {isLoadingOffices ? (
                <div className="text-sm text-gray-500 py-2">Завантаження офісів...</div>
              ) : (
                <Select value={officeId} onValueChange={setOfficeId}>
                  <SelectTrigger id="office">
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
                <div className="text-xs text-gray-500 space-y-1">
                  <div>{offices.find(o => o.id.toString() === officeId)?.address}</div>
                  <div>📞 {offices.find(o => o.id.toString() === officeId)?.phone}</div>
                  <div>🕐 {offices.find(o => o.id.toString() === officeId)?.working_hours}</div>
                </div>
              )}
            </div>
          )}

          {/* InPost кур'єр поля */}
          {deliveryMethod === 'inpost_courier' && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
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
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="courier-email" className="text-xs">Email</Label>
                  <Input
                    id="courier-email"
                    type="email"
                    value={courierEmail}
                    onChange={(e) => setCourierEmail(e.target.value)}
                    placeholder={clientData?.email || "Email"}
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
                  />
                </div>
              </div>
            </div>
          )}

          {/* InPost автомат поля */}
          {deliveryMethod === 'inpost_locker' && (
            <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-200">
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
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="locker-email" className="text-xs">Email</Label>
                  <Input
                    id="locker-email"
                    type="email"
                    value={lockerEmail}
                    onChange={(e) => setLockerEmail(e.target.value)}
                    placeholder={clientData?.email || "Email"}
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
                  />
                </div>
              </div>
            </div>
          )}

          {/* Опис */}
          <div className="space-y-2">
            <Label htmlFor="description">Опис (опціонально)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dodatkowe szczegóły zlecenia..."
              rows={3}
            />
          </div>

          <DialogFooter>
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

