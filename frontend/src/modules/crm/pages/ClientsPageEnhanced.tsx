import React, { useState, useEffect } from 'react';
import { Menu, X, Plus, Users, MessageSquare, Phone, Building } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../../components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { toast } from 'sonner';

import { ClientsSidebar, type ClientListItem } from '../components/ClientsSidebar';
import { ClientTabsArea } from '../components/ClientTabsArea';
import { ClientTabContent } from '../components/ClientTabContent';
import { OrderTabContent } from '../components/OrderTabContent';
import { OrderDetailSheet } from '../components/OrderDetailSheet';
import type { Order as KanbanOrder } from '../components/KanbanCard';
import { useClientTabs, type ClientTabData, type OrderTabData } from '../hooks/useClientTabs';
import { clientsApi, type Client, type Order } from '../api/clients';
import { ordersApi } from '../api/orders';
import { cn } from '../../../components/ui/utils';
import { CreateOrderDialog } from '../../communications/components/SmartActions/CreateOrderDialog';

/**
 * Enhanced Clients Page with Chrome-like tabs
 * 
 * Layout:
 * - Left sidebar (280px): Search, filters, client list
 * - Main area: Chrome-style tabs + content
 */
export function ClientsPageEnhanced() {
  // State
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Client/Order data for active tab
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const [isEditOrderOpen, setIsEditOrderOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<KanbanOrder | null>(null);

  // Create client dialog
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    full_name: '',
    phone: '',
    email: '',
    source: 'manual' as const,
  });
  const [isCreating, setIsCreating] = useState(false);

  // Create order dialog
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);

  // Tabs hook
  const {
    tabs,
    activeTabId,
    openClientTab,
    openOrderTab,
    closeTab,
    switchTab,
    isMaxTabsReached,
    getActiveTab,
  } = useClientTabs();

  // Responsive detection
  useEffect(() => {
    const checkBreakpoint = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  // Load clients
  useEffect(() => {
    loadClients();
  }, []);

  // Load data for active tab
  useEffect(() => {
    const activeTab = getActiveTab();
    if (!activeTab) {
      setActiveClient(null);
      setActiveOrders([]);
      setActiveOrder(null);
      return;
    }

    if (activeTab.type === 'client') {
      loadClientData((activeTab as ClientTabData).clientId);
    } else {
      loadOrderData((activeTab as OrderTabData).orderId);
    }
  }, [activeTabId]);

  // Listen for order updates to sync with client card
  useEffect(() => {
    const handleOrderUpdate = async (event: CustomEvent) => {
      const { orderId, clientId } = event.detail;
      
      // Якщо відкрита картка клієнта, оновлюємо дані
      if (activeClient && clientId && activeClient.id === clientId) {
        await loadClientData(clientId);
      }
      
      // Якщо відкрите замовлення, оновлюємо його
      if (activeOrder && activeOrder.id === orderId) {
        await loadOrderData(orderId);
      }
      
      // Оновлюємо список клієнтів для відображення актуальних сум
      await loadClients();
    };

    const handleTranslatorsUpdate = async (event: CustomEvent) => {
      const { orderId, clientId } = event.detail;
      
      // Якщо відкрита картка клієнта, оновлюємо дані
      if (activeClient && clientId && activeClient.id === clientId) {
        await loadClientData(clientId);
      }
      
      // Якщо відкрите замовлення, оновлюємо його
      if (activeOrder && activeOrder.id === orderId) {
        await loadOrderData(orderId);
      }
    };

    window.addEventListener('orderUpdated', handleOrderUpdate as EventListener);
    window.addEventListener('orderTranslatorsUpdated', handleTranslatorsUpdate as EventListener);
    
    return () => {
      window.removeEventListener('orderUpdated', handleOrderUpdate as EventListener);
      window.removeEventListener('orderTranslatorsUpdated', handleTranslatorsUpdate as EventListener);
    };
  }, [activeClient, activeOrder]);

  const loadClients = async () => {
    try {
      setIsLoading(true);
      const data = await clientsApi.getClients({ limit: 200 });
      
      // Transform to ClientListItem format
      const items: ClientListItem[] = data.map((client) => ({
        id: client.id,
        full_name: client.full_name,
        email: client.email,
        phone: client.phone,
        source: client.source,
        created_at: client.created_at,
        orders_count: client.orders?.length || 0,
        total_amount: client.orders?.reduce((sum, o) => {
          const income = o.transactions?.reduce((s, t) => t.type === 'income' ? s + t.amount : s, 0) || 0;
          return sum + income;
        }, 0) || 0,
        last_order_date: client.orders?.length 
          ? client.orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at 
          : undefined,
      }));

      setClients(items);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Помилка завантаження клієнтів');
    } finally {
      setIsLoading(false);
    }
  };

  const loadClientData = async (clientId: string) => {
    try {
      setIsLoadingTab(true);
      setActiveOrder(null);
      
      const client = await clientsApi.getClient(clientId);
      setActiveClient(client);
      
      // Load client orders
      const orders = await ordersApi.getOrders({ client_id: clientId });
      setActiveOrders(orders);
    } catch (error) {
      console.error('Error loading client data:', error);
      toast.error('Помилка завантаження даних клієнта');
    } finally {
      setIsLoadingTab(false);
    }
  };

  const loadOrderData = async (orderId: string) => {
    try {
      setIsLoadingTab(true);
      setActiveClient(null);
      setActiveOrders([]);
      
      const order = await ordersApi.getOrder(orderId);
      setActiveOrder(order);
    } catch (error) {
      console.error('Error loading order data:', error);
      toast.error('Помилка завантаження даних замовлення');
    } finally {
      setIsLoadingTab(false);
    }
  };

  const handleSelectClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      const success = openClientTab(clientId, client.full_name);
      if (!success) {
        toast.warning('Забагато відкритих табів. Закрийте деякі, щоб відкрити нові.');
      }
    }
    
    // Close mobile sidebar
    if (isMobile) {
      setIsMobileSidebarOpen(false);
    }
  };

  const handleOpenOrder = (orderId: string, orderNumber: string) => {
    const success = openOrderTab(orderId, orderNumber, activeClient?.id);
    if (!success) {
      toast.warning('Забагато відкритих табів. Закрийте деякі, щоб відкрити нові.');
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.full_name.trim() || !newClient.phone.trim()) {
      toast.error("Введіть ім'я та телефон клієнта");
      return;
    }

    try {
      setIsCreating(true);
      const created = await clientsApi.createClient(newClient);
      
      // Add to list
      const newItem: ClientListItem = {
        id: created.id,
        full_name: created.full_name,
        email: created.email,
        phone: created.phone,
        source: created.source,
        created_at: created.created_at,
        orders_count: 0,
        total_amount: 0,
      };
      setClients((prev) => [newItem, ...prev]);
      
      // Open tab
      openClientTab(created.id, created.full_name);
      
      // Reset form
      setNewClient({ full_name: '', phone: '', email: '', source: 'manual' });
      setIsCreateClientOpen(false);
      
      toast.success('Клієнта створено');
    } catch (error: any) {
      console.error('Error creating client:', error);
      
      // Handle duplicate client error (from ApiError.data.detail)
      const errorDetail = error?.data?.detail || error?.detail;
      
      if (errorDetail?.type === 'duplicate_client') {
        const message = errorDetail.message || 'Клієнт з таким телефоном або email вже існує';
        toast.error(message);
        
        // If client_id is provided, open that client's tab
        if (errorDetail.client_id) {
          openClientTab(errorDetail.client_id, '');
        }
      } else if (errorDetail?.message) {
        toast.error(errorDetail.message);
      } else if (typeof errorDetail === 'string') {
        toast.error(errorDetail);
      } else if (error?.message) {
        toast.error(error.message);
      } else {
        toast.error('Помилка створення клієнта');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleNewClient = () => {
    setIsCreateClientOpen(true);
  };

  const handleCreateOrder = () => {
    if (!activeClient) return;
    setIsCreateOrderOpen(true);
  };

  const handleOrderCreated = async (_orderId: string) => {
    // Reload client data to get updated orders list
    if (activeClient) {
      await loadClientData(activeClient.id);
    }
    toast.success('Замовлення створено успішно');
  };

  const handleEditClient = () => {
    // TODO: Open edit client dialog
    toast.info('Функція редагування клієнта в розробці');
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await clientsApi.deleteClient(clientId);
      
      // Close the tab
      closeTab(clientId);
      
      // Remove from sidebar list
      setClients(prev => prev.filter(c => c.id !== clientId));
      
      toast.success('Клієнт видалений з усіма даними');
    } catch (error: any) {
      console.error('Error deleting client:', error);
      toast.error(error?.message || 'Помилка видалення клієнта');
    }
  };

  const mapApiStatusToKanban = (status: Order["status"]): KanbanOrder["status"] => {
    switch (status) {
      case "do_wykonania":
        return "DO_WYKONANIA";
      case "do_poswiadczenia":
        return "DO_POSWIADCZENIA";
      case "do_wydania":
        return "DO_WYDANIA";
      case "ustne":
        return "USTNE";
      case "closed":
      default:
        return "CLOSED";
    }
  };

  const mapKanbanStatusToApi = (status: KanbanOrder["status"]): Order["status"] => {
    switch (status) {
      case "DO_WYKONANIA":
        return "do_wykonania";
      case "DO_POSWIADCZENIA":
        return "do_poswiadczenia";
      case "DO_WYDANIA":
        return "do_wydania";
      case "USTNE":
        return "ustne";
      case "CLOSED":
      default:
        return "closed";
    }
  };

  const buildEditableOrder = (order: Order): KanbanOrder => {
    const acceptedRequest = order.translation_requests?.find((req) => req.status === "accepted");
    const clientPrice = order.transactions?.find((t) => t.type === "income")?.amount;

    return {
      id: order.id,
      orderNumber: order.order_number,
      clientName: order.client?.full_name || "Невідомий клієнт",
      clientId: order.client_id,
      deadline: order.deadline ? new Date(order.deadline) : new Date(),
      status: mapApiStatusToKanban(order.status),
      managerName: order.manager_id,
      documentType: order.description,
      price: clientPrice,
      translatorId: acceptedRequest ? String(acceptedRequest.translator_id) : undefined,
      translatorName: acceptedRequest?.translator?.name,
      translatorRate: acceptedRequest?.offered_rate,
      translatorFee: acceptedRequest?.offered_rate,
    };
  };

  const handleEditOrder = () => {
    if (!activeOrder) {
      toast.error('Немає даних замовлення для редагування');
      return;
    }
    setEditOrder(buildEditableOrder(activeOrder));
    setIsEditOrderOpen(true);
  };

  const handleSaveEditedOrder = async (updatedOrder: KanbanOrder) => {
    if (!activeOrder) return;
    try {
      await ordersApi.updateOrder(activeOrder.id, {
        order_number: updatedOrder.orderNumber,
        status: mapKanbanStatusToApi(updatedOrder.status),
        deadline: updatedOrder.deadline ? new Date(updatedOrder.deadline).toISOString() : undefined,
      });
      await loadOrderData(activeOrder.id);
      if (activeOrder.client_id) {
        await loadClientData(activeOrder.client_id);
      }
      toast.success('Замовлення оновлено');
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast.error(error?.message || 'Помилка оновлення замовлення');
    }
  };

  const handleOpenClientFromOrder = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      openClientTab(clientId, client.full_name);
    }
  };

  // Get active tab data
  const activeTab = getActiveTab();

  // Platform icons mapping (same as in ClientsSidebar)
  const platformIcons: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    telegram: { icon: MessageSquare, color: 'text-blue-500', label: 'Telegram' },
    whatsapp: { icon: MessageSquare, color: 'text-green-500', label: 'WhatsApp' },
    instagram: { icon: MessageSquare, color: 'text-pink-500', label: 'Instagram' },
    email: { icon: MessageSquare, color: 'text-gray-500', label: 'Email' },
    facebook: { icon: MessageSquare, color: 'text-blue-600', label: 'Facebook' },
    manual: { icon: Phone, color: 'text-gray-600', label: 'Formularz' },
    office_visit: { icon: Building, color: 'text-purple-500', label: 'Візит в офіс' },
  };

  // Render tab content
  const renderTabContent = () => {
    // If no active tab, show client list in main area
    if (!activeTab) {
      return (
        <div className="h-full flex flex-col">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Всі клієнти</h2>
            <p className="text-sm text-gray-500 mt-1">Оберіть клієнта зі списку або створіть нового</p>
          </div>
          <div className="flex-1 overflow-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
                  <p className="text-gray-500">Завантаження клієнтів...</p>
                </div>
              </div>
            ) : clients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Users className="w-16 h-16 mb-4 text-[#FF5A00] opacity-30" />
                <h3 className="text-lg font-medium mb-2">Немає клієнтів</h3>
                <p className="text-sm text-gray-400 mb-4">Створіть першого клієнта</p>
                <Button onClick={handleNewClient} className="bg-[#FF5A00] hover:bg-[#FF5A00]/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Новий клієнт
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map((client) => {
                  const iconConfig = platformIcons[client.source] || platformIcons.manual;
                  const Icon = iconConfig.icon;
                  return (
                    <div
                      key={client.id}
                      onClick={() => handleSelectClient(client.id)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-[#FF5A00] hover:shadow-md transition-all cursor-pointer bg-white"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-[#FF5A00]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">{client.full_name}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(client.created_at).toLocaleDateString('uk-UA')}
                            </p>
                          </div>
                        </div>
                        <Icon className={cn('w-4 h-4 shrink-0', iconConfig.color)} />
                      </div>
                      {client.phone && (
                        <div className="text-sm text-gray-600 mb-1 truncate">{client.phone}</div>
                      )}
                      {client.email && (
                        <div className="text-sm text-gray-500 truncate">{client.email}</div>
                      )}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          Замовлень: <span className="font-medium text-gray-700">{client.orders_count || 0}</span>
                        </span>
                        {client.total_amount && client.total_amount > 0 && (
                          <span className="text-gray-700 font-medium">
                            {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(client.total_amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab.type === 'client' && activeClient) {
      return (
        <ClientTabContent
          client={activeClient}
          orders={activeOrders}
          onEditClient={handleEditClient}
          onOpenOrder={handleOpenOrder}
          onCreateOrder={handleCreateOrder}
          onDeleteClient={handleDeleteClient}
          isLoading={isLoadingTab}
        />
      );
    }

    if (activeTab.type === 'order' && activeOrder) {
      return (
        <OrderTabContent
          order={activeOrder}
          onEditOrder={handleEditOrder}
          onOpenClient={handleOpenClientFromOrder}
          isLoading={isLoadingTab}
        />
      );
    }

    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p>Завантаження...</p>
        </div>
      </div>
    );
  };

  // Sidebar component
  const sidebar = (
    <ClientsSidebar
      clients={clients}
      selectedClientId={activeTab?.type === 'client' ? (activeTab as ClientTabData).clientId : undefined}
      onSelectClient={handleSelectClient}
      isLoading={isLoading}
    />
  );

  return (
    <div className="space-y-6">
      {/* Page Header - same style as Finance */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-[#FF5A00]" />
          <h1 className="text-2xl font-semibold text-gray-900">Клієнти</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <Button
            onClick={handleNewClient}
            className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Новий клієнт
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* Tabs + Content Area - LEFT */}
        <main className="flex-1 flex flex-col overflow-hidden border border-gray-200 rounded-lg bg-white">
          <ClientTabsArea
            tabs={tabs}
            activeTabId={activeTabId}
            onTabChange={switchTab}
            onTabClose={closeTab}
            onNewClient={handleNewClient}
            isMaxTabsReached={isMaxTabsReached}
          >
            {renderTabContent()}
          </ClientTabsArea>
        </main>

        {/* Right Sidebar - Clients List - Desktop */}
        <aside
          className={cn(
            'w-[280px] border border-gray-200 rounded-lg bg-white shrink-0 overflow-hidden',
            'hidden md:flex flex-col'
          )}
        >
          {sidebar}
        </aside>
      </div>

      {/* Mobile Sidebar Drawer - Opens from RIGHT */}
      <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
        <SheetContent side="right" className="w-[300px] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Клієнти
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto">
            {sidebar}
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Client Dialog */}
      <Dialog open={isCreateClientOpen} onOpenChange={setIsCreateClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новий клієнт</DialogTitle>
            <DialogDescription>
              Введіть дані нового клієнта
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Ім'я / ПІБ *</Label>
              <Input
                id="full_name"
                value={newClient.full_name}
                onChange={(e) => setNewClient((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="Введіть ім'я клієнта"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Телефон *</Label>
              <Input
                id="phone"
                value={newClient.phone}
                onChange={(e) => setNewClient((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+48 123 456 789"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newClient.email}
                onChange={(e) => setNewClient((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="source">Джерело</Label>
              <Select
                value={newClient.source}
                onValueChange={(v) => setNewClient((prev) => ({ ...prev, source: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="manual">Formularz kontaktowy</SelectItem>
                  <SelectItem value="office_visit">Візит в офіс</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateClientOpen(false)}
              disabled={isCreating}
            >
              Скасувати
            </Button>
            <Button
              onClick={handleCreateClient}
              disabled={isCreating || !newClient.full_name.trim() || !newClient.phone.trim()}
              className="bg-[#FF5A00] hover:bg-[#FF5A00]/90"
            >
              {isCreating ? 'Створення...' : 'Створити'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Order Dialog */}
      {activeClient && (
        <CreateOrderDialog
          open={isCreateOrderOpen}
          onOpenChange={setIsCreateOrderOpen}
          clientId={activeClient.id}
          onSuccess={handleOrderCreated}
        />
      )}

      {isEditOrderOpen && (
        <OrderDetailSheet
          order={editOrder}
          open={isEditOrderOpen}
          onOpenChange={setIsEditOrderOpen}
          onSave={handleSaveEditedOrder}
        />
      )}
    </div>
  );
}

