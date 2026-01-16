import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { FileText, ClipboardList, DollarSign, Edit, Calendar, MapPin, Phone, Mail, Loader2 } from 'lucide-react';
import { clientsApi, kpApi, type Client, type ClientQuestionnaire, type KP } from '../../../lib/api';
import { toast } from 'sonner';
// Форматування дати без date-fns
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return dateString;
  }
};

interface ClientDetailsDialogProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export function ClientDetailsDialog({ client, isOpen, onClose, onEdit }: ClientDetailsDialogProps) {
  const [clientData, setClientData] = useState<{
    client: Client;
    kps: KP[];
    questionnaire?: ClientQuestionnaire;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (isOpen && client.id) {
      fetchClientDetails();
    }
  }, [isOpen, client.id]);
  
  const fetchClientDetails = async () => {
    setIsLoading(true);
    try {
      const data = await clientsApi.getClient(client.id);
      setClientData(data);
    } catch (error: any) {
      toast.error('Помилка завантаження даних');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{client.name}</h2>
              {client.company_name && (
                <p className="text-sm text-gray-500 font-normal">{client.company_name}</p>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            Детальна інформація про клієнта та його замовлення
          </DialogDescription>
        </DialogHeader>
        {onEdit && (
          <div className="mb-4">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Редагувати
            </Button>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-full justify-start border-b">
              <TabsTrigger value="overview">Огляд</TabsTrigger>
              <TabsTrigger value="kps">
                КП ({clientData?.kps?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="questionnaire">Анкета</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-y-auto p-6">
              {/* Tab: Overview */}
              <TabsContent value="overview" className="space-y-6 mt-0">
                {/* Контакти */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Контактна інформація</h3>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-gray-400 mt-1" />
                      <div>
                        <div className="text-xs text-gray-500">Телефон</div>
                        <div className="font-medium">{client.phone}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 text-gray-400 mt-1" />
                      <div>
                        <div className="text-xs text-gray-500">Email</div>
                        <div className="font-medium">{client.email || '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Статистика */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Статистика</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-xs text-gray-500 mb-1">Замовлень</div>
                      <div className="text-2xl font-bold">{client.total_orders || 0}</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-xs text-gray-500 mb-1">Загальна сума</div>
                      <div className="text-2xl font-bold">{client.total_spent || 0} грн</div>
                    </div>
                    <div className="p-4 border rounded-lg bg-green-50">
                      <div className="text-xs text-green-700 mb-1">Кешбек</div>
                      <div className="text-2xl font-bold text-green-700">{client.cashback_balance || 0} грн</div>
                    </div>
                  </div>
                </div>
                
                {/* Коментарі */}
                {client.notes && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Коментарі менеджера</h3>
                    <div className="p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">
                      {client.notes}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              {/* Tab: КП */}
              <TabsContent value="kps" className="mt-0">
                <KPHistoryList kps={clientData?.kps || []} />
              </TabsContent>
              
              {/* Tab: Анкета */}
              <TabsContent value="questionnaire" className="mt-0">
                <QuestionnaireView 
                  questionnaire={clientData?.questionnaire} 
                  clientId={client.id}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Компонент для відображення історії КП
function KPHistoryList({ kps }: { kps: KP[] }) {
  if (kps.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>Немає КП для цього клієнта</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {kps.map((kp) => (
        <div key={kp.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-gray-900">{kp.title}</h4>
                <Badge variant={getStatusBadgeVariant(kp.status || 'sent')}>
                  {getStatusLabel(kp.status || 'sent')}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                {kp.event_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {formatDate(kp.event_date)}
                    </span>
                  </div>
                )}
                {kp.event_location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{kp.event_location}</span>
                  </div>
                )}
                {kp.people_count && (
                  <div>
                    <span className="text-gray-500">Гостей: </span>
                    <span className="font-medium">{kp.people_count}</span>
                  </div>
                )}
                {kp.total_price && (
                  <div>
                    <span className="text-gray-500">Сума: </span>
                    <span className="font-medium">{kp.total_price} грн</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Компонент для відображення анкети
function QuestionnaireView({ 
  questionnaire, 
  clientId 
}: { 
  questionnaire?: ClientQuestionnaire; 
  clientId: number;
}) {
  if (!questionnaire) {
    return (
      <div className="text-center py-12 text-gray-500">
        <ClipboardList className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>Анкета ще не заповнена</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* СЕРВІС */}
      {hasQuestionnaireData(questionnaire, 'service') && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">СЕРВІС</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {questionnaire.event_date && (
              <div>
                <div className="text-gray-500">Дата заходу</div>
                <div className="font-medium">{questionnaire.event_date}</div>
              </div>
            )}
            {questionnaire.location && (
              <div>
                <div className="text-gray-500">Локація</div>
                <div className="font-medium">{questionnaire.location}</div>
              </div>
            )}
            {questionnaire.contact_person && (
              <div>
                <div className="text-gray-500">Контакт замовника</div>
                <div className="font-medium">{questionnaire.contact_person}</div>
              </div>
            )}
            {questionnaire.contact_phone && (
              <div>
                <div className="text-gray-500">Телефон контакту</div>
                <div className="font-medium">{questionnaire.contact_phone}</div>
              </div>
            )}
            {questionnaire.on_site_contact && (
              <div>
                <div className="text-gray-500">Головний на локації</div>
                <div className="font-medium">{questionnaire.on_site_contact}</div>
              </div>
            )}
            {questionnaire.on_site_phone && (
              <div>
                <div className="text-gray-500">Телефон на локації</div>
                <div className="font-medium">{questionnaire.on_site_phone}</div>
              </div>
            )}
            {questionnaire.arrival_time && (
              <div>
                <div className="text-gray-500">Час заїзду</div>
                <div className="font-medium">{questionnaire.arrival_time}</div>
              </div>
            )}
            {questionnaire.event_start_time && (
              <div>
                <div className="text-gray-500">Час початку</div>
                <div className="font-medium">{questionnaire.event_start_time}</div>
              </div>
            )}
            {questionnaire.event_end_time && (
              <div>
                <div className="text-gray-500">Час кінця</div>
                <div className="font-medium">{questionnaire.event_end_time}</div>
              </div>
            )}
            {questionnaire.payment_method && (
              <div>
                <div className="text-gray-500">Спосіб оплати</div>
                <div className="font-medium">{questionnaire.payment_method}</div>
              </div>
            )}
            {questionnaire.textile_color && (
              <div>
                <div className="text-gray-500">Колір текстилю</div>
                <div className="font-medium">{questionnaire.textile_color}</div>
              </div>
            )}
            {questionnaire.banquet_line_color && (
              <div>
                <div className="text-gray-500">Колір оформлення лінії</div>
                <div className="font-medium">{questionnaire.banquet_line_color}</div>
              </div>
            )}
            {questionnaire.service_type_timing && (
              <div className="col-span-2">
                <div className="text-gray-500">Таймінги всіх видач</div>
                <div className="font-medium whitespace-pre-wrap">{questionnaire.service_type_timing}</div>
              </div>
            )}
            {questionnaire.additional_services_timing && (
              <div className="col-span-2">
                <div className="text-gray-500">Таймінги додаткових видач</div>
                <div className="font-medium whitespace-pre-wrap">{questionnaire.additional_services_timing}</div>
              </div>
            )}
            {questionnaire.equipment_notes && (
              <div className="col-span-2">
                <div className="text-gray-500">Коментарі щодо обладнання</div>
                <div className="font-medium whitespace-pre-wrap">{questionnaire.equipment_notes}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ЗАЇЗД */}
      {hasQuestionnaireData(questionnaire, 'arrival') && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">ЗАЇЗД</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {questionnaire.venue_complexity && (
              <div>
                <div className="text-gray-500">Складність заїзду</div>
                <div className="font-medium">{questionnaire.venue_complexity}</div>
              </div>
            )}
            {questionnaire.floor_number && (
              <div>
                <div className="text-gray-500">Поверх</div>
                <div className="font-medium">{questionnaire.floor_number}</div>
              </div>
            )}
            <div>
              <div className="text-gray-500">Ліфт</div>
              <div className="font-medium">{questionnaire.elevator_available ? 'Так' : 'Ні'}</div>
            </div>
            {questionnaire.technical_room && (
              <div>
                <div className="text-gray-500">Технічне приміщення</div>
                <div className="font-medium">{questionnaire.technical_room}</div>
              </div>
            )}
            {questionnaire.kitchen_available && (
              <div>
                <div className="text-gray-500">Кухня</div>
                <div className="font-medium">{questionnaire.kitchen_available}</div>
              </div>
            )}
            <div>
              <div className="text-gray-500">Фото локації</div>
              <div className="font-medium">{questionnaire.venue_photos ? 'Так' : 'Ні'}</div>
            </div>
            <div>
              <div className="text-gray-500">Фото заїзду</div>
              <div className="font-medium">{questionnaire.arrival_photos ? 'Так' : 'Ні'}</div>
            </div>
          </div>
        </div>
      )}

      {/* КУХНЯ */}
      {hasQuestionnaireData(questionnaire, 'kitchen') && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">КУХНЯ</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {questionnaire.dish_serving && (
              <div>
                <div className="text-gray-500">Посуд для подачі страв</div>
                <div className="font-medium">{questionnaire.dish_serving}</div>
              </div>
            )}
            {questionnaire.hot_snacks_serving && (
              <div>
                <div className="text-gray-500">Подача гарячих закусок</div>
                <div className="font-medium">{questionnaire.hot_snacks_serving}</div>
              </div>
            )}
            {questionnaire.salad_serving && (
              <div>
                <div className="text-gray-500">Подання салатів</div>
                <div className="font-medium">{questionnaire.salad_serving}</div>
              </div>
            )}
            {questionnaire.product_allergy && (
              <div>
                <div className="text-gray-500">Алергія на продукти</div>
                <div className="font-medium">{questionnaire.product_allergy}</div>
              </div>
            )}
            <div>
              <div className="text-gray-500">Вегетаріанці</div>
              <div className="font-medium">{questionnaire.vegetarians ? 'Так' : 'Ні'}</div>
            </div>
            {questionnaire.hot_snacks_prep && (
              <div>
                <div className="text-gray-500">Приготування гарячих закусок</div>
                <div className="font-medium">{questionnaire.hot_snacks_prep}</div>
              </div>
            )}
            {questionnaire.menu_notes && (
              <div className="col-span-2">
                <div className="text-gray-500">Коментарі до позицій меню</div>
                <div className="font-medium whitespace-pre-wrap">{questionnaire.menu_notes}</div>
              </div>
            )}
            {questionnaire.client_order_notes && (
              <div className="col-span-2">
                <div className="text-gray-500">Їжа від замовника</div>
                <div className="font-medium whitespace-pre-wrap">{questionnaire.client_order_notes}</div>
              </div>
            )}
            {questionnaire.client_drinks_notes && (
              <div className="col-span-2">
                <div className="text-gray-500">Напої від замовника</div>
                <div className="font-medium whitespace-pre-wrap">{questionnaire.client_drinks_notes}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* КОНТЕНТ */}
      {hasQuestionnaireData(questionnaire, 'content') && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">КОНТЕНТ</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {questionnaire.photo_allowed && (
              <div>
                <div className="text-gray-500">Фотозйомка</div>
                <div className="font-medium">{questionnaire.photo_allowed}</div>
              </div>
            )}
            {questionnaire.video_allowed && (
              <div>
                <div className="text-gray-500">Відеозйомка</div>
                <div className="font-medium">{questionnaire.video_allowed}</div>
              </div>
            )}
            {questionnaire.branded_products && (
              <div>
                <div className="text-gray-500">Брендована продукція</div>
                <div className="font-medium">{questionnaire.branded_products}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ЗАМОВНИК */}
      {hasQuestionnaireData(questionnaire, 'client') && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">ЗАМОВНИК</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {questionnaire.client_company_name && (
              <div>
                <div className="text-gray-500">Назва компанії</div>
                <div className="font-medium">{questionnaire.client_company_name}</div>
              </div>
            )}
            {questionnaire.client_activity_type && (
              <div>
                <div className="text-gray-500">Вид діяльності</div>
                <div className="font-medium">{questionnaire.client_activity_type}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* КОМЕНТАРІ */}
      {questionnaire.special_notes && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">КОМЕНТАРІ</h3>
          <div className="text-sm">
            <div className="text-gray-500 mb-2">Спеціальні примітки</div>
            <div className="font-medium whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
              {questionnaire.special_notes}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Допоміжна функція для перевірки наявності даних у розділі
function hasQuestionnaireData(questionnaire: ClientQuestionnaire, section: 'service' | 'arrival' | 'kitchen' | 'content' | 'client'): boolean {
  switch (section) {
    case 'service':
      return !!(
        questionnaire.event_date ||
        questionnaire.location ||
        questionnaire.contact_person ||
        questionnaire.contact_phone ||
        questionnaire.on_site_contact ||
        questionnaire.on_site_phone ||
        questionnaire.arrival_time ||
        questionnaire.event_start_time ||
        questionnaire.event_end_time ||
        questionnaire.service_type_timing ||
        questionnaire.additional_services_timing ||
        questionnaire.equipment_notes ||
        questionnaire.payment_method ||
        questionnaire.textile_color ||
        questionnaire.banquet_line_color
      );
    case 'arrival':
      return !!(
        questionnaire.venue_complexity ||
        questionnaire.floor_number ||
        questionnaire.elevator_available !== undefined ||
        questionnaire.technical_room ||
        questionnaire.kitchen_available ||
        questionnaire.venue_photos !== undefined ||
        questionnaire.arrival_photos !== undefined
      );
    case 'kitchen':
      return !!(
        questionnaire.dish_serving ||
        questionnaire.hot_snacks_serving ||
        questionnaire.salad_serving ||
        questionnaire.product_allergy ||
        questionnaire.vegetarians !== undefined ||
        questionnaire.hot_snacks_prep ||
        questionnaire.menu_notes ||
        questionnaire.client_order_notes ||
        questionnaire.client_drinks_notes
      );
    case 'content':
      return !!(
        questionnaire.photo_allowed ||
        questionnaire.video_allowed ||
        questionnaire.branded_products
      );
    case 'client':
      return !!(
        questionnaire.client_company_name ||
        questionnaire.client_activity_type
      );
    default:
      return false;
  }
}

// Допоміжні функції для статусів КП
function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    in_progress: 'В роботі',
    sent_to_sales: 'Відправлено менеджеру з продажу',
    revision: 'Коригування',
    sent: 'Відправлено клієнту',
    approved: 'Затверджено',
    rejected: 'Відхилено',
    completed: 'Виконано',
    draft: 'Чернетка',
  };
  return statusMap[status] || status;
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    in_progress: 'default',
    sent_to_sales: 'secondary',
    revision: 'outline',
    sent: 'default',
    approved: 'default',
    rejected: 'destructive',
    completed: 'secondary',
    draft: 'outline',
  };
  return variantMap[status] || 'outline';
}

