import { FileText, Clock, Calendar, AlertCircle, Eye, Edit, Trash2 } from "lucide-react";
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

interface DashboardProps {
  userRole: string;
}

export function Dashboard({ userRole }: DashboardProps) {
  const kpiData = [
    {
      title: "Загальна кількість КП",
      value: "142",
      icon: FileText,
      trend: { value: "+12%", isPositive: true },
      color: "#FF5A00",
    },
    {
      title: "КП в роботі",
      value: "38",
      icon: Clock,
      trend: { value: "+5%", isPositive: true },
      color: "#3B82F6",
    },
    {
      title: "Події цього тижня",
      value: "12",
      icon: Calendar,
      color: "#10B981",
    },
    {
      title: "Очікують дій",
      value: "7",
      icon: AlertCircle,
      trend: { value: "-3%", isPositive: true },
      color: "#F59E0B",
    },
  ];

  const recentKP = [
    {
      id: "KP-2025-147",
      name: "Корпоративний банкет IT компанії",
      status: "approved",
      statusLabel: "Затверджено",
      department: "КП",
      date: "2025-10-18",
      manager: "Олена Коваль",
      price: "45 000 грн",
    },
    {
      id: "KP-2025-146",
      name: "Весільна церемонія + банкет",
      status: "in-progress",
      statusLabel: "В роботі",
      department: "Продажі",
      date: "2025-10-17",
      manager: "Іван Петренко",
      price: "120 000 грн",
    },
    {
      id: "KP-2025-145",
      name: "Бізнес-ланч для 50 осіб",
      status: "sent",
      statusLabel: "Відправлено",
      department: "Сервіс",
      date: "2025-10-17",
      manager: "Марія Шевченко",
      price: "22 500 грн",
    },
    {
      id: "KP-2025-144",
      name: "Фуршет на відкритті офісу",
      status: "draft",
      statusLabel: "Чернетка",
      department: "КП",
      date: "2025-10-16",
      manager: "Олена Коваль",
      price: "38 000 грн",
    },
    {
      id: "KP-2025-143",
      name: "Кава-брейк конференція",
      status: "waiting",
      statusLabel: "Очікує",
      department: "Продажі",
      date: "2025-10-15",
      manager: "Іван Петренко",
      price: "15 000 грн",
    },
  ];

  const upcomingEvents = [
    {
      id: 1,
      title: "Корпоративний банкет IT компанії",
      date: "2025-10-22",
      time: "18:00",
      guests: 80,
    },
    {
      id: 2,
      title: "Весільна церемонія + банкет",
      date: "2025-10-25",
      time: "15:00",
      guests: 120,
    },
    {
      id: 3,
      title: "Бізнес-ланч",
      date: "2025-10-23",
      time: "12:00",
      guests: 50,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700 hover:bg-green-100";
      case "in-progress":
        return "bg-blue-100 text-blue-700 hover:bg-blue-100";
      case "sent":
        return "bg-purple-100 text-purple-700 hover:bg-purple-100";
      case "waiting":
        return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
      case "draft":
        return "bg-gray-100 text-gray-700 hover:bg-gray-100";
      default:
        return "bg-gray-100 text-gray-700 hover:bg-gray-100";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-gray-900 mb-2">Dashboard / Огляд</h1>
        <p className="text-gray-600">Ласкаво просимо до CRM платформи</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {kpiData.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Останні КП</CardTitle>
                <InfoTooltip content="Список останніх комерційних пропозицій" />
              </div>
              <Button variant="outline" size="sm">
                Переглянути всі
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">ID</TableHead>
                      <TableHead className="min-w-[200px]">Назва КП</TableHead>
                      <TableHead className="min-w-[120px]">Статус</TableHead>
                      <TableHead className="min-w-[100px] hidden md:table-cell">Відділ</TableHead>
                      <TableHead className="min-w-[110px] hidden lg:table-cell">Дата</TableHead>
                      <TableHead className="min-w-[150px] hidden xl:table-cell">Менеджер</TableHead>
                      <TableHead className="min-w-[120px]">Сума</TableHead>
                      <TableHead className="text-right min-w-[80px]">Дії</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {recentKP.map((kp) => (
                    <TableRow key={kp.id} className="hover:bg-gray-50">
                      <TableCell className="text-gray-900">{kp.id}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="truncate text-gray-900">{kp.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(kp.status)}>
                          {kp.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600 hidden md:table-cell">{kp.department}</TableCell>
                      <TableCell className="text-gray-600 hidden lg:table-cell">{kp.date}</TableCell>
                      <TableCell className="text-gray-600 hidden xl:table-cell">{kp.manager}</TableCell>
                      <TableCell className="text-gray-900">{kp.price}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              •••
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="w-4 h-4 mr-2" />
                              Переглянути
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Редагувати
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
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

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Найближчі події</CardTitle>
                <InfoTooltip content="Події заплановані на найближчі дні" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-[#FF5A00]/30 hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm text-gray-900 line-clamp-2">{event.title}</h4>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {event.date}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {event.time}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      Гостей: <span className="text-gray-900">{event.guests}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4">
                Переглянути календар
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
