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

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSuccess?: (orderId: string) => void;
}

// Категорії документів
const DOCUMENT_CATEGORIES = [
  { value: 'TRC', label: 'TRC' },
  { value: 'Umowy', label: 'Umowy' },
  { value: 'Szkolne', label: 'Szkolne' },
  { value: 'Dyplomy', label: 'Dyplomy' },
  { value: 'Medyczne', label: 'Medyczne' },
  { value: 'Prawne', label: 'Prawne' },
  { value: 'Biznesowe', label: 'Biznesowe' },
  { value: 'Techniczne', label: 'Techniczne' },
] as const;

// Точні типи документів по категоріях
const DOCUMENT_TYPES: Record<string, Array<{ value: string; label: string }>> = {
  TRC: [
    { value: 'akt_urodzenia', label: 'Akt urodzenia' },
    { value: 'akt_malzenstwa', label: 'Akt małżeństwa' },
    { value: 'akt_zgonu', label: 'Akt zgonu' },
  ],
  Umowy: [
    { value: 'umowa', label: 'Umowa' },
    { value: 'umowa_najmu', label: 'Umowa najmu' },
    { value: 'umowa_pracy', label: 'Umowa o pracę' },
    { value: 'umowa_sprzedazy', label: 'Umowa sprzedaży' },
    { value: 'umowa_uslugi', label: 'Umowa o świadczenie usług' },
  ],
  Szkolne: [
    { value: 'swiadectwo', label: 'Świadectwo ukończenia szkoły' },
    { value: 'swiadectwo_maturalne', label: 'Świadectwo maturalne' },
    { value: 'zaświadczenie_szkolne', label: 'Zaświadczenie szkolne' },
  ],
  Dyplomy: [
    { value: 'dyplom', label: 'Dyplom' },
    { value: 'suplement_dyplomu', label: 'Suplement do dyplomu' },
    { value: 'dyplom_licencjacki', label: 'Dyplom licencjacki' },
    { value: 'dyplom_magisterski', label: 'Dyplom magisterski' },
  ],
  Medyczne: [
    { value: 'wypis_medyczny', label: 'Wypis medyczny' },
    { value: 'diagnoza', label: 'Diagnoza' },
    { value: 'wyniki_badan', label: 'Wyniki badań' },
    { value: 'skierowanie', label: 'Skierowanie' },
    { value: 'zgoda_na_leczenie', label: 'Zgoda na leczenie' },
    { value: 'recepta', label: 'Recepta' },
  ],
  Prawne: [
    { value: 'pozew', label: 'Pozew' },
    { value: 'wyrok', label: 'Wyrok' },
    { value: 'pelnomocnictwo', label: 'Pełnomocnictwo' },
    { value: 'akt_notarialny', label: 'Akt notarialny' },
    { value: 'zawierdzenie_niekaralnosci', label: 'Zaświadczenie o niekaralności' },
    { value: 'wyrok_sadowy', label: 'Wyrok sądowy' },
  ],
  Biznesowe: [
    { value: 'faktura', label: 'Faktura' },
    { value: 'statut_spolki', label: 'Statut spółki' },
    { value: 'odpis_krs', label: 'Odpis z KRS' },
    { value: 'zawierdzenie_skarbowe', label: 'Zaświadczenie skarbowe' },
    { value: 'umowa_biznesowa', label: 'Umowa biznesowa' },
  ],
  Techniczne: [
    { value: 'dowod_rejestracyjny', label: 'Dowód rejestracyjny' },
    { value: 'prawo_jazdy', label: 'Prawo jazdy' },
    { value: 'certyfikat', label: 'Certyfikat techniczny' },
    { value: 'instrukcja', label: 'Instrukcja obsługi' },
  ],
};

const LANGUAGES = [
  { value: 'uk', label: 'Українська' },
  { value: 'pl', label: 'Польська' },
  { value: 'en', label: 'Англійська' },
  { value: 'de', label: 'Німецька' },
  { value: 'fr', label: 'Французька' },
];

