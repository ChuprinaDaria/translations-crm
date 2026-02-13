import { useState, useEffect, useMemo } from "react";
import { Wallet, FileText, StickyNote, Settings, Download } from "lucide-react";
import { FinancePaymentsTable } from "../components/FinancePaymentsTable";
import { ShipmentsTable } from "../components/ShipmentsTable";
import { OrderProfitTable, type OrderProfit } from "../components/OrderProfitTable";
import { financeApi, Payment } from "../api/transactions";
import { shipmentsApi, Shipment } from "../api/shipments";
import { mockPayments } from "../api/mockData";
import { ordersApi } from "../../crm/api/orders";
import { toast } from "sonner";
import { useI18n } from "../../../lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { SidePanel } from "../../../components/ui";
import { Button } from "../../../components/ui/button";
import { QuickActionsSidebar, type QuickAction } from "../../communications/components/QuickActionsSidebar";

// Конфігурація для панелі бічних табів
const getFinanceSidePanelTabs = (t: (key: string) => string) => [
  { id: 'info', icon: FileText, label: t('tabs.info') },
  { id: 'notes', icon: StickyNote, label: t('tabs.notes') },
  { id: 'settings', icon: Settings, label: t('tabs.settings') },
  { id: 'export', icon: Download, label: t('tabs.export') },
];

// Використовувати мокові дані для тестування (встановіть в true для розробки)
const USE_MOCK_DATA = false;

