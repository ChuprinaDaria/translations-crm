import React, { useEffect, useState } from "react";
import { 
  Edit2, Search, Users, Calendar, FileText, Percent, Gift, Trash2, 
  X, Phone, Mail, MapPin, Clock, CreditCard, Building2, 
  ChevronRight, ClipboardList, MessageSquare, Plus, Eye
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
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
import { 
  clientsApi, kpApi, checklistsApi, questionnairesApi,
  type Client, type ClientUpdate, type KP, type Checklist, type ClientQuestionnaire 
} from "../lib/api";
import { toast } from "sonner";
import { LoyaltyBadge } from "./LoyaltyBadge";

// Компонент картки статистики
function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color = "gray",
  onClick
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string; 
  color?: "orange" | "blue" | "green" | "purple" | "gray";
  onClick?: () => void;
}) {
  const colorClasses = {
    orange: "bg-orange-50 text-orange-600 border-orange-200",
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  };

  return (
    <div 
      className={`flex items-center gap-3 p-3 rounded-xl border ${colorClasses[color]} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color === 'orange' ? 'bg-orange-100' : color === 'blue' ? 'bg-blue-100' : color === 'green' ? 'bg-green-100' : color === 'purple' ? 'bg-purple-100' : 'bg-gray-100'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs opacity-70">{label}</div>
      </div>
    </div>
  );
}

// Компонент модального вікна перегляду клієнта
function ClientViewModal({
  client,
  onClose,
  onEdit,
}: {
  client: Client;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<{
    kps: KP[];
    checklists: Checklist[];
    questionnaires: ClientQuestionnaire[];
  }>({ kps: [], checklists: [], questionnaires: [] });
  const [activeTab, setActiveTab] = useState<"overview" | "kps" | "checklists" | "questionnaires">("overview");

  useEffect(() => {
    const loadClientData = async () => {
      setLoading(true);
      try {
        // Завантажуємо всі дані паралельно
        const [clientDetails, checklistsData, questionnairesData] = await Promise.all([
          clientsApi.getClient(client.id),
          checklistsApi.getClientChecklists(client.id).catch(() => ({ checklists: [], total: 0 })),
          questionnairesApi.getClientQuestionnaires(client.id).catch(() => ({ questionnaires: [], total: 0 })),
        ]);

        setClientData({
          kps: clientDetails.kps || [],
          checklists: checklistsData.checklists || [],
          questionnaires: questionnairesData.questionnaires || [],
        });
      } catch (error) {
        console.error("Error loading client data:", error);
        toast.error("Помилка завантаження даних клієнта");
      } finally {
        setLoading(false);
      }
    };

    loadClientData();
  }, [client.id]);

  const getStatusBadge = (status?: string) => {
    const statusColors: Record<string, string> = {
      "in_progress": "bg-blue-100 text-blue-700",
      "sent": "bg-yellow-100 text-yellow-700",
      "approved": "bg-green-100 text-green-700",
      "completed": "bg-emerald-100 text-emerald-700",
      "rejected": "bg-red-100 text-red-700",
      "draft": "bg-gray-100 text-gray-700",
    };
    const statusLabels: Record<string, string> = {
      "in_progress": "В роботі",
      "sent": "Відправлено",
      "approved": "Погоджено",
      "completed": "Завершено",
      "rejected": "Відхилено",
      "draft": "Чернетка",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status || "draft"] || statusColors.draft}`}>
        {statusLabels[status || "draft"] || status || "—"}
      </span>
    );
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        {/* Шапка з градієнтом */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Users className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold">{client.name}</h2>
                {(client as any).loyalty_tier && (
                  <LoyaltyBadge 
                    tier={(client as any).loyalty_tier} 
                    cashbackRate={(client as any).cashback_rate || 3}
                    size="sm"
                  />
                )}
              </div>
              {client.company_name && (
                <div className="flex items-center gap-2 text-white/80 mb-2">
                  <Building2 className="w-4 h-4" />
                  <span>{client.company_name}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-white/80">
                {client.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    <span>{client.email}</span>
                  </div>
                )}
              </div>
            </div>
            <Button
              onClick={onEdit}
              variant="secondary"
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Редагувати
            </Button>
          </div>
        </div>

        {/* Статистика */}
        <div className="p-6 border-b bg-gray-50">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard
                icon={FileText}
                label="КП"
                value={clientData.kps.length}
                color="orange"
                onClick={() => setActiveTab("kps")}
              />
              <StatCard
                icon={ClipboardList}
                label="Чекліcти"
                value={clientData.checklists.length}
                color="blue"
                onClick={() => setActiveTab("checklists")}
              />
              <StatCard
                icon={MessageSquare}
                label="Анкети"
                value={clientData.questionnaires.length}
                color="purple"
                onClick={() => setActiveTab("questionnaires")}
              />
              <StatCard
                icon={Percent}
                label="Знижка"
                value={client.discount || "—"}
                color="green"
              />
              <StatCard
                icon={Gift}
                label="Кешбек"
                value={`${((client as any).cashback_balance || client.cashback || 0).toLocaleString()} ₴`}
                color="green"
              />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="border-b px-6">
            <div className="flex gap-1">
              {[
                { id: "overview", label: "Огляд", icon: Eye },
                { id: "kps", label: `КП (${clientData.kps.length})`, icon: FileText },
                { id: "checklists", label: `Чекліcти (${clientData.checklists.length})`, icon: ClipboardList },
                { id: "questionnaires", label: `Анкети (${clientData.questionnaires.length})`, icon: MessageSquare },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
              </div>
            ) : (
              <>
                {/* Overview Tab */}
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    {/* Фінансова інформація */}
                    <div className="bg-white rounded-xl border p-4">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-gray-400" />
                        Фінансова інформація
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">Сума КП</div>
                          <div className="text-xl font-bold text-gray-900">
                            {client.kp_total_amount?.toLocaleString() || 0} ₴
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Сплачено</div>
                          <div className="text-xl font-bold text-green-600">
                            {client.paid_amount?.toLocaleString() || 0} ₴
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">Не оплачено</div>
                          <div className="text-xl font-bold text-red-600">
                            {client.unpaid_amount?.toLocaleString() || 0} ₴
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Останні КП */}
                    {clientData.kps.length > 0 && (
                      <div className="bg-white rounded-xl border p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-gray-400" />
                            Останні КП
                          </h3>
                          <button
                            onClick={() => setActiveTab("kps")}
                            className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1"
                          >
                            Всі КП <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-2">
                          {clientData.kps.slice(0, 3).map((kp) => (
                            <div key={kp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">КП #{kp.id}</div>
                                  <div className="text-xs text-gray-500">
                                    {kp.event_date ? new Date(kp.event_date).toLocaleDateString("uk-UA") : "—"} • {kp.event_format || "—"}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-gray-900">
                                  {kp.total_price?.toLocaleString() || 0} ₴
                                </div>
                                {getStatusBadge(kp.status)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Коментарі */}
                    {client.comments && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <h3 className="font-semibold text-amber-800 mb-2">📝 Коментарі</h3>
                        <p className="text-amber-700">{client.comments}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* KPs Tab */}
                {activeTab === "kps" && (
                  <div className="space-y-3">
                    {clientData.kps.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Немає КП для цього клієнта</p>
                      </div>
                    ) : (
                      clientData.kps.map((kp) => (
                        <div key={kp.id} className="flex items-center justify-between p-4 bg-white border rounded-xl hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                              <FileText className="w-6 h-6 text-orange-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">КП #{kp.id} — {kp.title}</div>
                              <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                {kp.event_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(kp.event_date).toLocaleDateString("uk-UA")}
                                  </span>
                                )}
                                {kp.event_format && (
                                  <span>{kp.event_format}</span>
                                )}
                                {kp.people_count && (
                                  <span>{kp.people_count} гостей</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900 mb-1">
                              {kp.total_price?.toLocaleString() || 0} ₴
                            </div>
                            {getStatusBadge(kp.status)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Checklists Tab */}
                {activeTab === "checklists" && (
                  <div className="space-y-3">
                    {clientData.checklists.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Немає чеклістів для цього клієнта</p>
                      </div>
                    ) : (
                      clientData.checklists.map((checklist) => (
                        <div key={checklist.id} className="flex items-center justify-between p-4 bg-white border rounded-xl hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              checklist.checklist_type === "box" ? "bg-purple-100" : "bg-blue-100"
                            }`}>
                              <ClipboardList className={`w-6 h-6 ${
                                checklist.checklist_type === "box" ? "text-purple-600" : "text-blue-600"
                              }`} />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">
                                Чекліст #{checklist.id}
                                <Badge variant="outline" className="ml-2">
                                  {checklist.checklist_type === "box" ? "Бокси" : "Кейтерінг"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                {checklist.event_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(checklist.event_date).toLocaleDateString("uk-UA")}
                                  </span>
                                )}
                                {checklist.guest_count && (
                                  <span>{checklist.guest_count} гостей</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {checklist.budget_amount && (
                              <div className="text-lg font-bold text-gray-900 mb-1">
                                {checklist.budget_amount.toLocaleString()} ₴
                              </div>
                            )}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              checklist.status === "sent_to_kp" ? "bg-green-100 text-green-700" :
                              checklist.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {checklist.status === "sent_to_kp" ? "В КП" : 
                               checklist.status === "in_progress" ? "В роботі" : 
                               checklist.status || "Чернетка"}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Questionnaires Tab */}
                {activeTab === "questionnaires" && (
                  <div className="space-y-3">
                    {clientData.questionnaires.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Немає анкет для цього клієнта</p>
                      </div>
                    ) : (
                      clientData.questionnaires.map((q) => (
                        <div key={q.id} className="flex items-center justify-between p-4 bg-white border rounded-xl hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                              <MessageSquare className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">Анкета #{q.id}</div>
                              <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                {q.event_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(q.event_date).toLocaleDateString("uk-UA")}
                                  </span>
                                )}
                                {q.event_type && (
                                  <span>{q.event_type}</span>
                                )}
                                {q.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {q.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            {q.created_at && new Date(q.created_at).toLocaleDateString("uk-UA")}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
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
        setCurrentUserRole(payload.role || null);
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
      } catch (e) {
        console.error("Помилка декодування токену:", e);
      }
    }

    const loadClients = async () => {
      try {
        const data = await clientsApi.getClients();
        const list = Array.isArray(data) ? data : (data as any).clients || [];
        setClients(list);
      } catch (error: any) {
        console.error("Error loading clients:", error);
        toast.error("Помилка завантаження клієнтів");
      }
    };

    loadClients();
  }, []);

  const canDeleteClient =
    currentUserIsAdmin ||
    (currentUserRole &&
      (currentUserRole.endsWith("-lead") || currentUserRole.toLowerCase().includes("admin")));

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
    setViewingClient(null);
    setEditingClient(client);
    setEditForm({
      name: client.name,
      phone: client.phone,
      email: client.email,
      company_name: client.company_name,
      notes: client.notes,
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
      let errorMessage = "Помилка видалення клієнта";
      if (error.data) {
        errorMessage = error.data.detail || error.data.message || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }
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
          Клієнти автоматично створюються з КП. Тут можна оновити статус та оплату.
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
                      <TableHead className="min-w-[200px]">Клієнт</TableHead>
                      <TableHead className="min-w-[140px]">Телефон</TableHead>
                      <TableHead className="min-w-[180px]">Email</TableHead>
                      <TableHead className="min-w-[100px]">Статус</TableHead>
                      <TableHead className="min-w-[150px]">Сума КП / Оплата</TableHead>
                      <TableHead className="min-w-[100px]">Знижка / Кешбек</TableHead>
                      <TableHead className="min-w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-8 text-center text-gray-500"
                        >
                          Клієнтів ще немає
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((client) => (
                        <TableRow 
                          key={client.id} 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => setViewingClient(client)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-orange-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{client.name}</span>
                                  {(client as any).loyalty_tier && (
                                    <LoyaltyBadge 
                                      tier={(client as any).loyalty_tier || "silver"} 
                                      cashbackRate={(client as any).cashback_rate || 3}
                                      size="sm"
                                    />
                                  )}
                                </div>
                                {client.company_name && (
                                  <div className="text-xs text-gray-500">{client.company_name}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">
                            {client.phone || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">
                            {client.email || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {client.status || "новий"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-700">
                            <div>
                              <span className="font-medium">
                                {client.kp_total_amount?.toLocaleString() || "—"} грн
                              </span>
                            </div>
                            <div className="text-green-600">
                              Сплачено: {client.paid_amount?.toLocaleString() || "0"} грн
                            </div>
                            <div className="text-red-600">
                              Не оплачено: {client.unpaid_amount?.toLocaleString() || "0"} грн
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
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(client);
                                }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {canDeleteClient && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingClient(client);
                                  }}
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

          {/* Модальне вікно перегляду клієнта */}
          {viewingClient && (
            <ClientViewModal
              client={viewingClient}
              onClose={() => setViewingClient(null)}
              onEdit={() => openEdit(viewingClient)}
            />
          )}

          {/* Діалог редагування */}
          <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Редагування клієнта</DialogTitle>
                <DialogDescription>
                  Оновіть основну інформацію про клієнта
                </DialogDescription>
              </DialogHeader>
              {editingClient && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Імʼя / ПІБ</Label>
                    <Input
                      id="name"
                      value={editForm.name || ""}
                      onChange={(e) => handleChange("name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Компанія</Label>
                    <Input
                      id="company_name"
                      value={editForm.company_name || ""}
                      onChange={(e) => handleChange("company_name", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="notes">Нотатки</Label>
                    <Input
                      id="notes"
                      value={editForm.notes || ""}
                      onChange={(e) => handleChange("notes", e.target.value)}
                      placeholder="Додаткові примітки про клієнта"
                    />
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
