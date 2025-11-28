import React, { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { kpApi, type KP } from "../lib/api";
import { toast } from "sonner";

interface ClientRow {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  kpCount: number;
}

export function Clients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadClients = async () => {
      try {
        const kps: KP[] = await kpApi.getKPs();

        const map = new Map<string, ClientRow>();

        kps.forEach((kp) => {
          const name = kp.title || "Без назви";
          const email = kp.client_email || "";
          const phone = kp.client_phone || "";
          const key = `${name}|${email}|${phone}`;

          const existing = map.get(key);
          if (existing) {
            existing.kpCount += 1;
          } else {
            map.set(key, {
              id: key,
              name,
              email: email || undefined,
              phone: phone || undefined,
              kpCount: 1,
            });
          }
        });

        setClients(Array.from(map.values()));
      } catch (error: any) {
        console.error("Error loading clients:", error);
        toast.error("Помилка завантаження клієнтів");
      }
    };

    loadClients();
  }, []);

  const filtered = clients.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl text-gray-900 mb-2">Клієнти</h1>
        <p className="text-sm md:text-base text-gray-600">
          Клієнти, що автоматично зберігаються при створенні КП
        </p>
      </div>

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
                  <TableHead className="min-w-[180px]">Email</TableHead>
                  <TableHead className="min-w-[140px]">Телефон</TableHead>
                  <TableHead className="min-w-[80px]">Кількість КП</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-gray-500">
                      Клієнтів ще немає
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{client.name}</span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {client.email || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {client.phone || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-900">
                        {client.kpCount}
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
    </div>
  );
}


