import React, { useEffect, useState } from "react";
import { Search, FileText, Calendar, User, ChevronDown, Eye, Download, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { toast } from "sonner";
import {
  kpApi,
  templatesApi,
  usersApi,
  type KP,
  type Template,
  type User,
} from "../lib/api";

type KPStatus = "sent" | "approved" | "rejected" | "completed";

interface KPListItem {
  id: number;
  number: string;
  clientName: string;
  createdDate: string;
  eventDate?: string;
  createdBy?: string;
  status: KPStatus;
  statusLabel: string;
  totalAmount: number;
  dishCount: number;
  guestCount: number;
  template: string;
  templateId?: number;
}

function getStatusLabel(status: KPStatus): string {
  switch (status) {
    case "approved":
      return "Затверджено";
    case "rejected":
      return "Відхилено";
    case "completed":
      return "Виконано";
    case "sent":
    default:
      return "Відправлено";
  }
}

function getStatusColor(status: KPStatus): string {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case "completed":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case "sent":
      return "bg-purple-100 text-purple-700 hover:bg-purple-100";
    case "rejected":
      return "bg-red-100 text-red-700 hover:bg-red-100";
    default:
      return "bg-gray-100 text-gray-700 hover:bg-gray-100";
  }
}

export function AllKP() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [kpItems, setKpItems] = useState<KPListItem[]>([]);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedManager, setSelectedManager] = useState<string>("all");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [kps, templates, usersData] = await Promise.all([
          kpApi.getKPs(),
          templatesApi.getTemplates(),
          usersApi.getUsers().catch(() => [] as User[]),
        ]);

        const templateMap = new Map<number, string>();
        templates.forEach((t) => templateMap.set(t.id, t.name));

        const userMap = new Map<number, User>();
        usersData.forEach((u) => userMap.set(u.id, u));

        const mapped: KPListItem[] = kps.map((kp) => {
          const status = ((kp.status as KPStatus) || "sent") as KPStatus;
          const createdByUser =
            (kp.created_by_id && userMap.get(kp.created_by_id)) || undefined;

          return {
            id: kp.id,
            number: `KP-${kp.id.toString().padStart(4, "0")}`,
            clientName: kp.title,
            createdDate: kp.created_at
              ? new Date(kp.created_at).toISOString().split("T")[0]
              : "",
            status,
            statusLabel: getStatusLabel(status),
            totalAmount: kp.total_price || 0,
            dishCount: kp.items?.length || 0,
            guestCount: kp.people_count,
            template: kp.template_id
              ? templateMap.get(kp.template_id) || "Шаблон"
              : "Шаблон",
            templateId: kp.template_id,
            createdBy: createdByUser
              ? `${createdByUser.first_name || ""} ${
                  createdByUser.last_name || ""
                }`.trim() || createdByUser.email
              : undefined,
          };
        });

        setKpItems(mapped);
        setUsers(usersData);
      } catch (error: any) {
        console.error("Error loading KPs:", error);
        toast.error("Помилка завантаження КП");
      }
    };

    loadData();
  }, []);

  const handleStatusChange = async (item: KPListItem, newStatus: KPStatus) => {
    if (item.status === newStatus) return;

    const previous = [...kpItems];
    setUpdatingStatusId(item.id);

    // Оптимістичне оновлення UI
    setKpItems((items) =>
      items.map((kp) =>
        kp.id === item.id
          ? {
              ...kp,
              status: newStatus,
              statusLabel: getStatusLabel(newStatus),
            }
          : kp
      )
    );

    try {
      await kpApi.updateKPStatus(item.id, newStatus);
      toast.success("Статус КП оновлено");
    } catch (error: any) {
      console.error("Error updating KP status:", error);
      toast.error("Не вдалося оновити статус КП");
      setKpItems(previous);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleView = async (item: KPListItem) => {
    try {
      const blob = await kpApi.generateKPPDF(item.id, item.templateId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Помилка генерації PDF:", error);
      toast.error("Не вдалося згенерувати PDF для КП");
    }
  };

  const handleDownload = async (item: KPListItem) => {
    try {
      const blob = await kpApi.generateKPPDF(item.id, item.templateId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${item.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Помилка завантаження PDF:", error);
      toast.error("Не вдалося завантажити PDF для КП");
    }
  };

  const handleDelete = async (item: KPListItem) => {
    if (!window.confirm(`Видалити КП ${item.number}? Цю дію не можна скасувати.`)) {
      return;
    }

    const previous = [...kpItems];
    setDeletingId(item.id);
    // Оптимістично прибираємо з таблиці
    setKpItems((items) => items.filter((kp) => kp.id !== item.id));

    try {
      await kpApi.deleteKP(item.id);
      toast.success("КП видалено");
    } catch (error: any) {
      console.error("Помилка видалення КП:", error);
      toast.error(error?.data?.detail || "Не вдалося видалити КП");
      setKpItems(previous);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredItems = kpItems.filter((item) => {
    const matchesSearch =
      item.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.clientName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      selectedStatus === "all" || item.status === selectedStatus;

    const matchesManager =
      selectedManager === "all" ||
      (selectedManager === "none" && !item.createdBy) ||
      item.createdBy === selectedManager;

    return matchesSearch && matchesStatus && matchesManager;
  });

  const total = filteredItems.length;
  const approved = filteredItems.filter((i) => i.status === "approved").length;
  const completed = filteredItems.filter((i) => i.status === "completed").length;
  const totalAmount = filteredItems.reduce((sum, i) => sum + i.totalAmount, 0);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl text-gray-900 mb-2">Усі КП</h1>
        <p className="text-sm md:text-base text-gray-600">
          Список усіх створених комерційних пропозицій
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-gray-600 mb-1">Всього КП</p>
                <p className="text-xl md:text-2xl text-gray-900">{total}</p>
              </div>
              <FileText className="w-6 h-6 md:w-8 md:h-8 text-[#FF5A00] opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-gray-600 mb-1">Затверджено</p>
                <p className="text-xl md:text-2xl text-green-600">{approved}</p>
              </div>
              <FileText className="w-6 h-6 md:w-8 md:h-8 text-green-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-gray-600 mb-1">Виконано</p>
                <p className="text-xl md:text-2xl text-blue-600">{completed}</p>
              </div>
              <FileText className="w-6 h-6 md:w-8 md:h-8 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-gray-600 mb-1">Загальна сума</p>
                <p className="text-lg md:text-2xl text-gray-900">
                  {totalAmount.toLocaleString()} грн
                </p>
              </div>
              <FileText className="w-6 h-6 md:w-8 md:h-8 text-gray-400 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Пошук..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-[180px] md:w-[200px]">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всі статуси</SelectItem>
                  <SelectItem value="sent">Відправлено</SelectItem>
                  <SelectItem value="approved">Затверджено</SelectItem>
                  <SelectItem value="rejected">Відхилено</SelectItem>
                  <SelectItem value="completed">Виконано</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={selectedManager}
                onValueChange={setSelectedManager}
              >
                <SelectTrigger className="w-full sm:w-[200px] md:w-[220px]">
                  <SelectValue placeholder="Менеджер" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всі менеджери</SelectItem>
                  <SelectItem value="none">Без менеджера</SelectItem>
                  {Array.from(
                    new Set(
                      kpItems
                        .map((i) => i.createdBy)
                        .filter((v): v is string => !!v),
                    ),
                  ).map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Номер КП</TableHead>
                    <TableHead className="min-w-[150px]">Клієнт</TableHead>
                    <TableHead className="min-w-[110px] hidden lg:table-cell">
                      Дата події
                    </TableHead>
                    <TableHead className="min-w-[110px] hidden xl:table-cell">
                      Створено
                    </TableHead>
                    <TableHead className="min-w-[130px] hidden xl:table-cell">
                      Менеджер
                    </TableHead>
                    <TableHead className="min-w-[150px]">Статус</TableHead>
                    <TableHead className="min-w-[80px] hidden md:table-cell">
                      Гостей
                    </TableHead>
                    <TableHead className="min-w-[120px]">Сума</TableHead>
                    <TableHead className="text-right min-w-[80px]">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-gray-500"
                      >
                        КП не знайдено
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400 hidden sm:block" />
                            <span className="text-gray-900 text-sm">
                              {item.number}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-gray-900 max-w-[150px] md:max-w-[200px] truncate text-sm">
                            {item.clientName}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-1 text-gray-600 text-sm">
                            <Calendar className="w-3.5 h-3.5" />
                            {item.eventDate}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm hidden xl:table-cell">
                          {item.createdDate}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div className="flex items-center gap-1 text-gray-600 text-sm">
                            <User className="w-3.5 h-3.5" />
                            {item.createdBy}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              className={getStatusColor(item.status) + " text-xs"}
                            >
                              {item.statusLabel}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  disabled={updatingStatusId === item.id}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(item, "sent")}
                                >
                                  Відправлено
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(item, "approved")
                                  }
                                >
                                  Затверджено
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(item, "rejected")
                                  }
                                >
                                  Відхилено
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleStatusChange(item, "completed")
                                  }
                                >
                                  Виконано
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm hidden md:table-cell">
                          {item.guestCount}
                        </TableCell>
                        <TableCell className="text-gray-900 text-sm">
                          {item.totalAmount.toLocaleString()} грн
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleView(item)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Переглянути
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownload(item)}>
                                <Download className="w-4 h-4 mr-2" />
                                Завантажити PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(item)}
                                className="text-red-600 focus:text-red-600"
                                disabled={deletingId === item.id}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Видалити КП
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="text-sm text-gray-600">
              Показано {filteredItems.length} з {kpItems.length} КП
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