export function FinancePage() {
  const { t } = useI18n();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [orderProfits, setOrderProfits] = useState<OrderProfit[]>([]);
  
  const FINANCE_SIDE_PANEL_TABS = getFinanceSidePanelTabs(t);
  const [loading, setLoading] = useState(true);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [loadingProfits, setLoadingProfits] = useState(true);
  const [sidePanelTab, setSidePanelTab] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  
  // Quick Actions для FinancePage
  const quickActions = useMemo<QuickAction[]>(() => [
    {
      id: 'info',
      icon: FileText,
      tooltip: t('tabs.info'),
      onClick: () => setSidePanelTab(sidePanelTab === 'info' ? null : 'info'),
      disabled: false,
      isActive: sidePanelTab === 'info',
    },
    {
      id: 'notes',
      icon: StickyNote,
      tooltip: t('tabs.notes'),
      onClick: () => setSidePanelTab(sidePanelTab === 'notes' ? null : 'notes'),
      disabled: false,
      isActive: sidePanelTab === 'notes',
    },
    {
      id: 'settings',
      icon: Settings,
      tooltip: t('tabs.settings'),
      onClick: () => setSidePanelTab(sidePanelTab === 'settings' ? null : 'settings'),
      disabled: false,
      isActive: sidePanelTab === 'settings',
    },
    {
      id: 'export',
      icon: Download,
      tooltip: t('tabs.export'),
      onClick: () => setSidePanelTab(sidePanelTab === 'export' ? null : 'export'),
      disabled: false,
      isActive: sidePanelTab === 'export',
    },
  ], [t, sidePanelTab]);

  useEffect(() => {
    loadPayments();
    loadShipments();
    loadOrderProfits();
    
    // Слухаємо події зміни payment_method для оновлення даних
    const handlePaymentMethodChange = () => {
      loadPayments();
      loadOrderProfits();
    };
    
    // Слухаємо загальні оновлення замовлень (зміна мови, перекладачів, цін тощо)
    const handleOrderUpdate = () => {
      loadPayments();
      loadOrderProfits();
    };
    
    // Слухаємо оновлення перекладачів (зміна ставок, призначення тощо)
    const handleTranslatorsUpdate = () => {
      loadOrderProfits(); // Оновлюємо тільки прибуток, бо перекладачі впливають на розрахунок
    };
    
    window.addEventListener('orderPaymentMethodChanged', handlePaymentMethodChange);
    window.addEventListener('orderUpdated', handleOrderUpdate);
    window.addEventListener('orderTranslatorsUpdated', handleTranslatorsUpdate);
    
    return () => {
      window.removeEventListener('orderPaymentMethodChanged', handlePaymentMethodChange);
      window.removeEventListener('orderUpdated', handleOrderUpdate);
      window.removeEventListener('orderTranslatorsUpdated', handleTranslatorsUpdate);
    };
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      
      if (USE_MOCK_DATA) {
        // Використовуємо мокові дані для тестування
        await new Promise(resolve => setTimeout(resolve, 500)); // Симуляція затримки
        setPayments(mockPayments);
      } else {
        // Завантажуємо дані з API
        const data = await financeApi.getPayments();
        setPayments(data);
      }
    } catch (error: any) {
      console.error("Error loading payments:", error);
      toast.error(t('finance.payments.loadError'));
      
      // Якщо API не доступний, використовуємо мокові дані як fallback
      if (!USE_MOCK_DATA) {
        console.warn("API недоступний, використовуються мокові дані");
        setPayments(mockPayments);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadShipments = async () => {
    try {
      setLoadingShipments(true);
      const data = await shipmentsApi.getShipments({ limit: 1000 });
      setShipments(data);
    } catch (error: any) {
      console.error("Error loading shipments:", error);
      toast.error("Помилка завантаження відправок");
      setShipments([]);
    } finally {
      setLoadingShipments(false);
    }
  };

  const loadOrderProfits = async () => {
    try {
      setLoadingProfits(true);
      
      // Завантажуємо всі замовлення з транзакціями та перекладачами
      const orders = await ordersApi.getOrders({ limit: 1000 });
      
      // Обчислюємо різницю для кожного замовлення
      const profits: OrderProfit[] = orders
        .filter(order => {
          // Показуємо замовлення з оплатою від клієнта (price_brutto або транзакції)
          const hasPriceBrutto = order.price_brutto && order.price_brutto > 0;
          const hasClientPayment = order.transactions?.some(t => t.type === "income");
          return hasPriceBrutto || hasClientPayment;
        })
        .map(order => {
          // Оплата від клієнта: використовуємо price_brutto якщо є, інакше з транзакцій
          const clientPayment = order.price_brutto || 
            (order.transactions
              ?.filter(t => t.type === "income")
              .reduce((sum, t) => sum + t.amount, 0) || 0);

          // Оплата перекладачу (expense транзакції або гонорар з запиту)
          const translatorPayment = order.transactions
            ?.filter(t => t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0) || 
            order.translation_requests
              ?.find(req => req.status === "accepted")
              ?.offered_rate || 0;

          const profit = clientPayment - translatorPayment;
          const profitPercent = clientPayment > 0 
            ? (profit / clientPayment) * 100 
            : 0;

          return {
            orderId: order.id,
            orderNumber: order.order_number,
            clientName: order.client?.full_name || "Невідомий клієнт",
            clientPayment,
            translatorPayment,
            profit,
            profitPercent,
            created_at: order.created_at,
          };
        });

      setOrderProfits(profits);
    } catch (error: any) {
      console.error("Error loading order profits:", error);
      toast.error("Помилка завантаження даних про прибуток");
      setOrderProfits([]);
    } finally {
      setLoadingProfits(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await financeApi.exportPaymentsToExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `platnosci_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(t('finance.payments.exportSuccess'));
    } catch (e: any) {
      console.error(e);
      toast.error(t('finance.payments.exportError'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Ліва частина: Основний контент */}
      <div className="flex-1 min-w-0 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <Wallet className="w-8 h-8 text-[#FF5A00]" />
          <h1 className="text-2xl font-semibold text-gray-900">{t('finance.title')}</h1>
        </div>
        
        <Tabs defaultValue="payments" className="w-full flex-1 flex flex-col">
          <TabsList className="w-max">
            <TabsTrigger value="payments">Płatności</TabsTrigger>
            <TabsTrigger value="shipments">Відправки</TabsTrigger>
            <TabsTrigger value="profits">Різниця оплат</TabsTrigger>
          </TabsList>
          
          <TabsContent value="payments" className="flex-1 mt-6 min-h-0">
            {/* min-w-0 тут критично важливий для вкладених флексів */}
            <div className="min-w-0 w-full">
              <FinancePaymentsTable payments={payments || []} loading={loading} />
            </div>
          </TabsContent>
          
          <TabsContent value="shipments" className="flex-1 mt-6 min-h-0">
            <div className="min-w-0 w-full">
              <ShipmentsTable shipments={shipments || []} loading={loadingShipments} />
            </div>
          </TabsContent>
          
          <TabsContent value="profits" className="flex-1 mt-6 min-h-0">
            <div className="min-w-0 w-full">
              <OrderProfitTable orders={orderProfits || []} loading={loadingProfits} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* QuickActionsSidebar - full height, right side */}
      <div className="flex-shrink-0 h-full">
        <QuickActionsSidebar actions={quickActions} />
      </div>

      {/* SidePanel - Бокова панель з контентом */}
      <SidePanel
        open={sidePanelTab !== null}
        onClose={() => setSidePanelTab(null)}
        title={FINANCE_SIDE_PANEL_TABS.find(tab => tab.id === sidePanelTab)?.label}
        width="md"
      >
        {sidePanelTab === 'info' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Інформація про фінанси</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-500">Всього платежів:</span>
                <span className="ml-2 font-medium text-gray-900">{payments.length}</span>
              </div>
              <div>
                <span className="text-gray-500">Відправок:</span>
                <span className="ml-2 font-medium text-gray-900">{shipments.length}</span>
              </div>
              <div>
                <span className="text-gray-500">Замовлень з прибутком:</span>
                <span className="ml-2 font-medium text-gray-900">{orderProfits.length}</span>
              </div>
            </div>
          </div>
        )}
        
        {sidePanelTab === 'notes' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Нотатки</h4>
            <p className="text-sm text-gray-500">Функціонал нотаток буде додано пізніше</p>
          </div>
        )}
        
        {sidePanelTab === 'settings' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Налаштування</h4>
            <p className="text-sm text-gray-500">Налаштування фінансів</p>
          </div>
        )}
        
        {sidePanelTab === 'export' && (
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Експорт до Excel</h4>
            <p className="text-sm text-gray-500 mb-4">
              Експортуйте всі платежі до файлу Excel для подальшого аналізу або звітності.
            </p>
            <Button
              onClick={handleExport}
              disabled={exporting || payments.length === 0}
              className="gap-2 w-full"
            >
              <Download className="w-4 h-4" />
              {exporting ? t('finance.payments.exporting') : t('finance.payments.export')}
            </Button>
            {payments.length === 0 && (
              <p className="text-xs text-gray-400 mt-2">Немає платежів для експорту</p>
            )}
          </div>
        )}
      </SidePanel>
    </div>
  );
}