export function CreateOrderDialog({
  open,
  onOpenChange,
  clientId,
  onSuccess,
}: CreateOrderDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [documentType, setDocumentType] = useState('');
  const [customDocumentType, setCustomDocumentType] = useState('');
  const [language, setLanguage] = useState('');
  const [deadline, setDeadline] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  
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
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOffices, setIsLoadingOffices] = useState(false);
  const [isLoadingClient, setIsLoadingClient] = useState(false);

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
    
    if (!selectedCategory || !language) {
      toast.error('Заповніть обов\'язкові поля');
      return;
    }
    
    if (customDocumentType && !customDocumentType.trim()) {
      toast.error('Введіть тип документа');
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
        // Знаходимо тип в обраній категорії
        const categoryTypes = DOCUMENT_TYPES[selectedCategory] || [];
        const foundType = categoryTypes.find(t => t.value === documentType);
        finalDocumentType = foundType?.label || documentType;
      } else if (selectedCategory) {
        // Якщо вибрана тільки категорія
        const category = DOCUMENT_CATEGORIES.find(c => c.value === selectedCategory);
        finalDocumentType = category?.label || selectedCategory;
      }
      
      // Формуємо опис з полів діалогу
      const orderDescriptionParts = [
        `Тип документа: ${finalDocumentType}`,
        `Мова: ${LANGUAGES.find(l => l.value === language)?.label || language}`,
        description ? `Опис: ${description}` : null,
        price ? `Ціна: ${price} zł` : null,
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
        status: 'do_wykonania',
      });

      toast.success('Замовлення створено успішно');
      onSuccess?.(order.id);
      handleClose();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(error?.message || 'Помилка створення замовлення');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedCategory('');
    setDocumentType('');
    setCustomDocumentType('');
    setLanguage('');
    setDeadline('');
    setPrice('');
    setDescription('');
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

  // Завантажуємо офіси та дані клієнта при відкритті діалогу
  useEffect(() => {
    if (open) {
      loadOffices();
      loadClientData();
    }
  }, [open, clientId]);
  
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
            📝 Нове замовлення
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Тип документа */}
          <div className="space-y-3">
            <Label>
              Тип документа <span className="text-red-500">*</span>
            </Label>
            
            {/* Категорії як кнопки */}
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_CATEGORIES.map((category) => (
                <Button
                  key={category.value}
                  type="button"
                  variant={selectedCategory === category.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedCategory(category.value);
                    setDocumentType(''); // Скидаємо точний тип при зміні категорії
                    setCustomDocumentType('');
                  }}
                  className={
                    selectedCategory === category.value
                      ? "bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white"
                      : ""
                  }
                >
                  {category.label}
                </Button>
              ))}
            </div>
            
            {/* Точні типи з обраної категорії */}
            {selectedCategory && DOCUMENT_TYPES[selectedCategory] && (
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">
                  Оберіть точний тип (опціонально):
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={!documentType ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setDocumentType('');
                      setCustomDocumentType('');
                    }}
                    className={
                      !documentType
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : ""
                    }
                  >
                    Тільки {DOCUMENT_CATEGORIES.find(c => c.value === selectedCategory)?.label}
                  </Button>
                  {DOCUMENT_TYPES[selectedCategory].map((type) => (
                    <Button
                      key={type.value}
                      type="button"
                      variant={documentType === type.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setDocumentType(type.value);
                        setCustomDocumentType('');
                      }}
                      className={
                        documentType === type.value
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : ""
                      }
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Кастомний тип документа */}
            {selectedCategory && (
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">
                  Або введіть власний тип:
                </Label>
                <Input
                  value={customDocumentType}
                  onChange={(e) => {
                    setCustomDocumentType(e.target.value);
                    if (e.target.value) {
                      setDocumentType(''); // Скидаємо вибір точного типу
                    }
                  }}
                  placeholder="Введіть тип документа вручну..."
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Наприклад: Tłumaczenia przysięgłe dotyczą dokumentów urzędowych...
                </p>
              </div>
            )}
          </div>

          {/* Мова */}
          <div className="space-y-2">
            <Label htmlFor="language">
              Мова <span className="text-red-500">*</span>
            </Label>
            <Select value={language} onValueChange={setLanguage} required>
              <SelectTrigger id="language">
                <SelectValue placeholder="Оберіть мову" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
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

          {/* Ціна */}
          <div className="space-y-2">
            <Label htmlFor="price" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Ціна (zł)
            </Label>
            <div className="relative">
              <Input
                id="price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                zł
              </span>
            </div>
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
              placeholder="Додаткові деталі замовлення..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Скасувати
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-[#FF5A00] hover:bg-[#FF5A00]/90">
              {isLoading ? 'Створення...' : 'Створити замовлення'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

