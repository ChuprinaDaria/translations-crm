import { useState, useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../components/ui/command";
import { FileText, User, ArrowRight, Plus } from "lucide-react";
import { kpApi, clientsApi } from "../../../lib/api";
import { toast } from "sonner";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [kps, setKps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Завантаження даних при відкритті
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientsData, kpsData] = await Promise.all([
        clientsApi.getClients(0, 20, ""),
        kpApi.getKPs(),
      ]);
      setClients(clientsData.clients || []);
      setKps(kpsData || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = async (action: string, value?: any) => {
    switch (action) {
      case "create-order":
        // Відкриваємо модалку створення замовлення
        // Можна використати глобальний стан або подію
        window.dispatchEvent(new CustomEvent("command:create-order"));
        onOpenChange(false);
        break;

      case "go-to-client":
        if (value?.id) {
          // Перехід до картки клієнта
          window.dispatchEvent(
            new CustomEvent("command:navigate", { detail: { path: `/clients/${value.id}` } })
          );
          onOpenChange(false);
        }
        break;

      case "change-status":
        if (value?.kpId && value?.status) {
          try {
            await kpApi.updateKPStatus(value.kpId, value.status);
            toast.success(`Статус змінено на ${value.status}`);
            onOpenChange(false);
            // Оновлюємо дані
            loadData();
          } catch (error) {
            toast.error("Не вдалося змінити статус");
          }
        }
        break;

      default:
        break;
    }
  };

  // Фільтрація клієнтів
  const filteredClients = clients.filter((client) =>
    client.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Фільтрація КП
  const filteredKps = kps.filter(
    (kp) =>
      kp.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kp.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Шукати команди, клієнтів, замовлення..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Завантаження..." : "Нічого не знайдено"}
        </CommandEmpty>

        {/* Швидкі дії */}
        <CommandGroup heading="Дії">
          <CommandItem
            onSelect={() => handleSelect("create-order")}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Створити замовлення</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </CommandItem>
        </CommandGroup>

        {/* Клієнти */}
        {filteredClients.length > 0 && (
          <CommandGroup heading="Клієнти">
            {filteredClients.slice(0, 5).map((client) => (
              <CommandItem
                key={client.id}
                onSelect={() => handleSelect("go-to-client", client)}
                className="flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                <span>{client.name}</span>
                {client.company_name && (
                  <span className="text-xs text-gray-500">({client.company_name})</span>
                )}
                <ArrowRight className="w-4 h-4 ml-auto" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Замовлення */}
        {filteredKps.length > 0 && (
          <CommandGroup heading="Замовлення">
            {filteredKps.slice(0, 5).map((kp) => (
              <CommandItem
                key={kp.id}
                onSelect={() => {
                  window.dispatchEvent(
                    new CustomEvent("command:navigate", {
                      detail: { path: `/crm`, kpId: kp.id },
                    })
                  );
                  onOpenChange(false);
                }}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <div className="flex-1">
                  <div className="font-medium">{kp.title}</div>
                  {kp.client_name && (
                    <div className="text-xs text-gray-500">{kp.client_name}</div>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 ml-auto" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Швидка зміна статусу */}
        {searchQuery.toLowerCase().includes("статус") && (
          <CommandGroup heading="Змінити статус">
            {["DO_WYKONANIA", "DO_POSWIADCZENIA", "DO_WYDANIA", "USTNE", "CLOSED"].map(
              (status) => (
                <CommandItem
                  key={status}
                  onSelect={() => {
                    const kpId = filteredKps[0]?.id;
                    if (kpId) {
                      handleSelect("change-status", { kpId, status });
                    } else {
                      toast.error("Оберіть замовлення");
                    }
                  }}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Змінити статус на: {status}
                </CommandItem>
              )
            )}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

