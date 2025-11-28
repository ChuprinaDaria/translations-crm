import { useState } from "react";
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  UtensilsCrossed,
  FileStack,
  Archive,
  ClipboardList,
  Send,
  FileSpreadsheet,
  Wine,
  Monitor,
  Edit,
  FileCheck,
  Calendar,
  Users,
  Settings,
  UserCog,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { InfoTooltip } from "./InfoTooltip";
import { cn } from "./ui/utils";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  userRole: "kp-manager" | "sales-manager" | "service-manager" | "sales-lead" | "service-lead";
  isMobile?: boolean;
  onLogout: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  tooltip: string;
  roles?: string[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
  roles?: string[];
}

export function Sidebar({ activeItem, onItemClick, userRole, isMobile = false, onLogout }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuSections: MenuSection[] = [
    {
      title: "КП (Комерційна Пропозиція)",
      items: [
        {
          id: "dashboard",
          label: "Dashboard / Огляд",
          icon: <LayoutDashboard className="w-5 h-5" />,
          tooltip: "Загальний огляд системи та ключові метрики",
        },
        {
          id: "create-kp",
          label: "Створити КП",
          icon: <FilePlus className="w-5 h-5" />,
          tooltip: "Створити нову комерційну пропозицію",
          roles: ["kp-manager", "sales-lead"],
        },
        {
          id: "all-kp",
          label: "Усі КП",
          icon: <FileText className="w-5 h-5" />,
          tooltip: "Перегляд всіх комерційних пропозицій",
          roles: ["kp-manager", "sales-lead"],
        },
        {
          id: "menu-dishes",
          label: "Меню / Страви",
          icon: <UtensilsCrossed className="w-5 h-5" />,
          tooltip: "Управління меню та стравами",
          roles: ["kp-manager", "sales-lead"],
        },
        {
          id: "kp-templates",
          label: "Шаблони КП",
          icon: <FileStack className="w-5 h-5" />,
          tooltip: "Готові шаблони комерційних пропозицій",
          roles: ["kp-manager", "sales-lead"],
        },
        {
          id: "kp-archive",
          label: "Архів КП",
          icon: <Archive className="w-5 h-5" />,
          tooltip: "Архівовані комерційні пропозиції",
          roles: ["kp-manager", "sales-lead"],
        },
      ],
      roles: ["kp-manager", "sales-lead"],
    },
    {
      title: "Продажі",
      items: [
        {
          id: "client-questionnaires",
          label: "Анкети клієнтів",
          icon: <ClipboardList className="w-5 h-5" />,
          tooltip: "Анкети та форми клієнтів",
          roles: ["sales-manager", "sales-lead"],
        },
        {
          id: "my-kp",
          label: "Мої КП",
          icon: <FileText className="w-5 h-5" />,
          tooltip: "КП призначені вам",
          roles: ["sales-manager", "sales-lead"],
        },
        {
          id: "sent-to-service",
          label: "Відправлені у сервіс",
          icon: <Send className="w-5 h-5" />,
          tooltip: "КП відправлені в сервісний відділ",
          roles: ["sales-manager", "sales-lead"],
        },
        {
          id: "procurement-excel",
          label: "Excel для закупівлі",
          icon: <FileSpreadsheet className="w-5 h-5" />,
          tooltip: "Експорт даних для закупівлі",
          roles: ["sales-manager", "sales-lead"],
        },
      ],
      roles: ["sales-manager", "sales-lead"],
    },
    {
      title: "Сервіс",
      items: [
        {
          id: "service-templates",
          label: "Шаблони сервірування",
          icon: <Wine className="w-5 h-5" />,
          tooltip: "Шаблони: Фуршет, Банкет, Кава-брейк",
          roles: ["service-manager", "service-lead"],
        },
        {
          id: "equipment-textile",
          label: "Обладнання і текстиль",
          icon: <Monitor className="w-5 h-5" />,
          tooltip: "База обладнання та текстилю",
          roles: ["service-manager", "service-lead"],
        },
        {
          id: "file-editing",
          label: "Редагування файлу",
          icon: <Edit className="w-5 h-5" />,
          tooltip: "Редагування сервісних файлів",
          roles: ["service-manager", "service-lead"],
        },
        {
          id: "approved-files",
          label: "Погоджені файли",
          icon: <FileCheck className="w-5 h-5" />,
          tooltip: "Файли погоджені клієнтом",
          roles: ["service-manager", "service-lead"],
        },
      ],
      roles: ["service-manager", "service-lead"],
    },
    {
      title: "Загальні",
      items: [
        {
          id: "calendar",
          label: "Календар подій",
          icon: <Calendar className="w-5 h-5" />,
          tooltip: "Календар заходів та подій",
        },
        {
          id: "clients",
          label: "Клієнти",
          icon: <Users className="w-5 h-5" />,
          tooltip: "База клієнтів",
        },
        {
          id: "settings",
          label: "Налаштування",
          icon: <Settings className="w-5 h-5" />,
          tooltip: "Налаштування системи",
        },
        {
          id: "users-access",
          label: "Користувачі і доступи",
          icon: <UserCog className="w-5 h-5" />,
          tooltip: "Управління користувачами та правами доступу",
          roles: ["sales-lead", "service-lead"],
        },
      ],
    },
  ];

  const hasAccess = (roles?: string[]) => {
    if (!roles) return true;
    return roles.includes(userRole);
  };

  const filterSections = (sections: MenuSection[]) => {
    return sections
      .filter((section) => hasAccess(section.roles))
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => hasAccess(item.roles)),
      }))
      .filter((section) => section.items.length > 0);
  };

  const filteredSections = filterSections(menuSections);

  return (
    <div
      className={cn(
        "h-screen bg-[#F7F7F7] border-r border-gray-200 flex flex-col",
        !isMobile && "fixed left-0 top-0",
        !isMobile && (isCollapsed ? "w-20" : "w-[260px]"),
        isMobile && "w-full"
      )}
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
        {!isCollapsed && <span className="font-semibold text-gray-900">CRM Platform</span>}
        {!isMobile && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors ml-auto"
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            )}
          </button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="py-6 space-y-6">
          {filteredSections.map((section, idx) => (
            <div key={idx} className="px-3">
              {!isCollapsed && (
                <div className="px-3 mb-2 text-xs uppercase tracking-wider text-gray-500">
                  {section.title}
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = activeItem === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onItemClick(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative",
                        isActive
                          ? "bg-[#FF5A00]/10 text-[#FF5A00] border-l-4 border-[#FF5A00] ml-0"
                          : "hover:bg-gray-200/50 text-gray-700 hover:text-gray-900"
                      )}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <span className={cn(isActive ? "text-[#FF5A00]" : "text-gray-600")}>
                        {item.icon}
                      </span>
                      {!isCollapsed && (
                        <>
                          <span className={cn("flex-1 text-left text-sm", isActive && "font-semibold")}>
                            {item.label}
                          </span>
                          <InfoTooltip content={item.tooltip} />
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-gray-200 p-3">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer",
            isCollapsed && "justify-center px-0"
          )}
          title={isCollapsed ? "Вийти" : undefined}
          onClick={onLogout}
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && <span className="ml-3 font-medium">Вийти</span>}
        </Button>
      </div>
    </div>
  );
}