import { useEffect, useMemo, useState } from "react";
import { KP, kpApi, purchaseApi } from "../lib/api";
import { useDebounce } from "../hooks/useDebounce";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { InfoTooltip } from "./InfoTooltip";
import { toast } from "sonner";

type KPStatusFilter = "all" | "in_progress" | "sent" | "approved" | "completed";

export function ProcurementExcel() {
  const [kps, setKps] = useState<KP[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [statusFilter, setStatusFilter] = useState<KPStatusFilter>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const loadKPs = async () => {
      setLoading(true);
      try {
        const data = await kpApi.getKPs();
        setKps(data);
      } catch (e) {
        console.error(e);
        toast.error("Не вдалося завантажити КП для закупки");
      } finally {
        setLoading(false);
      }
    };

    loadKPs();
  }, []);

  const filteredKps = useMemo(() => {
    return kps.filter((kp) => {
      // Фільтр по статусу
      if (statusFilter !== "all" && kp.status && kp.status !== statusFilter) {
        return false;
      }

      // Фільтр по даті події
      if (dateFrom || dateTo) {
        if (!kp.event_date) {
          return false;
        }
        const eventDate = new Date(kp.event_date);
        if (dateFrom && eventDate < new Date(dateFrom)) {
          return false;
        }
        if (dateTo && eventDate > new Date(dateTo)) {
          return false;
        }
      }

      // Пошук по назві КП / клієнту / локації
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const haystack = [
          kp.title,
          kp.client_name,
          kp.event_location,
          kp.event_format,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [kps, statusFilter, dateFrom, dateTo, debouncedSearch]);

  const allVisibleSelected =
    filteredKps.length > 0 &&
    filteredKps.every((kp) => selectedIds.includes(kp.id));

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      const newIds = Array.from(
        new Set([...selectedIds, ...filteredKps.map((kp) => kp.id)])
      );
      setSelectedIds(newIds);
    } else {
      const visibleIds = new Set(filteredKps.map((kp) => kp.id));
      setSelectedIds(selectedIds.filter((id) => !visibleIds.has(id)));
    }
  };

  const toggleSelectOne = (kpId: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, kpId])));
    } else {
      setSelectedIds((prev) => prev.filter((id) => id !== kpId));
    }
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      toast.error("Оберіть хоча б одне КП для формування закупки");
      return;
    }

    setExporting(true);
    try {
      const blob = await purchaseApi.exportPurchase({
        kp_ids: selectedIds,
        format: "excel",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "purchase.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Файл закупки згенеровано");
    } catch (e: any) {
      console.error(e);
      const message =
        e?.data?.detail ||
        e?.message ||
        "Не вдалося згенерувати файл закупки";
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-gray-900 mb-2">Закупка / Excel</h1>
        <p className="text-gray-600">
          Оберіть КП за датою, статусом або пошуком і згенеруйте файл для
          закупки (агрегація позицій меню по всіх вибраних КП).
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>КП для закупки</CardTitle>
            <InfoTooltip content="Виберіть один або кілька КП, які потрібно врахувати в закупці" />
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <Input
              placeholder="Пошук по назві КП, клієнту або локації"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-64"
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as KPStatusFilter)}
            >
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Статус КП" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Усі статуси</SelectItem>
                <SelectItem value="in_progress">В роботі</SelectItem>
                <SelectItem value="sent">Відправлено</SelectItem>
                <SelectItem value="approved">Затверджено</SelectItem>
                <SelectItem value="completed">Виконано</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full md:w-40"
              />
              <span className="hidden md:inline text-gray-500">—</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full md:w-40"
              />
            </div>
            <Button
              onClick={handleExport}
              disabled={exporting || selectedIds.length === 0}
              className="whitespace-nowrap"
            >
              {exporting ? "Формування..." : "Згенерувати Excel для закупки"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) =>
                        toggleSelectAllVisible(!!checked)
                      }
                      aria-label="Обрати всі видимі КП"
                    />
                  </TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Назва КП</TableHead>
                  <TableHead>Клієнт</TableHead>
                  <TableHead>Дата події</TableHead>
                  <TableHead>Локація</TableHead>
                  <TableHead>К-сть гостей</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Завантаження КП...
                    </TableCell>
                  </TableRow>
                ) : filteredKps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Немає КП, які відповідають фільтрам
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredKps.map((kp) => (
                    <TableRow key={kp.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(kp.id)}
                          onCheckedChange={(checked) =>
                            toggleSelectOne(kp.id, !!checked)
                          }
                          aria-label={`Обрати КП ${kp.title}`}
                        />
                      </TableCell>
                      <TableCell className="text-gray-900">{kp.id}</TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="truncate text-gray-900">
                          {kp.title}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <div className="truncate text-gray-700">
                          {kp.client_name || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {kp.event_date
                          ? new Date(kp.event_date).toLocaleDateString("uk-UA")
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="truncate text-gray-700">
                          {kp.event_location || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {kp.people_count ?? "—"}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {kp.status || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


