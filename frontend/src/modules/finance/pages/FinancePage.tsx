import { useState, useEffect } from "react";
import { Wallet, FileText, StickyNote, Settings } from "lucide-react";
import { FinancePaymentsTable } from "../components/FinancePaymentsTable";
import { OrderProfitTable, type OrderProfit } from "../components/OrderProfitTable";
import { financeApi, Payment } from "../api/transactions";
import { mockPayments } from "../api/mockData";
import { ordersApi } from "../../crm/api/orders";
import { toast } from "sonner";
import { useI18n } from "../../../lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { SideTabs, SidePanel, type SideTab } from "../../../components/ui";

// Конфігурація табів для Finance
const FINANCE_SIDE_TABS: SideTab[] = [
  { id: 'info', icon: FileText, label: 'Інформація', color: 'blue' },
  { id: 'notes', icon: StickyNote, label: 'Нотатки', color: 'green' },
  { id: 'settings', icon: Settings, label: 'Налаштування', color: 'gray' },
];

// Використовувати мокові дані для тестування (встановіть в true для розробки)
const USE_MOCK_DATA = false;

export function FinancePage() {
  const { t } = useI18n();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orderProfits, setOrderProfits] = useState<OrderProfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProfits, setLoadingProfits] = useState(true);
  const [sidePanelTab, setSidePanelTab] = useState<string | null>(null);

  useEffect(() => {
    loadPayments();
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

  const loadOrderProfits = async () => {
    try {
      setLoadingProfits(true);
      
      // Завантажуємо всі замовлення з транзакціями та перекладачами
      const orders = await ordersApi.getOrders({ limit: 1000 });
      
      // Обчислюємо різницю для кожного замовлення
      const profits: OrderProfit[] = orders
        .filter(order => {
          // Показуємо тільки замовлення з оплатою від клієнта
          const hasClientPayment = order.transactions?.some(t => t.type === "income");
          return hasClientPayment;
        })
        .map(order => {
          // Оплата від клієнта (income транзакції)
          const clientPayment = order.transactions
            ?.filter(t => t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0) || 0;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="w-8 h-8 text-[#FF5A00]" />
        <h1 className="text-2xl font-semibold text-gray-900">{t('finance.title')}</h1>
      </div>
      
      <Tabs defaultValue="payments" className="w-full">
        <TabsList>
          <TabsTrigger value="payments">Płatności</TabsTrigger>
          <TabsTrigger value="profits">Різниця оплат</TabsTrigger>
        </TabsList>
        
        <TabsContent value="payments" className="mt-6">
          <FinancePaymentsTable payments={payments || []} loading={loading} />
        </TabsContent>
        
        <TabsContent value="profits" className="mt-6">
          <OrderProfitTable orders={orderProfits || []} loading={loadingProfits} />
        </TabsContent>
      </Tabs>

      {/* SideTabs - Vertical colored tabs on the right */}
      <SideTabs
        tabs={FINANCE_SIDE_TABS}
        activeTab={sidePanelTab}
        onTabChange={setSidePanelTab}
        position="right"
      />

      {/* SidePanel - Бокова панель з контентом */}
      <SidePanel
        open={sidePanelTab !== null}
        onClose={() => setSidePanelTab(null)}
        title={FINANCE_SIDE_TABS.find(t => t.id === sidePanelTab)?.label}
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
      </SidePanel>
    </div>
  );
}

