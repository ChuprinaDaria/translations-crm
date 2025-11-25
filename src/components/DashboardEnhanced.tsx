import { useState, useEffect } from "react";
import { 
  FileText, Clock, Calendar, AlertCircle, Eye, Edit, Trash2,
  Package, CheckCircle2, DollarSign, FolderOpen, TrendingUp,
  Users, ShoppingBag, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { KPICard } from "./KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { InfoTooltip } from "./InfoTooltip";
import { Skeleton } from "./ui/skeleton";
import { itemsApi, categoriesApi, type Item, type Category } from "../lib/api";
import { toast } from "sonner";

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
}

export function DashboardEnhanced({ userRole, onNavigate }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [items, categories] = await Promise.all([
        itemsApi.getItems(0, 1000),
        categoriesApi.getCategories()
      ]);

      // Calculate statistics
      const totalItems = items.length;
      const activeItems = items.filter(i => i.active).length;
      const inactiveItems = totalItems - activeItems;
      const totalValue = items.reduce((sum, i) => sum + i.price, 0);
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

      setStats({
        totalItems,
        activeItems,
        inactiveItems,
        totalCategories: categories.length,
        totalValue,
        averagePrice,
        categoriesBreakdown,
        priceRanges
      });
    } catch (error: any) {
      toast.error("Помилка завантаження даних");
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mock recent KP data (will be replaced with real API later)
  const recentKP = [
    {
      id: "KP-2025-147",
      name: "Корпоративний банкет IT компанії",
      status: "approved",
      statusLabel: "Затверджено",
      date: "2025-10-18",
      manager: "Олена Коваль",
      price: "45 000 грн",
    },
    {
      id: "KP-2025-146",
      name: "Весільна церемонія + банкет",
      status: "in-progress",
      statusLabel: "В роботі",
      date: "2025-10-17",
      manager: "Іван Петренко",
      price: "120 000 грн",
    },
    {
      id: "KP-2025-145",
      name: "Бізнес-ланч для 50 осіб",
      status: "sent",
      statusLabel: "Відправлено",
      date: "2025-10-17",
      manager: "Марія Шевченко",
      price: "22 500 грн",
    }
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      approved: "default",
      "in-progress": "secondary",
      sent: "outline",
      draft: "secondary",
    };
    return colors[status] || "default";
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl text-gray-900 mb-2">
          Панель управління
        </h1>
        <p className="text-gray-600">
          Огляд основних метрик та статистики системи
        </p>
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
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 border-transparent hover:border-orange-200"
          onClick={() => onNavigate('menu-dishes')}
        >
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-[#FF5A00]/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-[#FF5A00]" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Меню / Страви</h3>
            <p className="text-sm text-gray-500">Управління асортиментом</p>
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

      {/* Recent KP (mock data for now) */}
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
                {recentKP.map((kp) => (
                  <TableRow key={kp.id} className="hover:bg-gray-50">
                    <TableCell className="text-gray-900">{kp.id}</TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <div className="truncate text-gray-900">{kp.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(kp.status) as any}>
                        {kp.statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {new Date(kp.date).toLocaleDateString('uk-UA')}
                    </TableCell>
                    <TableCell className="text-gray-600">{kp.manager}</TableCell>
                    <TableCell className="text-right text-gray-900">
                      {kp.price}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Дії ▾
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            Переглянути
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Редагувати
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Видалити
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}