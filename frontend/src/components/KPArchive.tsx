import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  User,
  FileText,
  ChevronDown,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import { kpApi, templatesApi, type KP, type Template } from "../lib/api";

interface KPArchiveItem {
  id: number;
  number: string;
  clientName: string;
  createdDate: string;
  // опціональні поля для майбутніх розширень (подія, менеджер)
  eventDate?: string;
  createdBy?: string;
  status: "sent" | "approved" | "rejected" | "completed";
  statusLabel: string;
  totalAmount: number;
  dishCount: number;
  guestCount: number;
  template: string;
  templateId?: number;
}

export function KPArchive() {
  const [searchQuery, setSearchQuery] = useState("");
  // В архіві показуємо лише виконані КП, але залишаємо фільтр за статусом на майбутнє
  const [selectedStatus, setSelectedStatus] = useState<string>("completed");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [archiveItems, setArchiveItems] = useState<KPArchiveItem[]>([]);

  useEffect(() => {
    const loadArchive = async () => {
      try {
        const [kps, templates] = await Promise.all([
          kpApi.getKPs(),
          templatesApi.getTemplates(),
        ]);

        const templateMap = new Map<number, string>();
        templates.forEach((t) => templateMap.set(t.id, t.name));

        // Беремо лише КП зі статусом "completed"
        const completedKps = kps.filter((kp) => kp.status === "completed");

        const mapped: KPArchiveItem[] = completedKps.map((kp) => ({
          id: kp.id,
          number: `KP-${kp.id.toString().padStart(4, "0")}`,
          clientName: kp.title,
          createdDate: kp.created_at
            ? new Date(kp.created_at).toISOString().split("T")[0]
            : "",
          status: (kp.status as KPArchiveItem["status"]) || "sent",
          statusLabel:
            kp.status === "completed"
              ? "Виконано"
              : kp.status === "approved"
              ? "Затверджено"
              : kp.status === "rejected"
              ? "Відхилено"
              : "Відправлено",
          totalAmount: kp.total_price || 0,
          dishCount: kp.items?.length || 0,
          guestCount: kp.people_count,
          template: kp.template_id
            ? templateMap.get(kp.template_id) || "Шаблон"
            : "Шаблон",
          templateId: kp.template_id,
        }));

        setArchiveItems(mapped);
      } catch (error: any) {
        console.error("Error loading KP archive:", error);
        toast.error("Помилка завантаження архіву КП");
      }
    };

    loadArchive();
  }, []);

  const getStatusColor = (status: string) => {
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
  };

  const filteredItems = archiveItems.filter((item) => {
    const matchesSearch =
      item.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.clientName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;

    let matchesPeriod = true;
    if (selectedPeriod !== "all") {
      const itemDate = new Date(item.createdDate);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));

      switch (selectedPeriod) {
        case "week":
          matchesPeriod = diffDays <= 7;
          break;
        case "month":
          matchesPeriod = diffDays <= 30;
          break;
        case "quarter":
          matchesPeriod = diffDays <= 90;
          break;
      }
    }

    return matchesSearch && matchesStatus && matchesPeriod;
  });

  const handleView = async (item: KPArchiveItem) => {
    try {
      const blob = await kpApi.generateKPPDF(item.id, item.templateId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Помилка генерації PDF:", error);
      toast.error("Не вдалося згенерувати PDF для КП");
    }
  };

  const handleDownload = async (item: KPArchiveItem) => {
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

  const getTotalStats = () => {
    return {
      total: filteredItems.length,
      totalAmount: filteredItems.reduce((sum, item) => sum + item.totalAmount, 0),
      approved: filteredItems.filter((item) => item.status === "approved").length,
      completed: filteredItems.filter((item) => item.status === "completed").length,
    };
  };

  const stats = getTotalStats();

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl text-gray-900 mb-2">Архів КП</h1>
        <p className="text-sm md:text-base text-gray-600">Всі сформовані комерційні пропозиції з історією</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-gray-600 mb-1">Всього КП</p>
                <p className="text-xl md:text-2xl text-gray-900">{stats.total}</p>
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
                <p className="text-xl md:text-2xl text-green-600">{stats.approved}</p>
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
                <p className="text-xl md:text-2xl text-blue-600">{stats.completed}</p>
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
                  {stats.totalAmount.toLocaleString()} грн
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
            {/* Filters */}
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
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-full sm:w-[180px] md:w-[200px]">
                  <SelectValue placeholder="Період" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Весь період</SelectItem>
                  <SelectItem value="week">Останній тиждень</SelectItem>
                  <SelectItem value="month">Останній місяць</SelectItem>
                  <SelectItem value="quarter">Останній квартал</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Номер КП</TableHead>
                    <TableHead className="min-w-[150px]">Клієнт</TableHead>
                    <TableHead className="min-w-[110px] hidden lg:table-cell">Дата події</TableHead>
                    <TableHead className="min-w-[110px] hidden xl:table-cell">Створено</TableHead>
                    <TableHead className="min-w-[130px] hidden xl:table-cell">Менеджер</TableHead>
                    <TableHead className="min-w-[120px]">Статус</TableHead>
                    <TableHead className="min-w-[80px] hidden md:table-cell">Гостей</TableHead>
                    <TableHead className="min-w-[120px]">Сума</TableHead>
                    <TableHead className="text-right min-w-[80px]">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                        КП не знайдено
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400 hidden sm:block" />
                            <span className="text-gray-900 text-sm">{item.number}</span>
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
                        <TableCell className="text-gray-600 text-sm hidden xl:table-cell">{item.createdDate}</TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div className="flex items-center gap-1 text-gray-600 text-sm">
                            <User className="w-3.5 h-3.5" />
                            {item.createdBy}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(item.status) + " text-xs"}>
                            {item.statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm hidden md:table-cell">{item.guestCount}</TableCell>
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
              Показано {filteredItems.length} з {archiveItems.length} КП
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}