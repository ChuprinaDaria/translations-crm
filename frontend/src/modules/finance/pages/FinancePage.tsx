import { useState, useEffect } from "react";
import { Wallet } from "lucide-react";
import { FinancePaymentsTable } from "../components/FinancePaymentsTable";
import { financeApi, Payment } from "../api/transactions";
import { mockPayments } from "../api/mockData";
import { toast } from "sonner";
import { useI18n } from "../../../lib/i18n";

// Використовувати мокові дані для тестування (встановіть в true для розробки)
const USE_MOCK_DATA = false;

export function FinancePage() {
  const { t } = useI18n();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="w-8 h-8 text-[#FF5A00]" />
        <h1 className="text-2xl font-semibold text-gray-900">{t('finance.title')}</h1>
      </div>
      
      <FinancePaymentsTable payments={payments || []} loading={loading} />
    </div>
  );
}

