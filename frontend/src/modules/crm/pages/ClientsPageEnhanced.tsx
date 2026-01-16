import React, { useState, useEffect } from 'react';
import { Menu, X, Plus, Users } from 'lucide-react';
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
    } catch (error) {
      console.error('Error creating client:', error);
      toast.error('Помилка створення клієнта');
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

  const handleOrderCreated = async (orderId: string) => {
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

  const handleEditOrder = () => {
    // TODO: Open edit order dialog
    toast.info('Функція редагування замовлення в розробці');
  };

  const handleOpenClientFromOrder = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      openClientTab(clientId, client.full_name);
    }
  };

  // Get active tab data
  const activeTab = getActiveTab();

  // Render tab content
  const renderTabContent = () => {
    if (!activeTab) {
      return null;
    }

    if (activeTab.type === 'client' && activeClient) {
      return (
        <ClientTabContent
          client={activeClient}
          orders={activeOrders}
          onEditClient={handleEditClient}
          onOpenOrder={handleOpenOrder}
          onCreateOrder={handleCreateOrder}
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
    </div>
  );
}

