import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../components/ui/sheet";
import { Button } from "../../../components/ui/button";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Card } from "../../../components/ui/card";
import { Plus, FileText, Calendar, DollarSign, Loader2 } from "lucide-react";
import { clientsApi, kpApi, KP } from "../../../lib/api";

interface ContextSidebarProps {
  clientId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateOrder?: (clientId: number) => void;
}

export function ContextSidebar({
  clientId,
  open,
  onOpenChange,
  onCreateOrder,
}: ContextSidebarProps) {
  const [client, setClient] = useState<any>(null);
  const [orders, setOrders] = useState<KP[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && clientId) {
      loadClientData();
    }
  }, [open, clientId]);

  const loadClientData = async () => {
    if (!clientId) return;

    setIsLoading(true);
    try {
      const [clientData, allKps] = await Promise.all([
        clientsApi.getClient(clientId),
        kpApi.getKPs(),
      ]);

      setClient(clientData.client);
      // Фільтруємо замовлення для цього клієнта
      const clientOrders = allKps.filter((kp) => kp.client_id === clientId);
      setOrders(clientOrders);

      // TODO: Завантажити історію оплат з API
      setPayments([]);
    } catch (error) {
      console.error("Failed to load client data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrder = () => {
    if (clientId && onCreateOrder) {
      onCreateOrder(clientId);
      onOpenChange(false);
    }
  };

  if (!clientId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Контекст клієнта</SheetTitle>
          <SheetDescription>
            Активні замовлення та історія взаємодії
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF5A00]" />
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-120px)] mt-6">
            <div className="space-y-6">
              {/* Інформація про клієнта */}
              {client && (
                <Card className="p-4">
                  <h3 className="font-semibold text-lg mb-2">{client.name}</h3>
                  {client.company_name && (
                    <p className="text-sm text-gray-600 mb-2">{client.company_name}</p>
                  )}
                  {client.phone && (
                    <p className="text-sm text-gray-600">{client.phone}</p>
                  )}
                  {client.email && (
                    <p className="text-sm text-gray-600">{client.email}</p>
                  )}
                </Card>
              )}

              {/* Кнопка створення замовлення */}
              <Button
                onClick={handleCreateOrder}
                className="w-full bg-[#FF5A00] hover:bg-[#FF5A00]/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Створити замовлення
              </Button>

              {/* Активні замовлення */}
              <div>
                <h3 className="font-semibold text-sm text-gray-900 mb-3">
                  Активні замовлення ({orders.length})
                </h3>
                {orders.length === 0 ? (
                  <p className="text-sm text-gray-500">Немає активних замовлень</p>
                ) : (
                  <div className="space-y-2">
                    {orders.map((order) => (
                      <Card
                        key={order.id}
                        className="p-3 cursor-pointer hover:border-[#FF5A00] transition-colors"
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent("command:navigate", {
                              detail: { path: "/crm", kpId: order.id },
                            })
                          );
                          onOpenChange(false);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="w-4 h-4 text-gray-500" />
                              <span className="font-medium text-sm">{order.title}</span>
                            </div>
                            {order.event_date && (
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {new Date(order.event_date).toLocaleDateString("uk-UA", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            )}
                            {order.total_price && (
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                <DollarSign className="w-3 h-3" />
                                <span>{order.total_price} грн</span>
                              </div>
                            )}
                          </div>
                          {order.status && (
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {order.status}
                            </span>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Історія оплат */}
              <div>
                <h3 className="font-semibold text-sm text-gray-900 mb-3">
                  Історія оплат
                </h3>
                {payments.length === 0 ? (
                  <p className="text-sm text-gray-500">Немає записів про оплати</p>
                ) : (
                  <div className="space-y-2">
                    {payments.map((payment, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{payment.amount} грн</p>
                            <p className="text-xs text-gray-500">{payment.date}</p>
                          </div>
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                            {payment.status}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

