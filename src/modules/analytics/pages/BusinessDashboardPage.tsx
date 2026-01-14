import { 
  Wallet, AlertCircle, Briefcase, Mail, 
  ArrowUpRight, ArrowDownRight, CheckCircle2, Clock
} from "lucide-react";
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
import { useI18n } from "../../../lib/i18n";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DashboardProps {
  userRole?: string;
  onNavigate?: (page: string) => void;
}

// Mock data based on business/translation CRM context
const mockData = {
  kpis: {
    totalRevenue: {
      value: 45200,
      currency: "PLN",
      trend: 12,
      isPositive: true,
    },
    pendingPayments: {
      value: 8500,
      currency: "PLN",
      isCritical: true,
    },
    activeOrders: {
      value: 14,
    },
    unreadMessages: {
      value: 5,
    },
  },
  revenueChart: [
    { month: "Sty", value: 32000 },
    { month: "Lut", value: 35000 },
    { month: "Mar", value: 38000 },
    { month: "Kwi", value: 42000 },
    { month: "Maj", value: 41000 },
    { month: "Cze", value: 44000 },
    { month: "Lip", value: 43000 },
    { month: "Sie", value: 45000 },
    { month: "Wrz", value: 47000 },
    { month: "Paź", value: 46000 },
    { month: "Lis", value: 48000 },
    { month: "Gru", value: 45200 },
  ],
  orderStatusDistribution: [
    { name: "DO WYKONANIA", value: 8, color: "#EF4444" },
    { name: "DO POŚWIADCZENIA", value: 6, color: "#F59E0B" },
    { name: "DO WYDANIA", value: 4, color: "#3B82F6" },
    { name: "USTNE", value: 3, color: "#8B5CF6" },
    { name: "CLOSED", value: 12, color: "#10B981" },
  ],
  recentTransactions: [
    {
      orderNo: "N/01/02/01/26/dnk",
      client: "Jan Kowalski",
      date: "02.01.2026",
      amount: 1200,
      currency: "PLN",
      method: "Przelew",
      status: "Paid",
    },
    {
      orderNo: "N/01/02/01/26/eng",
      client: "Anna Nowak",
      date: "03.01.2026",
      amount: 850,
      currency: "PLN",
      method: "Karta",
      status: "Paid",
    },
    {
      orderNo: "N/01/02/01/26/fra",
      client: "Piotr Wiśniewski",
      date: "04.01.2026",
      amount: 2100,
      currency: "PLN",
      method: "BLIK",
      status: "Pending",
    },
    {
      orderNo: "N/01/02/01/26/esp",
      client: "Maria Zielińska",
      date: "05.01.2026",
      amount: 1650,
      currency: "PLN",
      method: "Przelew",
      status: "Paid",
    },
    {
      orderNo: "N/01/02/01/26/deu",
      client: "Tomasz Wójcik",
      date: "06.01.2026",
      amount: 3200,
      currency: "PLN",
      method: "Karta",
      status: "Pending",
    },
    {
      orderNo: "N/01/02/01/26/ita",
      client: "Katarzyna Król",
      date: "07.01.2026",
      amount: 980,
      currency: "PLN",
      method: "Przelew",
      status: "Paid",
    },
  ],
};

export function BusinessDashboardPage({ userRole, onNavigate }: DashboardProps) {
  const { t } = useI18n();

  const formatCurrency = (value: number, currency: string = "PLN") => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    if (status === "Paid") {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {t("dashboard.transactions.status.paid")}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
        <Clock className="w-3 h-3 mr-1" />
        {t("dashboard.transactions.status.pending")}
      </Badge>
    );
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      Przelew: t("dashboard.transactions.method.transfer"),
      Karta: t("dashboard.transactions.method.card"),
      BLIK: "BLIK",
    };
    return methods[method] || method;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t("dashboard.title")}
        </h1>
        <p className="text-gray-600">
          {t("dashboard.subtitle")}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t("dashboard.kpis.totalRevenue.title")}
            </CardTitle>
            <Wallet className="h-4 w-4 text-[#FF5A00]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(mockData.kpis.totalRevenue.value)}</div>
            <div className="flex items-center text-xs mt-1">
              {mockData.kpis.totalRevenue.isPositive ? (
                <>
                  <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                  <span className="text-green-600">
                    +{mockData.kpis.totalRevenue.trend}% {t("dashboard.kpis.trend")}
                  </span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
                  <span className="text-red-600">
                    {mockData.kpis.totalRevenue.trend}% {t("dashboard.kpis.trend")}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Payments */}
        <Card className={mockData.kpis.pendingPayments.isCritical ? "border-yellow-200 bg-yellow-50/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t("dashboard.kpis.pendingPayments.title")}
            </CardTitle>
            <AlertCircle className={`h-4 w-4 ${mockData.kpis.pendingPayments.isCritical ? "text-yellow-600" : "text-gray-400"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(mockData.kpis.pendingPayments.value)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {t("dashboard.kpis.pendingPayments.subtitle")}
            </p>
          </CardContent>
        </Card>

        {/* Active Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t("dashboard.kpis.activeOrders.title")}
            </CardTitle>
            <Briefcase className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.kpis.activeOrders.value}</div>
            <p className="text-xs text-gray-500 mt-1">
              {t("dashboard.kpis.activeOrders.subtitle")}
            </p>
          </CardContent>
        </Card>

        {/* Unread Messages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t("dashboard.kpis.unreadMessages.title")}
            </CardTitle>
            <Mail className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.kpis.unreadMessages.value}</div>
            <p className="text-xs text-gray-500 mt-1">
              {t("dashboard.kpis.unreadMessages.subtitle")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.charts.revenue.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockData.revenueChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                />
                <Bar dataKey="value" fill="#FF5A00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.charts.orderStatus.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={mockData.orderStatusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {mockData.orderStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {mockData.orderStatusDistribution.map((status) => (
                <div key={status.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-gray-700">{status.name}</span>
                  </div>
                  <span className="font-medium">{status.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.transactions.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("dashboard.transactions.columns.orderNo")}</TableHead>
                <TableHead>{t("dashboard.transactions.columns.client")}</TableHead>
                <TableHead>{t("dashboard.transactions.columns.date")}</TableHead>
                <TableHead className="text-right">{t("dashboard.transactions.columns.amount")}</TableHead>
                <TableHead>{t("dashboard.transactions.columns.method")}</TableHead>
                <TableHead>{t("dashboard.transactions.columns.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockData.recentTransactions.map((transaction) => (
                <TableRow key={transaction.orderNo}>
                  <TableCell className="font-medium">{transaction.orderNo}</TableCell>
                  <TableCell>{transaction.client}</TableCell>
                  <TableCell>{transaction.date}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </TableCell>
                  <TableCell>{getPaymentMethodLabel(transaction.method)}</TableCell>
                  <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

