import { useState } from "react";
import {
  MessageCircle,
  Kanban,
  Wallet,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Package,
  Languages,
  Globe,
  UserCog,
  Bot,
} from "lucide-react";
import { InfoTooltip } from "../InfoTooltip";
import { cn } from "../ui/utils";
import { Button } from "../ui/button";

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  userRole: "OWNER" | "ACCOUNTANT" | "MANAGER";
  isAdmin?: boolean;
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

export function Sidebar({ activeItem, onItemClick, userRole, isAdmin = false, isMobile = false, onLogout }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuSections: MenuSection[] = [
    {
      title: "Основні",
      items: [
        {
          id: "inbox",
          label: "Inbox",
          icon: <MessageCircle className="w-5 h-5" />,
          tooltip: "Уніфікована поштова скринька та повідомлення",
        },
        {
          id: "crm",
          label: "Zlecenia",
          icon: <Kanban className="w-5 h-5" />,
          tooltip: "Zarządzanie zleceniami i tablica Kanban",
        },
        {
          id: "finance",
          label: "Finance",
          icon: <Wallet className="w-5 h-5" />,
          tooltip: "Транзакції, рахунки та фінансовий облік",
        },
        {
          id: "clients",
          label: "Clients",
          icon: <Users className="w-5 h-5" />,
          tooltip: "База клієнтів та управління контактами",
        },
        {
          id: "translators",
          label: "Translators",
          icon: <Languages className="w-5 h-5" />,
          tooltip: "Перекладачі: додати, редагувати, деактивувати",
        },
        {
          id: "languages",
          label: "Мови",
          icon: <Globe className="w-5 h-5" />,
          tooltip: "Управління мовами та базовими цінами",
        },
        {
          id: "analytics",
          label: "Analytics",
          icon: <BarChart3 className="w-5 h-5" />,
          tooltip: "Дашборди, звіти та аналітика",
        },
        {
          id: "users",
          label: "Users",
          icon: <UserCog className="w-5 h-5" />,
          tooltip: "Управління користувачами та ролями",
          roles: ["OWNER"], // Тільки для адміністраторів (OWNER)
        },
        {
          id: "autobot",
          label: "Autobot",
          icon: <Bot className="w-5 h-5" />,
          tooltip: "Налаштування автобота для Inbox",
        },
        {
          id: "settings",
          label: "Settings",
          icon: <Settings className="w-5 h-5" />,
          tooltip: "Налаштування системи",
        },
      ],
    },
  ];

  const hasAccess = (roles?: string[]) => {
    if (!roles) return true;
    // Адміністратори (is_admin === true або role === "OWNER") мають доступ до всього
    if (isAdmin || userRole === "OWNER") return true;
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

  const menuContent = (
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
                <div key={item.id} className="relative">
                  <button
                    onClick={() => onItemClick(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative",
                      isActive
                        ? "bg-[#FF5A00]/10 text-[#FF5A00] border-l-4 border-[#FF5A00] ml-0"
                        : "hover:bg-gray-200/50 text-gray-700 hover:text-gray-900"
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span className={cn(isActive ? "text-[#FF5A00]" : "text-gray-600", "shrink-0")}>
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className={cn("flex-1 text-left text-sm", isActive && "font-semibold")}>
                          {item.label}
                        </span>
                        <div className="shrink-0 pointer-events-auto z-10" onClick={(e) => e.stopPropagation()}>
                          <InfoTooltip content={item.tooltip} />
                        </div>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={cn(
        "bg-[#F7F7F7] border-r border-gray-200 flex flex-col",
        !isMobile && "h-screen fixed left-0 top-0",
        isMobile && "h-full w-full max-h-screen",
        !isMobile && (isCollapsed ? "w-20" : "w-[260px]")
      )}
    >
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 flex-shrink-0">
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

      {/* Область меню зі скролом - працює і на мобільних, і на десктопі */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain sidebar-scroll" 
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {menuContent}
      </div>

      <div className="border-t border-gray-200 p-3 flex-shrink-0">
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