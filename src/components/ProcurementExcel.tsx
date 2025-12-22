import { useEffect, useMemo, useState } from "react";
import { KP, kpApi, purchaseApi } from "../lib/api";
import { useDebounce } from "../hooks/useDebounce";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
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
      // Використовуємо новий endpoint для генерації Excel закупки з КП
      const blob = await purchaseApi.generateProcurement({
        kp_ids: selectedIds,
      });

      // Отримуємо назву файлу з заголовка Content-Disposition або використовуємо дефолтну
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Формуємо назву файлу на основі дат вибраних КП
      const selectedKps = kps.filter(kp => selectedIds.includes(kp.id));
      const dates = selectedKps
        .map(kp => kp.event_date ? new Date(kp.event_date) : null)
        .filter(Boolean) as Date[];
      
      let filename = "Закупка";
      if (dates.length > 0) {
        const uniqueDates = [...new Set(dates.map(d => d.toISOString().split('T')[0]))];
        if (uniqueDates.length === 1) {
          const dateStr = uniqueDates[0].split('-').reverse().join('-');
          filename = `Закупка_${dateStr}`;
        } else {
          filename = `Закупка_${dates.length}_КП`;
        }
      }
      filename += ".xlsx";
      
      a.download = filename;
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
        <CardHeader className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CardTitle>КП для закупки</CardTitle>
            <InfoTooltip content="Виберіть один або кілька КП, які потрібно врахувати в закупці" />
          </div>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Пошук по назві КП, клієнту або локації"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as KPStatusFilter)}
              >
                <SelectTrigger className="w-full sm:w-48">
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
              <div className="flex gap-2 items-center">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full sm:w-40"
                />
                <span className="text-gray-500">—</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full sm:w-40"
                />
              </div>
            </div>
            <Button
              onClick={handleExport}
              disabled={exporting || selectedIds.length === 0}
              className="w-full sm:w-auto"
            >
              {exporting ? "Формування..." : selectedIds.length > 0 ? `Згенерувати Excel (${selectedIds.length} КП)` : "Згенерувати Excel для закупки"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
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

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Завантаження КП...
              </div>
            ) : filteredKps.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Немає КП, які відповідають фільтрам
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) =>
                      toggleSelectAllVisible(!!checked)
                    }
                    aria-label="Обрати всі видимі КП"
                  />
                  <span className="text-sm text-gray-600">
                    Обрати всі ({filteredKps.length})
                  </span>
                </div>
                {filteredKps.map((kp) => (
                  <div
                    key={kp.id}
                    className="border rounded-lg p-4 space-y-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.includes(kp.id)}
                        onCheckedChange={(checked) =>
                          toggleSelectOne(kp.id, !!checked)
                        }
                        aria-label={`Обрати КП ${kp.title}`}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {kp.title}
                            </h3>
                            <p className="text-sm text-gray-500">
                              КП #{kp.id}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded whitespace-nowrap">
                            {kp.status || "—"}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 w-20">Клієнт:</span>
                            <span className="text-gray-900 flex-1 truncate">
                              {kp.client_name || "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 w-20">Дата:</span>
                            <span className="text-gray-900">
                              {kp.event_date
                                ? new Date(kp.event_date).toLocaleDateString("uk-UA")
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 w-20">Локація:</span>
                            <span className="text-gray-900 flex-1 truncate">
                              {kp.event_location || "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 w-20">Гостей:</span>
                            <span className="text-gray-900">
                              {kp.people_count ?? "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


