import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { DashboardEnhanced } from "./components/DashboardEnhanced";
import { MenuManagement } from "./components/MenuManagement";
import { CreateKP } from "./components/CreateKP";
import { KPTemplates } from "./components/KPTemplates";
import { KPArchive } from "./components/KPArchive";
import { AllKP } from "./components/AllKP";
import { Settings } from "./components/Settings";
import { Clients } from "./components/Clients";
import { EventsCalendar } from "./components/EventsCalendar";
import { UsersManagement } from "./components/UsersManagement";
import { BenefitsManagement } from "./components/BenefitsManagement";
import { AuthPage } from "./components/auth/AuthPage";
import { Toaster } from "./components/ui/sonner";
import { tokenManager, authApi } from "./lib/api";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "./components/ui/sheet";

type UserRole =
  | "kp-manager"
  | "sales-manager"
  | "service-manager"
  | "sales-lead"
  | "service-lead";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeItem, setActiveItem] = useState("dashboard");
  const [userRole] = useState<UserRole>("kp-manager");
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = () => {
      const isAuth = tokenManager.isAuthenticated();
      setIsAuthenticated(isAuth);
      setIsCheckingAuth(false);
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () =>
      window.removeEventListener("resize", checkMobile);
  }, []);

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    authApi.logout(); // This will clear all localStorage including the token
    setIsAuthenticated(false);
    setActiveItem("dashboard");
  };

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FF5A00] rounded-2xl mb-4 animate-pulse">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-600">Завантаження...</p>
        </div>
      </div>
    );
  }

  // Show auth page if not authenticated
  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  const getRoleLabel = (role: UserRole): string => {
    const roleLabels: Record<UserRole, string> = {
      "kp-manager": "Менеджер КП",
      "sales-manager": "Менеджер продажів",
      "service-manager": "Менеджер сервісу",
      "sales-lead": "Керівник продажів",
      "service-lead": "Керівник сервісу",
    };
    return roleLabels[role];
  };

  const getBreadcrumbs = () => {
    const breadcrumbMap: Record<
      string,
      { label: string; href?: string }[]
    > = {
      dashboard: [{ label: "Dashboard / Огляд" }],
      "create-kp": [
        { label: "КП", href: "#" },
        { label: "Створити КП" },
      ],
      "all-kp": [
        { label: "КП", href: "#" },
        { label: "Усі КП" },
      ],
      "menu-dishes": [
        { label: "КП", href: "#" },
        { label: "Меню / Страви" },
      ],
      "kp-templates": [
        { label: "КП", href: "#" },
        { label: "Шаблони КП" },
      ],
      "kp-archive": [
        { label: "КП", href: "#" },
        { label: "Архів КП" },
      ],
      "client-questionnaires": [
        { label: "Продажі", href: "#" },
        { label: "Анкети клієнтів" },
      ],
      "my-kp": [
        { label: "Продажі", href: "#" },
        { label: "Мої КП" },
      ],
      "sent-to-service": [
        { label: "Продажі", href: "#" },
        { label: "Відправлені у сервіс" },
      ],
      "procurement-excel": [
        { label: "Продажі", href: "#" },
        { label: "Excel для закупівлі" },
      ],
      "service-templates": [
        { label: "Сервіс", href: "#" },
        { label: "Шаблони сервірування" },
      ],
      "equipment-textile": [
        { label: "Сервіс", href: "#" },
        { label: "Обладнання і текстиль" },
      ],
      "file-editing": [
        { label: "Сервіс", href: "#" },
        { label: "Редагування файлу" },
      ],
      "approved-files": [
        { label: "Сервіс", href: "#" },
        { label: "Погоджені файли" },
      ],
      calendar: [
        { label: "Загальні", href: "#" },
        { label: "Календар подій" },
      ],
      clients: [
        { label: "Загальні", href: "#" },
        { label: "Клієнти" },
      ],
      settings: [
        { label: "Загальні", href: "#" },
        { label: "Налаштування" },
      ],
      "users-access": [
        { label: "Загальні", href: "#" },
        { label: "Користувачі і доступи" },
      ],
      benefits: [
        { label: "Загальні", href: "#" },
        { label: "Бенфіти" },
      ],
    };

    return (
      breadcrumbMap[activeItem] || [{ label: "Dashboard" }]
    );
  };

  const renderContent = () => {
    switch (activeItem) {
      case "dashboard":
        return <DashboardEnhanced userRole={getRoleLabel(userRole)} onNavigate={setActiveItem} />;
      case "create-kp":
        return <CreateKP />;
      case "menu-dishes":
        return <MenuManagement />;
      case "kp-templates":
        return <KPTemplates />;
      case "kp-archive":
        return <KPArchive />;
      case "calendar":
        return <EventsCalendar />;
      case "all-kp":
        return <AllKP />;
      case "client-questionnaires":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl text-gray-900">
              Анкети клієнтів
            </h1>
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">
                Форми та анкети клієнтів будуть тут
              </p>
            </div>
          </div>
        );
      case "my-kp":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl text-gray-900">Мої КП</h1>
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">
                КП призначені вам будуть тут
              </p>
            </div>
          </div>
        );
      case "sent-to-service":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl text-gray-900">
              Відправлені у сервіс
            </h1>
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">
                КП відправлені в сервісний відділ будуть тут
              </p>
            </div>
          </div>
        );
      case "procurement-excel":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl text-gray-900">
              Excel для закупівлі
            </h1>
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">
                Експорт даних для закупівлі буде тут
              </p>
            </div>
          </div>
        );
      case "service-templates":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl text-gray-900">
              Шаблони сервірування
            </h1>
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">
                Шаблони: Фуршет, Банкет, Кава-брейк будуть тут
              </p>
            </div>
          </div>
        );
      case "equipment-textile":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl text-gray-900">
              Обладнання і текстиль
            </h1>
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">
                База обладнання та текстилю буде тут
              </p>
            </div>
          </div>
        );
      case "file-editing":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl text-gray-900">
              Редагування файлу
            </h1>
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">
                Редагування сервісних файлів буде тут
              </p>
            </div>
          </div>
        );
      case "approved-files":
        return (
          <div className="space-y-6">
            <h1 className="text-2xl text-gray-900">
              Погоджені файли
            </h1>
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">
                Файли погоджені клієнтом будуть тут
              </p>
            </div>
          </div>
        );
      case "clients":
        return <Clients />;
      case "settings":
        return <Settings />;
      case "users-access":
        return <UsersManagement />;
      case "benefits":
        return <BenefitsManagement />;
      default:
        return <DashboardEnhanced userRole={getRoleLabel(userRole)} onNavigate={setActiveItem} />;
    }
  };

  const handleMenuItemClick = (item: string) => {
    setActiveItem(item);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sidebar
          activeItem={activeItem}
          onItemClick={handleMenuItemClick}
          userRole={userRole}
          onLogout={handleLogout}
        />
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <Sheet
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
        >
          <SheetContent side="left" className="p-0 w-[260px]">
            <SheetTitle className="sr-only">
              Навігаційне меню
            </SheetTitle>
            <SheetDescription className="sr-only">
              Оберіть розділ для навігації по системі
            </SheetDescription>
            <Sidebar
              activeItem={activeItem}
              onItemClick={handleMenuItemClick}
              userRole={userRole}
              isMobile={true}
              onLogout={handleLogout}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="transition-all duration-300 lg:ml-[260px]">
        <Header
          breadcrumbs={getBreadcrumbs()}
          onMobileMenuClick={() => setMobileMenuOpen(true)}
          isMobile={isMobile}
        />

        <main className="pt-16">
          <div className="p-4 md:p-6">{renderContent()}</div>
        </main>
      </div>

      <Toaster position="top-right" />
    </div>
  );
}

export default App;