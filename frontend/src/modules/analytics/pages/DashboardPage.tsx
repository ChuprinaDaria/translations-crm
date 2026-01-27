import { useState, useEffect } from "react";
import { 
  FileText, Clock, Calendar, AlertCircle, Eye, Edit, Trash2,
  Package, CheckCircle2, DollarSign, FolderOpen, TrendingUp,
  Users, ShoppingBag, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { KPICard } from "../components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { InfoTooltip } from "../../../components/InfoTooltip";
import { Skeleton } from "../../../components/ui/skeleton";
import { itemsApi, categoriesApi, kpApi, clientsApi, questionnairesApi, usersApi, type Item, type Category, type KP, type Client, type ClientQuestionnaire, type User } from "../../../lib/api";
import { toast } from "sonner";
import { mockKPs, mockClients, mockQuestionnaires, mockUsers } from "../mockData";

interface DashboardProps {
  userRole: string;
  onNavigate: (page: string) => void;
}

interface DashboardStats {
  totalItems: number;
  activeItems: number;
  inactiveItems: number;
  totalCategories: number;
  totalValue: number;
  averagePrice: number;
  categoriesBreakdown: Array<{
    categoryId: number;
    categoryName: string;
    count: number;
    percentage: number;
    totalValue: number;
  }>;
  priceRanges: {
    cheap: number;     // < 50
    medium: number;    // 50-200
    expensive: number; // > 200
  };
  // Нові метрики
  topClients: Array<{
    clientId: number;
    clientName: string;
    totalSpent: number;
    kpCount: number;
  }>;
  popularItems: Array<{
    itemId: number;
    itemName: string;
    usageCount: number;
    totalRevenue: number;
    categoryName?: string;
  }>;
  activeManagers: Array<{
    managerId: number;
    managerName: string;
    kpCount: number;
    questionnaireCount: number;
    totalRevenue: number;
  }>;
  kpStatusStats: {
    in_progress: number;
    sent: number;
    approved: number;
    rejected: number;
    completed: number;
    draft: number;
  };
  totalRevenue: number;
  averageCheck: number;
  conversionRate: number; // від sent до approved
}

type KPStatus = "sent" | "approved" | "rejected" | "completed";

export function DashboardEnhanced({ userRole, onNavigate }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentKP, setRecentKP] = useState<KP[] | null>(null);
  const [useMockData, setUseMockData] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Використовуємо мок дані для демонстрації (можна перемикати через змінну середовища)
      const shouldUseMockData = import.meta.env.DEV && localStorage.getItem('use_mock_analytics') === 'true';
      setUseMockData(shouldUseMockData);
      
      let items: Item[] = [];
      let categories: Category[] = [];
      let kps: KP[] = [];
      let clients: Client[] = [];
      let questionnaires: ClientQuestionnaire[] = [];
      let users: User[] = [];

      if (shouldUseMockData) {
        // Використовуємо мок дані
        console.log('[Analytics] Using mock data');
        kps = mockKPs;
        clients = mockClients;
        questionnaires = mockQuestionnaires;
        users = mockUsers;
        
        // Для items та categories все ще завантажуємо з API (або можна додати мок дані)
        try {
          const [itemsData, categoriesData] = await Promise.all([
            itemsApi.getItems(0, 1000),
            categoriesApi.getCategories(),
          ]);
          items = itemsData;
          categories = categoriesData;
        } catch (error) {
          console.warn('[Analytics] Failed to load items/categories, using empty arrays');
        }
      } else {
        // Використовуємо реальні дані з API
        // Використовуємо Promise.allSettled для обробки окремих помилок
        const results = await Promise.allSettled([
          itemsApi.getItems(0, 1000),
          categoriesApi.getCategories(),
          kpApi.getKPs(),
          clientsApi.getClients(0, 1000),
          questionnairesApi.getAll(0, 1000),
          usersApi.getUsers(),
        ]);

        // Обробляємо результати окремо
        if (results[0].status === 'fulfilled') {
          items = results[0].value;
        } else {
          console.error('[Analytics] Failed to load items:', results[0].reason);
          items = [];
        }

        if (results[1].status === 'fulfilled') {
          categories = results[1].value;
        } else {
          console.error('[Analytics] Failed to load categories:', results[1].reason);
          categories = [];
        }

        if (results[2].status === 'fulfilled') {
          kps = results[2].value;
        } else {
          console.error('[Analytics] Failed to load KPs:', results[2].reason);
          kps = [];
          toast.error(`Помилка завантаження КП: ${results[2].reason?.message || 'Невідома помилка'}`);
        }

        if (results[3].status === 'fulfilled') {
          const clientsData = results[3].value;
          clients = Array.isArray(clientsData) ? clientsData : clientsData.clients || [];
        } else {
          console.error('[Analytics] Failed to load clients:', results[3].reason);
          clients = [];
          toast.error(`Помилка завантаження клієнтів: ${results[3].reason?.message || 'Невідома помилка'}`);
        }

        if (results[4].status === 'fulfilled') {
          questionnaires = results[4].value.questionnaires || [];
        } else {
          console.error('[Analytics] Failed to load questionnaires:', results[4].reason);
          questionnaires = [];
        }

        if (results[5].status === 'fulfilled') {
          users = results[5].value;
        } else {
          console.error('[Analytics] Failed to load users:', results[5].reason);
          users = [];
        }
      }

      // Перевірка чи є дані для обробки
      if (!items || !categories || !kps || !clients) {
        console.warn('[Analytics] Missing required data:', { items: !!items, categories: !!categories, kps: !!kps, clients: !!clients });
        // Встановлюємо порожні масиви якщо дані відсутні
        items = items || [];
        categories = categories || [];
        kps = kps || [];
        clients = clients || [];
        questionnaires = questionnaires || [];
        users = users || [];
      }

      // Calculate statistics
      const totalItems = items.length;
      const activeItems = items.filter(i => i.active).length;
      const inactiveItems = totalItems - activeItems;
      const totalValue = items.reduce((sum, i) => sum + (i.price || 0), 0);
      const averagePrice = totalItems > 0 ? totalValue / totalItems : 0;

      // Categories breakdown
      const categoriesMap = new Map<number, { name: string; count: number; totalValue: number }>();
      
      items.forEach(item => {
        if (item.subcategory?.category) {
          const catId = item.subcategory.category.id;
          const catName = item.subcategory.category.name;
          
          if (!categoriesMap.has(catId)) {
            categoriesMap.set(catId, { name: catName, count: 0, totalValue: 0 });
          }
          
          const cat = categoriesMap.get(catId)!;
          cat.count += 1;
          cat.totalValue += item.price;
        }
      });

      const categoriesBreakdown = Array.from(categoriesMap.entries()).map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        count: data.count,
        percentage: totalItems > 0 ? (data.count / totalItems) * 100 : 0,
        totalValue: data.totalValue
      })).sort((a, b) => b.count - a.count);

      // Price ranges
      const priceRanges = {
        cheap: items.filter(i => i.price < 50).length,
        medium: items.filter(i => i.price >= 50 && i.price <= 200).length,
        expensive: items.filter(i => i.price > 200).length
      };

      // === НОВІ МЕТРИКИ ===

      // 1. Топ клієнтів за фінансами
      const clientRevenueMap = new Map<number | string, { name: string; total: number; count: number }>();
      
      // Створюємо мапу клієнтів для швидкого пошуку
      const clientsMap = new Map<number, Client>();
      clients.forEach(client => {
        if (client.id) {
          clientsMap.set(client.id, client);
        }
      });

      // Збираємо дані з КП
      kps.forEach(kp => {
        const clientId = kp.client_id;
        const clientName = kp.client_name || 'Без імені';
        const total = kp.total_price || 0;
        
        if (clientId) {
          // Якщо є client_id, використовуємо його як ключ
          if (!clientRevenueMap.has(clientId)) {
            const client = clientsMap.get(clientId);
            clientRevenueMap.set(clientId, {
              name: client?.name || clientName,
              total: 0,
              count: 0,
            });
          }
          const client = clientRevenueMap.get(clientId)!;
          client.total += total;
          client.count += 1;
        } else if (clientName && clientName !== 'Без імені') {
          // Якщо немає client_id, але є ім'я, використовуємо ім'я як ключ
          const key = `name_${clientName}`;
          if (!clientRevenueMap.has(key)) {
            clientRevenueMap.set(key, { name: clientName, total: 0, count: 0 });
          }
          const client = clientRevenueMap.get(key)!;
          client.total += total;
          client.count += 1;
        }
      });

      // Додаємо дані з lifetime_spent клієнтів
      clients.forEach(client => {
        if (client.id) {
          if (!clientRevenueMap.has(client.id)) {
            clientRevenueMap.set(client.id, {
              name: client.name,
              total: client.lifetime_spent || 0,
              count: client.total_orders || 0,
            });
          } else {
            const existing = clientRevenueMap.get(client.id)!;
            // Використовуємо більшу суму з lifetime_spent або суму з КП
            existing.total = Math.max(existing.total, client.lifetime_spent || 0);
            existing.count = Math.max(existing.count, client.total_orders || 0);
          }
        }
      });

      const topClients = Array.from(clientRevenueMap.entries())
        .filter(([key]) => typeof key === 'number') // Фільтруємо тільки числові ID
        .map(([clientId, data]) => ({
          clientId: clientId as number,
          clientName: data.name,
          totalSpent: data.total,
          kpCount: data.count,
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      // 2. Найпопулярніші товари (по використанню та по фінансам)
      const itemUsageMap = new Map<number, { name: string; count: number; revenue: number; categoryName?: string }>();
      const itemMap = new Map<number, Item>();
      items.forEach(item => itemMap.set(item.id, item));

      kps.forEach(kp => {
        kp.items?.forEach(kpItem => {
          const itemId = kpItem.item_id;
          if (!itemId) return; // Пропускаємо custom items без item_id
          
          const item = itemMap.get(itemId);
          if (item) {
            if (!itemUsageMap.has(itemId)) {
              itemUsageMap.set(itemId, {
                name: item.name,
                count: 0,
                revenue: 0,
                categoryName: item.subcategory?.category?.name,
              });
            }
            const itemUsage = itemUsageMap.get(itemId)!;
            const quantity = kpItem.quantity || 1;
            itemUsage.count += quantity;
            // Приблизна виручка = кількість * ціна товару
            const itemPrice = item.price || 0;
            itemUsage.revenue += itemPrice * quantity;
          }
        });
      });

      const popularItems = Array.from(itemUsageMap.entries())
        .map(([itemId, data]) => ({
          itemId,
          itemName: data.name,
          usageCount: data.count,
          totalRevenue: data.revenue,
          categoryName: data.categoryName,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue) // Сортуємо по фінансам
        .slice(0, 10);

      // 3. Активні менеджери (КП та анкети)
      const managerStatsMap = new Map<string, { name: string; kpCount: number; questionnaireCount: number; revenue: number }>();
      const userMap = new Map<string, User>();
      users.forEach(user => {
        userMap.set(user.id, user);
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
        managerStatsMap.set(user.id, { name: fullName, kpCount: 0, questionnaireCount: 0, revenue: 0 });
      });

      // Підрахунок КП по менеджерах
      kps.forEach(kp => {
        if (kp.created_by_id) {
          // created_by_id is still a number in KP, but User.id is now UUID (string)
          // We need to convert it to string for lookup, but this indicates a schema mismatch
          const manager = managerStatsMap.get(String(kp.created_by_id));
          if (manager) {
            manager.kpCount += 1;
            manager.revenue += kp.total_price || 0;
          }
        }
      });

      // Підрахунок анкет по менеджерах
      questionnaires.forEach(q => {
        if (q.manager_id) {
          // manager_id is still a number, but User.id is now UUID (string)
          // Convert to string for lookup
          const manager = managerStatsMap.get(String(q.manager_id));
          if (manager) {
            manager.questionnaireCount += 1;
          } else {
            // Якщо менеджера немає в списку, додаємо
            const user = userMap.get(String(q.manager_id));
            if (user) {
              const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
              managerStatsMap.set(user.id, { name: fullName, kpCount: 0, questionnaireCount: 1, revenue: 0 });
            }
          }
        }
      });

      const activeManagers = Array.from(managerStatsMap.entries())
        .map(([managerId, data]) => ({
          managerId,
          managerName: data.name,
          kpCount: data.kpCount,
          questionnaireCount: data.questionnaireCount,
          totalRevenue: data.revenue,
        }))
        .filter(m => m.kpCount > 0 || m.questionnaireCount > 0)
        .sort((a, b) => (b.kpCount + b.questionnaireCount) - (a.kpCount + a.questionnaireCount))
        .slice(0, 10);

      // 4. Статистика по статусах КП
      const kpStatusStats = {
        in_progress: kps.filter(kp => kp.status === 'in_progress').length,
        sent: kps.filter(kp => kp.status === 'sent').length,
        approved: kps.filter(kp => kp.status === 'approved').length,
        rejected: kps.filter(kp => kp.status === 'rejected').length,
        completed: kps.filter(kp => kp.status === 'completed').length,
        draft: kps.filter(kp => kp.status === 'draft').length,
      };

      // 5. Загальна виручка та середній чек
      const totalRevenue = kps.reduce((sum, kp) => sum + (kp.total_price || 0), 0);
      const approvedKPs = kps.filter(kp => kp.status === 'approved' || kp.status === 'completed');
      const averageCheck = approvedKPs.length > 0
        ? approvedKPs.reduce((sum, kp) => sum + (kp.total_price || 0), 0) / approvedKPs.length
        : 0;

      // 6. Конверсія (від sent до approved)
      const sentCount = kpStatusStats.sent;
      const approvedCount = kpStatusStats.approved;
      const conversionRate = sentCount > 0 ? (approvedCount / sentCount) * 100 : 0;

      setStats({
        totalItems,
        activeItems,
        inactiveItems,
        totalCategories: categories.length,
        totalValue,
        averagePrice,
        categoriesBreakdown,
        priceRanges,
        topClients,
        popularItems,
        activeManagers,
        kpStatusStats,
        totalRevenue,
        averageCheck,
        conversionRate,
      });

      // Recent KP: беремо останні 5 за датою створення
      const sortedKps = [...kps].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
      setRecentKP(sortedKps.slice(0, 5));
    } catch (error: any) {
      const errorMessage = error?.message || error?.data?.detail || "Невідома помилка";
      console.error("Dashboard load error:", error);
      
      // Показуємо детальну помилку тільки якщо це не було вже показано через toast.error в обробці окремих запитів
      if (!errorMessage.includes('HTML') && !errorMessage.includes('JSON')) {
        toast.error(`Помилка завантаження даних: ${errorMessage}`);
      }
      
      // Встановлюємо порожні дані для уникнення помилок рендерингу
      if (!stats) {
        setStats({
          totalItems: 0,
          activeItems: 0,
          inactiveItems: 0,
          totalCategories: 0,
          totalValue: 0,
          averagePrice: 0,
          categoriesBreakdown: [],
          priceRanges: { cheap: 0, medium: 0, expensive: 0 },
          topClients: [],
          popularItems: [],
          activeManagers: [],
          kpStatusStats: {
            in_progress: 0,
            sent: 0,
            approved: 0,
            rejected: 0,
            completed: 0,
            draft: 0,
          },
          totalRevenue: 0,
          averageCheck: 0,
          conversionRate: 0,
        });
        setRecentKP([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: KPStatus): string => {
    switch (status) {
      case "approved":
        return "Затверджено";
      case "rejected":
        return "Відхилено";
      case "completed":
        return "Виконано";
      case "sent":
      default:
        return "Відправлено";
    }
  };

  const getStatusVariant = (status: KPStatus): "default" | "secondary" | "outline" | "destructive" => {
    switch (status) {
      case "approved":
        return "default";
      case "rejected":
        return "destructive";
      case "completed":
        return "secondary";
      case "sent":
      default:
        return "outline";
    }
  };

  const handleViewKP = async (kp: KP) => {
    try {
      const blob = await kpApi.generateKPPDF(kp.id, kp.template_id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error("Помилка генерації PDF:", error);
      toast.error("Не вдалося згенерувати PDF для КП");
    }
  };

  const handleDownloadKP = async (kp: KP) => {
    try {
      const blob = await kpApi.generateKPPDF(kp.id, kp.template_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `KP-${kp.id.toString().padStart(4, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Помилка завантаження PDF:", error);
      toast.error("Не вдалося завантажити PDF для КП");
    }
  };

  const handleDeleteKP = async (kp: KP) => {
    if (!window.confirm("Видалити цю КП?")) return;
    try {
      await kpApi.deleteKP(kp.id);
      toast.success("КП видалено");
      await loadDashboardData();
    } catch (error) {
      console.error("Помилка видалення КП:", error);
      toast.error("Не вдалося видалити КП");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500">Помилка завантаження даних</p>
          <Button onClick={loadDashboardData} className="mt-4">
            Спробувати знову
          </Button>
        </div>
      </div>
    );
  }

  // Calculate trends (mock for now - would compare with previous period in real app)
  const itemsTrend = 12;
  const activeTrend = 8;
  const valueTrend = 15;
  const avgPriceTrend = -3;

  const toggleMockData = () => {
    const currentValue = localStorage.getItem('use_mock_analytics') === 'true';
    localStorage.setItem('use_mock_analytics', (!currentValue).toString());
    loadDashboardData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl text-gray-900 mb-2">
            Панель управління
          </h1>
          <p className="text-gray-600">
            Огляд основних метрик та статистики системи
          </p>
        </div>
        {import.meta.env.DEV && (
          <div className="flex items-center gap-2">
            {useMockData && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                📊 Мок дані
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMockData}
              className="text-xs"
            >
              {useMockData ? 'Використовувати реальні дані' : 'Використовувати мок дані'}
            </Button>
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 border-transparent hover:border-blue-200"
          onClick={() => onNavigate('create-kp')}
        >
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Створити КП</h3>
            <p className="text-sm text-gray-500">Нова комерційна пропозиція</p>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 border-transparent hover:border-purple-200"
          onClick={() => onNavigate('kp-archive')}
        >
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-purple-100 flex items-center justify-center">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Архів КП</h3>
            <p className="text-sm text-gray-500">Перегляд історії</p>
          </CardContent>
        </Card>
        
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 border-transparent hover:border-green-200"
          onClick={() => onNavigate('kp-templates')}
        >
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-green-100 flex items-center justify-center">
              <FolderOpen className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Шаблони КП</h3>
            <p className="text-sm text-gray-500">Готові шаблони</p>
          </CardContent>
        </Card>
      </div>

      {/* Main KPI Cards - Real Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Всього товарів</p>
                <p className="text-3xl">{stats.totalItems}</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600">+{itemsTrend}%</span>
                  <span className="text-xs text-gray-500">за місяць</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Активні товари</p>
                <p className="text-3xl">{stats.activeItems}</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600">+{activeTrend}%</span>
                  <span className="text-xs text-gray-500">за місяць</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Загальна вартість</p>
                <p className="text-3xl">₴{stats.totalValue.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-600">+{valueTrend}%</span>
                  <span className="text-xs text-gray-500">за місяць</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#FF5A00]/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-[#FF5A00]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Середня ціна</p>
                <p className="text-3xl">₴{stats.averagePrice.toFixed(0)}</p>
                <div className="flex items-center gap-1 mt-2">
                  {avgPriceTrend >= 0 ? (
                    <>
                      <ArrowUpRight className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600">+{avgPriceTrend}%</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-red-600">{avgPriceTrend}%</span>
                    </>
                  )}
                  <span className="text-xs text-gray-500">за місяць</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Business KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Загальна виручка</p>
                <p className="text-2xl">₴{stats.totalRevenue.toLocaleString('uk-UA')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Середній чек</p>
                <p className="text-2xl">₴{stats.averageCheck.toLocaleString('uk-UA', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Конверсія (sent → approved)</p>
                <p className="text-2xl">{stats.conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Категорій</p>
                <p className="text-2xl">{stats.totalCategories}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Неактивні</p>
                <p className="text-2xl">{stats.inactiveItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Активність</p>
                <p className="text-2xl">{((stats.activeItems / stats.totalItems) * 100).toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Розподіл товарів по категоріям</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.categoriesBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Немає даних для відображення
                </p>
              ) : (
                stats.categoriesBreakdown.map((cat) => (
                  <div key={cat.categoryId} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{cat.categoryName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900">{cat.count} товарів</span>
                        <span className="text-gray-500">({cat.percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#FF5A00] h-2 rounded-full transition-all"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      Загальна вартість: ₴{cat.totalValue.toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Price Ranges */}
        <Card>
          <CardHeader>
            <CardTitle>Розподіл по ціновим діапазонам</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Економ (&lt; ₴50)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900">{stats.priceRanges.cheap} товарів</span>
                    <span className="text-gray-500">
                      ({((stats.priceRanges.cheap / stats.totalItems) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${(stats.priceRanges.cheap / stats.totalItems) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Стандарт (₴50-200)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900">{stats.priceRanges.medium} товарів</span>
                    <span className="text-gray-500">
                      ({((stats.priceRanges.medium / stats.totalItems) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${(stats.priceRanges.medium / stats.totalItems) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Преміум (&gt; ₴200)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900">{stats.priceRanges.expensive} товарів</span>
                    <span className="text-gray-500">
                      ({((stats.priceRanges.expensive / stats.totalItems) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${(stats.priceRanges.expensive / stats.totalItems) * 100}%` }}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="pt-4 border-t">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl text-green-600">{stats.priceRanges.cheap}</p>
                    <p className="text-xs text-gray-500">Економ</p>
                  </div>
                  <div>
                    <p className="text-2xl text-blue-600">{stats.priceRanges.medium}</p>
                    <p className="text-xs text-gray-500">Стандарт</p>
                  </div>
                  <div>
                    <p className="text-2xl text-purple-600">{stats.priceRanges.expensive}</p>
                    <p className="text-xs text-gray-500">Преміум</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Clients, Popular Items, Active Managers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Топ клієнтів */}
        <Card>
          <CardHeader>
            <CardTitle>Топ клієнтів</CardTitle>
            <InfoTooltip content="Клієнти з найбільшою сумою замовлень" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topClients.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Немає даних</p>
              ) : (
                stats.topClients.slice(0, 5).map((client, idx) => (
                  <div key={client.clientId} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#FF5A00]/10 flex items-center justify-center text-sm font-semibold text-[#FF5A00]">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{client.clientName}</p>
                        <p className="text-xs text-gray-500">{client.kpCount} КП</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      ₴{client.totalSpent.toLocaleString('uk-UA', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Найпопулярніші страви */}
        <Card>
          <CardHeader>
            <CardTitle>Найпопулярніші товари</CardTitle>
            <InfoTooltip content="Товари з найбільшою виручкою" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.popularItems.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Немає даних</p>
              ) : (
                stats.popularItems.slice(0, 5).map((item, idx) => (
                  <div key={item.itemId} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-600">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.itemName}</p>
                          <p className="text-xs text-gray-500">
                            {item.usageCount} од.
                            {item.categoryName && ` • ${item.categoryName}`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 ml-2">
                      ₴{item.totalRevenue.toLocaleString('uk-UA', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Активні менеджери */}
        <Card>
          <CardHeader>
            <CardTitle>Активні менеджери</CardTitle>
            <InfoTooltip content="Менеджери з найбільшою кількістю КП та анкет" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.activeManagers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Немає даних</p>
              ) : (
                stats.activeManagers.slice(0, 5).map((manager, idx) => (
                  <div key={manager.managerId} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-semibold text-purple-600">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{manager.managerName}</p>
                          <p className="text-xs text-gray-500">
                            {manager.kpCount} КП • {manager.questionnaireCount} анкет
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 ml-2">
                      ₴{manager.totalRevenue.toLocaleString('uk-UA', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Статистика по статусах КП */}
      <Card>
        <CardHeader>
          <CardTitle>Статистика КП по статусах</CardTitle>
          <InfoTooltip content="Розподіл комерційних пропозицій за статусами" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-4 rounded-lg bg-blue-50">
              <p className="text-2xl font-bold text-blue-600">{stats.kpStatusStats.in_progress}</p>
              <p className="text-xs text-gray-600 mt-1">В роботі</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-50">
              <p className="text-2xl font-bold text-yellow-600">{stats.kpStatusStats.sent}</p>
              <p className="text-xs text-gray-600 mt-1">Відправлено</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50">
              <p className="text-2xl font-bold text-green-600">{stats.kpStatusStats.approved}</p>
              <p className="text-xs text-gray-600 mt-1">Затверджено</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50">
              <p className="text-2xl font-bold text-red-600">{stats.kpStatusStats.rejected}</p>
              <p className="text-xs text-gray-600 mt-1">Відхилено</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-gray-50">
              <p className="text-2xl font-bold text-gray-600">{stats.kpStatusStats.completed}</p>
              <p className="text-xs text-gray-600 mt-1">Виконано</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-slate-50">
              <p className="text-2xl font-bold text-slate-600">{stats.kpStatusStats.draft}</p>
              <p className="text-xs text-gray-600 mt-1">Чернетка</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent KP */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Останні комерційні пропозиції</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("kp-archive")}
            >
              Переглянути всі →
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Номер</TableHead>
                  <TableHead>Назва</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Менеджер</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                  <TableHead className="text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!recentKP || recentKP.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-gray-500">
                      КП ще не створювалися
                    </TableCell>
                  </TableRow>
                )}
                {recentKP?.map((kp) => {
                  const status = ((kp.status as KPStatus) || "sent") as KPStatus;
                  const createdDate = kp.created_at
                    ? new Date(kp.created_at).toLocaleDateString("uk-UA")
                    : "—";
                  const total = kp.total_price ?? null;

                  return (
                  <TableRow key={kp.id} className="hover:bg-gray-50">
                    <TableCell className="text-gray-900">
                      KP-{kp.id.toString().padStart(4, "0")}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <div className="truncate text-gray-900">{kp.title}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(status)}>
                        {getStatusLabel(status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {createdDate}
                    </TableCell>
                    <TableCell className="text-gray-600">—</TableCell>
                    <TableCell className="text-right text-gray-900">
                      {total !== null ? `${total.toLocaleString()} грн` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Дії ▾
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewKP(kp)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Переглянути
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadKP(kp)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Завантажити PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteKP(kp)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Видалити
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Export alias for compatibility with App.tsx
// Export new Business Dashboard as default
export { BusinessDashboardPage as DashboardPage } from "./BusinessDashboardPage";