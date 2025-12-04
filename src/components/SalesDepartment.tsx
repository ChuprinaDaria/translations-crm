import { useState, useEffect } from "react";
import { Search, UserPlus, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { clientsApi, type Client, type ClientQuestionnaire, type ClientQuestionnaireUpdate, type ClientCreate } from "../lib/api";
import { toast } from "sonner";
import { ClientDetailsDialog } from "./ClientDetailsDialog";

export function SalesDepartment() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [questionnaire, setQuestionnaire] = useState<ClientQuestionnaire | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedClientForDetails, setSelectedClientForDetails] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientQuestionnaireUpdate>({});
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newClientData, setNewClientData] = useState<ClientCreate>({
    name: "",
    phone: "",
    email: "",
    company_name: "",
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setIsLoading(true);
      const data = await clientsApi.getClients(0, 100, searchQuery);
      setClients(data?.clients || []);
    } catch (error: any) {
      toast.error("Помилка завантаження клієнтів");
      console.error(error);
      setClients([]); // Встановлюємо порожній масив при помилці
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery !== undefined) {
      const timeoutId = setTimeout(() => {
        loadClients();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery]);

  const handleClientSelect = async (client: Client) => {
    setSelectedClient(client);
    setIsDialogOpen(true);
    try {
      const data = await clientsApi.getClient(client.id);
      if (data.questionnaire) {
        setQuestionnaire(data.questionnaire);
        setFormData(data.questionnaire);
      } else {
        setQuestionnaire(null);
        setFormData({});
      }
    } catch (error: any) {
      if (error.status === 404) {
        setQuestionnaire(null);
        setFormData({});
      } else {
        toast.error("Помилка завантаження анкети");
      }
    }
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedClient(null);
    setQuestionnaire(null);
    setFormData({
      // Додаємо дефолтні значення для нової анкети
      event_date: new Date().toISOString().split('T')[0],
    });
    setNewClientData({
      name: "",
      phone: "",
      email: "",
      company_name: "",
    });
    setIsDialogOpen(true);
  };

  // Синхронізуємо дані клієнта з полями анкети при створенні нового клієнта
  useEffect(() => {
    if (isCreatingNew) {
      // Автоматично заповнюємо деякі поля анкети з даних клієнта
      setFormData((prev) => ({
        ...prev,
        contact_person: newClientData.name || prev.contact_person,
        contact_phone: newClientData.phone || prev.contact_phone,
        location: prev.location,
      }));
    }
  }, [newClientData.name, newClientData.phone, isCreatingNew]);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      let clientId = selectedClient?.id;

      // Якщо це новий клієнт - спочатку створюємо його
      if (isCreatingNew) {
        if (!newClientData.name || !newClientData.phone) {
          toast.error("Заповніть обов'язкові поля: ім'я та телефон");
          setIsSaving(false);
          return;
        }

        try {
          const createdClient = await clientsApi.createClient(newClientData);
          clientId = createdClient.id;
          setSelectedClient(createdClient);
          setIsCreatingNew(false);
          toast.success("Клієнта створено!");
          // Оновлюємо список клієнтів
          loadClients();
        } catch (error: any) {
          toast.error("Помилка створення клієнта");
          console.error(error);
          setIsSaving(false);
          return;
        }
      }

      if (!clientId) return;

      // Зберігаємо анкету
      const saved = await clientsApi.createOrUpdateQuestionnaire(clientId, formData);
      setQuestionnaire(saved);
      toast.success("Анкету збережено!");
    } catch (error: any) {
      toast.error("Помилка збереження анкети");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof ClientQuestionnaireUpdate, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Відділ Продажів</h1>
      </div>

      {/* Пошук клієнтів */}
      <Card>
        <CardHeader>
          <CardTitle>Анкета клієнта</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Пошук клієнта за ім'ям, телефоном, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleCreateNew} className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Створити нову анкету
            </Button>
          </div>

          {/* Список клієнтів */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ім'я</TableHead>
                  <TableHead>Компанія</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </TableCell>
                  </TableRow>
                ) : !clients || clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      Клієнти не знайдено
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.company_name || "—"}</TableCell>
                      <TableCell>{client.phone}</TableCell>
                      <TableCell>{client.email || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedClientForDetails(client);
                              setIsDetailsDialogOpen(true);
                            }}
                          >
                            Деталі
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleClientSelect(client)}
                          >
                            Редагувати анкету
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Діалог з анкетою */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setIsCreatingNew(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreatingNew ? "Нова анкета клієнта" : `Анкета клієнта: ${selectedClient?.name}`}
            </DialogTitle>
            <DialogDescription>
              {isCreatingNew 
                ? "Створіть нового клієнта та заповніть анкету" 
                : "Заповніть або оновіть анкету клієнта для відділу продажів"}
            </DialogDescription>
          </DialogHeader>

          {/* Форма даних клієнта для нового клієнта */}
          {isCreatingNew && (
            <div className="space-y-4 p-4 bg-orange-50 border border-orange-200 rounded-lg mb-4">
              <h3 className="font-semibold text-orange-900">Дані клієнта</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client-name">Ім'я клієнта *</Label>
                  <Input
                    id="client-name"
                    value={newClientData.name}
                    onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                    placeholder="Введіть ім'я"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-phone">Телефон *</Label>
                  <Input
                    id="client-phone"
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                    placeholder="+380..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-email">Email</Label>
                  <Input
                    id="client-email"
                    type="email"
                    value={newClientData.email || ""}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-company">Компанія</Label>
                  <Input
                    id="client-company"
                    value={newClientData.company_name || ""}
                    onChange={(e) => setNewClientData({ ...newClientData, company_name: e.target.value })}
                    placeholder="Назва компанії"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6 py-4">
            {/* СЕРВІС */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                СЕРВІС
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Дата заходу</Label>
                  <Input
                    type="date"
                    value={formData.event_date || ""}
                    onChange={(e) => updateField("event_date", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Точна локація</Label>
                  <Input
                    value={formData.location || ""}
                    onChange={(e) => updateField("location", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Контакт замовника</Label>
                  <Input
                    value={formData.contact_person || ""}
                    onChange={(e) => updateField("contact_person", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Телефон контакту</Label>
                  <Input
                    value={formData.contact_phone || ""}
                    onChange={(e) => updateField("contact_phone", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Хто буде головним на локації</Label>
                  <Input
                    value={formData.on_site_contact || ""}
                    onChange={(e) => updateField("on_site_contact", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Телефон на локації</Label>
                  <Input
                    value={formData.on_site_phone || ""}
                    onChange={(e) => updateField("on_site_phone", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Час заїзду на локацію</Label>
                  <Input
                    value={formData.arrival_time || ""}
                    onChange={(e) => updateField("arrival_time", e.target.value)}
                    placeholder="09:00"
                  />
                </div>
                <div>
                  <Label>Час початку заходу</Label>
                  <Input
                    value={formData.event_start_time || ""}
                    onChange={(e) => updateField("event_start_time", e.target.value)}
                    placeholder="10:00"
                  />
                </div>
                <div>
                  <Label>Час кінця заходу</Label>
                  <Input
                    value={formData.event_end_time || ""}
                    onChange={(e) => updateField("event_end_time", e.target.value)}
                    placeholder="14:00"
                  />
                </div>
                <div>
                  <Label>Таймінги всіх видач</Label>
                  <Textarea
                    value={formData.service_type_timing || ""}
                    onChange={(e) => updateField("service_type_timing", e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Таймінги додаткових видач</Label>
                  <Textarea
                    value={formData.additional_services_timing || ""}
                    onChange={(e) => updateField("additional_services_timing", e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Коментарі щодо обладнання</Label>
                  <Textarea
                    value={formData.equipment_notes || ""}
                    onChange={(e) => updateField("equipment_notes", e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Спосіб оплати</Label>
                  <Input
                    value={formData.payment_method || ""}
                    onChange={(e) => updateField("payment_method", e.target.value)}
                    placeholder="Предоплата/Залишок"
                  />
                </div>
                <div>
                  <Label>Колір текстилю</Label>
                  <Input
                    value={formData.textile_color || ""}
                    onChange={(e) => updateField("textile_color", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Колір оформлення лінії</Label>
                  <Input
                    value={formData.banquet_line_color || ""}
                    onChange={(e) => updateField("banquet_line_color", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ЗАЇЗД */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                ЗАЇЗД
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Складність заїзду</Label>
                  <Input
                    value={formData.venue_complexity || ""}
                    onChange={(e) => updateField("venue_complexity", e.target.value)}
                  />
                </div>
                <div>
                  <Label>На якому поверсі</Label>
                  <Input
                    value={formData.floor_number || ""}
                    onChange={(e) => updateField("floor_number", e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.elevator_available || false}
                    onCheckedChange={(checked) => updateField("elevator_available", checked)}
                  />
                  <Label>Чи є ліфт</Label>
                </div>
                <div>
                  <Label>Чи є технічне приміщення</Label>
                  <Input
                    value={formData.technical_room || ""}
                    onChange={(e) => updateField("technical_room", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Чи є кухня</Label>
                  <Input
                    value={formData.kitchen_available || ""}
                    onChange={(e) => updateField("kitchen_available", e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.venue_photos || false}
                    onCheckedChange={(checked) => updateField("venue_photos", checked)}
                  />
                  <Label>Фото локації</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.arrival_photos || false}
                    onCheckedChange={(checked) => updateField("arrival_photos", checked)}
                  />
                  <Label>Фото заїзду</Label>
                </div>
              </div>
            </div>

            {/* КУХНЯ */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                КУХНЯ
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Посуд для подачі страв</Label>
                  <Input
                    value={formData.dish_serving || ""}
                    onChange={(e) => updateField("dish_serving", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Подача гарячих закусок</Label>
                  <Input
                    value={formData.hot_snacks_serving || ""}
                    onChange={(e) => updateField("hot_snacks_serving", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Подання салатів</Label>
                  <Input
                    value={formData.salad_serving || ""}
                    onChange={(e) => updateField("salad_serving", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Чи є алергія на продукти</Label>
                  <Input
                    value={formData.product_allergy || ""}
                    onChange={(e) => updateField("product_allergy", e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.vegetarians || false}
                    onCheckedChange={(checked) => updateField("vegetarians", checked)}
                  />
                  <Label>Чи є вегетаріанці</Label>
                </div>
                <div>
                  <Label>Приготування гарячих закусок</Label>
                  <Input
                    value={formData.hot_snacks_prep || ""}
                    onChange={(e) => updateField("hot_snacks_prep", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Коментарі до позицій меню</Label>
                  <Textarea
                    value={formData.menu_notes || ""}
                    onChange={(e) => updateField("menu_notes", e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Їжа від замовника</Label>
                  <Textarea
                    value={formData.client_order_notes || ""}
                    onChange={(e) => updateField("client_order_notes", e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Напої від замовника</Label>
                  <Textarea
                    value={formData.client_drinks_notes || ""}
                    onChange={(e) => updateField("client_drinks_notes", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* КОНТЕНТ */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                КОНТЕНТ
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Чи можна фотозйомка</Label>
                  <Input
                    value={formData.photo_allowed || ""}
                    onChange={(e) => updateField("photo_allowed", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Чи можна відеозйомка</Label>
                  <Input
                    value={formData.video_allowed || ""}
                    onChange={(e) => updateField("video_allowed", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Чи можна брендовану продукцію</Label>
                  <Input
                    value={formData.branded_products || ""}
                    onChange={(e) => updateField("branded_products", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ЗАМОВНИК */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                ЗАМОВНИК
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Назва компанії</Label>
                  <Input
                    value={formData.client_company_name || ""}
                    onChange={(e) => updateField("client_company_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Вид діяльності</Label>
                  <Input
                    value={formData.client_activity_type || ""}
                    onChange={(e) => updateField("client_activity_type", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* КОМЕНТАРІ */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                КОМЕНТАРІ
              </h3>
              <div>
                <Label>Спеціальні примітки</Label>
                <Textarea
                  value={formData.special_notes || ""}
                  onChange={(e) => updateField("special_notes", e.target.value)}
                  rows={5}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Скасувати
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Збереження...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Зберегти
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Діалог з деталями клієнта */}
      {selectedClientForDetails && (
        <ClientDetailsDialog
          client={selectedClientForDetails}
          isOpen={isDetailsDialogOpen}
          onClose={() => {
            setIsDetailsDialogOpen(false);
            setSelectedClientForDetails(null);
          }}
          onEdit={() => {
            setIsDetailsDialogOpen(false);
            handleClientSelect(selectedClientForDetails);
          }}
        />
      )}
    </div>
  );
}

