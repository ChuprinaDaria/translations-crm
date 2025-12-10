import React, { useEffect, useState } from "react";
import { Edit2, Search, Users, Calendar, FileText, Percent, Gift, Trash2 } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { clientsApi, kpApi, type Client, type ClientUpdate, type KP } from "../lib/api";
import { toast } from "sonner";
import { LoyaltyBadge } from "./LoyaltyBadge";

export function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState<ClientUpdate>({});
  const [saving, setSaving] = useState(false);
  const [selectedClientForEvents, setSelectedClientForEvents] = useState<Client | null>(null);
  const [clientKPs, setClientKPs] = useState<KP[]>([]);
  const [loadingKPs, setLoadingKPs] = useState(false);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);

  useEffect(() => {
    // Отримуємо інформацію про поточного користувача з токену
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log("Token payload:", payload); // Для дебагу
        setCurrentUserRole(payload.role || null);
        // Перевірка is_admin - може бути true, "true", або 1
        const isAdminFromPayload =
          payload.is_admin === true ||
          payload.is_admin === "true" ||
          payload.is_admin === 1 ||
          payload.isAdmin === true ||
          payload.isAdmin === "true" ||
          payload.isAdmin === 1 ||
          payload.admin === true ||
          payload.admin === "true" ||
          payload.admin === 1 ||
          (typeof payload.role === "string" && payload.role.toLowerCase().includes("admin"));
        setCurrentUserIsAdmin(isAdminFromPayload);
        console.log("isAdminFromPayload:", isAdminFromPayload);
        console.log("currentUserRole:", payload.role);
        const canDelete = isAdminFromPayload ||
          (payload.role && (payload.role.endsWith("-lead") || payload.role.toLowerCase().includes("admin")));
        console.log("canDeleteClient:", canDelete);
      } catch (e) {
        console.error("Помилка декодування токену:", e);
      }
    }

    const loadClients = async () => {
      try {
        const data = await clientsApi.getClients();
        // Бекенд може повертати як { total, clients: [...] }, так і просто масив клієнтів.
        const list = Array.isArray(data) ? data : (data as any).clients || [];
        setClients(list);
      } catch (error: any) {
        console.error("Error loading clients:", error);
        toast.error("Помилка завантаження клієнтів");
      }
    };

    loadClients();
  }, []);

  // Перевірка чи користувач може видаляти клієнтів
  const canDeleteClient =
    currentUserIsAdmin ||
    (currentUserRole &&
      (currentUserRole.endsWith("-lead") || currentUserRole.toLowerCase().includes("admin")));
  
  // Логування для діагностики
  useEffect(() => {
    console.log("canDeleteClient check:", {
      currentUserIsAdmin,
      currentUserRole,
      canDeleteClient
    });
  }, [currentUserIsAdmin, currentUserRole, canDeleteClient]);

  // Завантаження КП для вибраного клієнта
  useEffect(() => {
    const loadClientKPs = async () => {
      if (!selectedClientForEvents) {
        setClientKPs([]);
        return;
      }

      setLoadingKPs(true);
      try {
        const allKPs = await kpApi.getKPs();
        // Фільтруємо КП за ім'ям клієнта, телефоном або email
        const filtered = allKPs.filter(
          (kp) =>
            (kp.client_name && kp.client_name === selectedClientForEvents.name) ||
            (kp.client_phone && kp.client_phone === selectedClientForEvents.phone) ||
            (kp.client_email && kp.client_email === selectedClientForEvents.email)
        );
        setClientKPs(filtered);
      } catch (error: any) {
        console.error("Error loading client KPs:", error);
        toast.error("Помилка завантаження КП клієнта");
      } finally {
        setLoadingKPs(false);
      }
    };

    loadClientKPs();
  }, [selectedClientForEvents]);

  const filtered = clients.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q)
    );
  });

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setEditForm({
      name: client.name,
      phone: client.phone,
      email: client.email,
      status: client.status,
      event_date: client.event_date,
      event_format: client.event_format,
      event_group: client.event_group,
      event_time: client.event_time,
      event_location: client.event_location,
      comments: client.comments,
      kp_total_amount: client.kp_total_amount,
      paid_amount: client.paid_amount,
      unpaid_amount: client.unpaid_amount,
      payment_format: client.payment_format,
      cash_collector: client.cash_collector,
      payment_plan_date: client.payment_plan_date,
      discount: client.discount,
      cashback: client.cashback,
    });
  };

  const handleChange = (
    field: keyof ClientUpdate,
    value: string | number | undefined,
  ) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!editingClient) return;
    setSaving(true);
    try {
      const updated = await clientsApi.updateClient(editingClient.id, editForm);
      setClients((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      setEditingClient(null);
      toast.success("Клієнта оновлено");
    } catch (error: any) {
      console.error("Error updating client:", error);
      toast.error("Помилка оновлення клієнта");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingClient) return;
    setIsDeleting(true);
    try {
      await clientsApi.deleteClient(deletingClient.id);
      setClients((prev) => prev.filter((c) => c.id !== deletingClient.id));
      setDeletingClient(null);
      toast.success("Клієнта видалено");
    } catch (error: any) {
      console.error("Error deleting client:", error);
      // Отримуємо детальне повідомлення про помилку
      let errorMessage = "Помилка видалення клієнта";
      if (error.data) {
        // ApiError має поле data з даними з бекенду
        errorMessage = error.data.detail || error.data.message || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }
      console.error("Delete error details:", {
        status: error.status,
        statusText: error.statusText,
        data: error.data,
        message: errorMessage
      });
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl text-gray-900 mb-2">Клієнти</h1>
        <p className="text-sm md:text-base text-gray-600">
          Клієнти автоматично створюються з КП. Тут можна оновити статус та
          оплату.
        </p>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">
            <Users className="w-4 h-4 mr-2" />
            Список клієнтів
          </TabsTrigger>
          <TabsTrigger value="events">
            <Calendar className="w-4 h-4 mr-2" />
            Події / Заходи
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Пошук клієнтів..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Клієнт</TableHead>
                  <TableHead className="min-w-[140px]">Телефон</TableHead>
                  <TableHead className="min-w-[180px]">Email</TableHead>
                  <TableHead className="min-w-[160px]">Статус</TableHead>
                  <TableHead className="min-w-[200px]">Дата / Формат / Локація</TableHead>
                  <TableHead className="min-w-[180px]">Сума КП / Оплата</TableHead>
                  <TableHead className="min-w-[120px]">Знижка / Кешбек</TableHead>
                  <TableHead className="min-w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-gray-500"
                    >
                      Клієнтів ще немає
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1">
                              <div className="text-sm text-gray-900 font-medium">
                                {client.name}
                              </div>
                              {client.company_name && (
                                <div className="text-xs text-gray-500">
                                  {client.company_name}
                                </div>
                              )}
                            </div>
                            {(client as any).loyalty_tier && (
                              <LoyaltyBadge 
                                tier={(client as any).loyalty_tier || "silver"} 
                                cashbackRate={(client as any).cashback_rate || 3}
                                size="sm"
                              />
                            )}
                          </div>
                          {client.comments && (
                            <div className="text-xs text-gray-500 line-clamp-2">
                              {client.comments}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {client.phone || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {client.email || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {client.status || "новий"}
                      </TableCell>
                      <TableCell className="text-xs text-gray-700">
                        <div>
                          {client.event_date
                            ? new Date(client.event_date)
                                .toISOString()
                                .split("T")[0]
                            : "—"}
                        </div>
                        <div>{client.event_format || "—"}</div>
                        <div className="text-gray-500">
                          {client.event_location || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-gray-700">
                        <div>
                          Сума КП:{" "}
                          <span className="font-medium">
                            {client.kp_total_amount?.toLocaleString() || "—"}{" "}
                            грн
                          </span>
                        </div>
                        <div>
                          Сплачено:{" "}
                          {client.paid_amount?.toLocaleString() || "0"} грн
                        </div>
                        <div>
                          Не оплачено:{" "}
                          {client.unpaid_amount?.toLocaleString() || "0"} грн
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-1">
                          {client.discount && (
                            <div className="flex items-center gap-1 text-[#FF5A00]">
                              <Percent className="w-3 h-3" />
                              <span>{client.discount}</span>
                            </div>
                          )}
                          {((client as any).cashback_balance && (client as any).cashback_balance > 0) || (client.cashback && client.cashback > 0) ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <Gift className="w-3 h-3" />
                              <span>
                                {((client as any).cashback_balance || client.cashback || 0).toLocaleString()} грн
                              </span>
                            </div>
                          ) : null}
                          {!client.discount && (!client.cashback || client.cashback === 0) && (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEdit(client)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          {canDeleteClient && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setDeletingClient(client)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Видалити клієнта"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-gray-600">
            Показано {filtered.length} з {clients.length} клієнтів
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Редагування клієнта</DialogTitle>
            <DialogDescription>
              Оновіть інформацію про клієнта
            </DialogDescription>
          </DialogHeader>
          {editingClient && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Імʼя / компанія</Label>
                  <Input
                    id="name"
                    value={editForm.name || ""}
                    onChange={(e) => handleChange("name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Статус клієнта</Label>
                  <Input
                    id="status"
                    value={editForm.status || ""}
                    onChange={(e) => handleChange("status", e.target.value)}
                    placeholder="новий / в роботі / закритий"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={editForm.phone || ""}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="event_date">Дата заходу</Label>
                  <Input
                    id="event_date"
                    type="date"
                    value={
                      editForm.event_date
                        ? editForm.event_date.split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      handleChange("event_date", e.target.value || undefined)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event_time">Час заходу</Label>
                  <Input
                    id="event_time"
                    value={editForm.event_time || ""}
                    onChange={(e) =>
                      handleChange("event_time", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event_format">Формат заходу</Label>
                  <Input
                    id="event_format"
                    value={editForm.event_format || ""}
                    onChange={(e) =>
                      handleChange("event_format", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event_location">Локація</Label>
                  <Input
                    id="event_location"
                    value={editForm.event_location || ""}
                    onChange={(e) =>
                      handleChange("event_location", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kp_total_amount">Сума КП (грн)</Label>
                  <Input
                    id="kp_total_amount"
                    type="number"
                    value={editForm.kp_total_amount ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "kp_total_amount",
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paid_amount">Сплачено (грн)</Label>
                  <Input
                    id="paid_amount"
                    type="number"
                    value={editForm.paid_amount ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "paid_amount",
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unpaid_amount">Не оплачено (грн)</Label>
                  <Input
                    id="unpaid_amount"
                    type="number"
                    value={editForm.unpaid_amount ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "unpaid_amount",
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_format">Формат оплати</Label>
                  <Input
                    id="payment_format"
                    value={editForm.payment_format || ""}
                    onChange={(e) =>
                      handleChange("payment_format", e.target.value)
                    }
                    placeholder="ФОП Ткач ... / Мозолевська ... / Інше"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cash_collector">
                    Якщо готівка — хто забирав
                  </Label>
                  <Input
                    id="cash_collector"
                    value={editForm.cash_collector || ""}
                    onChange={(e) =>
                      handleChange("cash_collector", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_plan_date">
                    Дата / планова дата оплати
                  </Label>
                  <Input
                    id="payment_plan_date"
                    type="date"
                    value={
                      editForm.payment_plan_date
                        ? editForm.payment_plan_date.split("T")[0]
                        : ""
                    }
                    onChange={(e) =>
                      handleChange(
                        "payment_plan_date",
                        e.target.value || undefined,
                      )
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comments">
                  Коментарі по замовленню, на які потрібно звернути увагу
                </Label>
                <Input
                  id="comments"
                  value={editForm.comments || ""}
                  onChange={(e) => handleChange("comments", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="discount">Знижка</Label>
                  <Input
                    id="discount"
                    value={editForm.discount || ""}
                    onChange={(e) => handleChange("discount", e.target.value)}
                    placeholder="Наприклад: 5% до КП #123"
                  />
                  <p className="text-xs text-gray-500">
                    Текст про знижки до конкретних КП
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cashback">Кешбек (грн)</Label>
                  <Input
                    id="cashback"
                    type="number"
                    value={editForm.cashback ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "cashback",
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500">
                    Сума всіх кешбеків з усіх КП (автоматично оновлюється)
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingClient(null)}
              disabled={saving}
            >
              Скасувати
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            >
              {saving ? "Збереження..." : "Зберегти"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Діалог підтвердження видалення */}
      <Dialog open={!!deletingClient} onOpenChange={(open) => !open && setDeletingClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити клієнта?</DialogTitle>
            <DialogDescription>
              Ви впевнені, що хочете видалити клієнта{" "}
              <strong>{deletingClient?.name}</strong>? Цю дію неможливо скасувати.
              {deletingClient?.phone && (
                <span className="block mt-1 text-sm text-gray-500">
                  Телефон: {deletingClient.phone}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingClient(null)}
              disabled={isDeleting}
            >
              Скасувати
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Видалення..." : "Видалити"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <Label>Оберіть клієнта для перегляду подій</Label>
                  <Select
                    value={selectedClientForEvents?.id.toString() || ""}
                    onValueChange={(value) => {
                      const client = clients.find((c) => c.id.toString() === value);
                      setSelectedClientForEvents(client || null);
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Оберіть клієнта" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.name} {client.phone ? `(${client.phone})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedClientForEvents && (
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold mb-4">
                        Події / Заходи для клієнта: {selectedClientForEvents.name}
                      </h3>
                      
                      {loadingKPs ? (
                        <div className="text-center py-8 text-gray-500">
                          Завантаження подій...
                        </div>
                      ) : clientKPs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          Немає заходів для цього клієнта
                        </div>
                      ) : (
                        <div className="border rounded-lg overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Дата</TableHead>
                                <TableHead>Формат</TableHead>
                                <TableHead>Локація</TableHead>
                                <TableHead>Час</TableHead>
                                <TableHead>Кількість гостей</TableHead>
                                <TableHead>Сума КП</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead>КП</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {clientKPs.map((kp) => (
                                <TableRow key={kp.id}>
                                  <TableCell>
                                    {kp.event_date
                                      ? new Date(kp.event_date).toLocaleDateString("uk-UA", {
                                          day: "numeric",
                                          month: "long",
                                          year: "numeric",
                                        })
                                      : "—"}
                                  </TableCell>
                                  <TableCell>{kp.event_format || "—"}</TableCell>
                                  <TableCell>{kp.event_location || "—"}</TableCell>
                                  <TableCell>{kp.event_time || "—"}</TableCell>
                                  <TableCell>{kp.people_count || "—"}</TableCell>
                                  <TableCell>
                                    {kp.total_price
                                      ? `${kp.total_price.toLocaleString()} грн`
                                      : "—"}
                                  </TableCell>
                                  <TableCell>
                                    {kp.status ? (
                                      <Badge variant="outline">{kp.status}</Badge>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-gray-400" />
                                      <span className="text-sm text-gray-600">
                                        КП #{kp.id}
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


