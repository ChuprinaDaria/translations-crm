import React, { useState, useEffect } from "react";
import { Search, Loader2, User, Phone, Mail, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { clientsApi, type Client } from "../lib/api";
import { useDebouncedCallback } from "../hooks/useDebounce";

interface ClientSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (client: Client) => void;
}

export function ClientSelectDialog({
  open,
  onOpenChange,
  onSelect,
}: ClientSelectDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced пошук
  const debouncedSearch = useDebouncedCallback(
    async (query: string) => {
      if (!query || query.trim().length < 2) {
        setClients([]);
        setHasSearched(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasSearched(true);
      try {
        const result = await clientsApi.getClients(0, 20, query.trim());
        setClients(result.clients);
      } catch (error) {
        console.error("Error searching clients:", error);
        setClients([]);
      } finally {
        setIsLoading(false);
      }
    },
    300
  );

  useEffect(() => {
    if (open && searchQuery) {
      debouncedSearch(searchQuery);
    } else if (open && !searchQuery) {
      setClients([]);
      setHasSearched(false);
    }
  }, [searchQuery, open, debouncedSearch]);

  const handleSelect = (client: Client) => {
    onSelect(client);
    onOpenChange(false);
    setSearchQuery("");
    setClients([]);
    setHasSearched(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSearchQuery("");
    setClients([]);
    setHasSearched(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Вибрати існуючого клієнта</DialogTitle>
          <DialogDescription>
            Введіть ім'я, телефон, email або назву компанії для пошуку
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Поле пошуку */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук клієнта..."
              className="pl-10 h-12 text-base"
              autoFocus
            />
          </div>

          {/* Результати пошуку */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#FF5A00]" />
                <span className="ml-2 text-gray-600">Пошук...</span>
              </div>
            ) : !hasSearched ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Введіть запит для пошуку клієнта</p>
                </div>
              </div>
            ) : clients.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <div className="text-center">
                  <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Клієнтів не знайдено</p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleSelect(client)}
                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-semibold text-gray-900">
                            {client.name}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600 ml-6">
                          {client.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3 h-3" />
                              <span>{client.phone}</span>
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-3 h-3" />
                              <span>{client.email}</span>
                            </div>
                          )}
                          {client.company_name && (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3 h-3" />
                              <span>{client.company_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(client);
                        }}
                      >
                        Вибрати
                      </Button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

