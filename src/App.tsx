import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { DashboardEnhanced } from "./components/DashboardEnhanced";
import { MenuManagement } from "./components/MenuManagement";
import { EquipmentManagement } from "./components/EquipmentManagement";
import { ServiceManagement } from "./components/ServiceManagement";
import { CreateKP } from "./components/CreateKP";
import { KPTemplates } from "./components/KPTemplates";
import { KPArchive } from "./components/KPArchive";
import { AllKP } from "./components/AllKP";
import { Settings } from "./components/Settings";
import { Clients } from "./components/Clients";
import { EventsCalendar } from "./components/EventsCalendar";
import { UsersManagement } from "./components/UsersManagement";
import { BenefitsManagement } from "./components/BenefitsManagement";
import { ProcurementExcel } from "./components/ProcurementExcel";
import { ServiceExcel } from "./components/ServiceExcel";
import { RecipesManagement } from "./components/RecipesManagement";
import { SalesDepartment } from "./components/SalesDepartment";
import { AllQuestionnaires } from "./components/AllQuestionnaires";
import { ChecklistManagement } from "./components/ChecklistManagement";
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
  | "kp-lead"
  | "sales-manager"
  | "service-manager"
  | "sales-lead"
  | "service-lead";

// Константа для таймауту неактивності (30 хвилин в мілісекундах)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeItem, setActiveItem] = useState("dashboard");
  const [userRole] = useState<UserRole>("kp-manager");
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [editingKPId, setEditingKPId] = useState<number | null>(null);

  // Load Gilroy font
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = "https://fonts.cdnfonts.com";
    document.head.appendChild(link);
    
    const fontLink = document.createElement("link");
    fontLink.href = "https://fonts.cdnfonts.com/css/gilroy";
    fontLink.rel = "stylesheet";
    document.head.appendChild(fontLink);
    
    return () => {
      document.head.removeChild(link);
      document.head.removeChild(fontLink);
    };
  }, []);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = () => {
      const isAuth = tokenManager.isAuthenticated();
      setIsAuthenticated(isAuth);
      setIsCheckingAuth(false);
    };
    
    checkAuth();
  }, []);

  // Sync auth state when token changes (401, logout in another place, etc.)
  useEffect(() => {
    const syncAuth = () => {
      const isAuth = tokenManager.isAuthenticated();
      setIsAuthenticated(isAuth);
      if (!isAuth) {
        setActiveItem("dashboard");
        setEditingKPId(null);
      }
    };
    window.addEventListener("auth:token-changed", syncAuth as EventListener);
    window.addEventListener("auth:logout", syncAuth as EventListener);
    return () => {
      window.removeEventListener("auth:token-changed", syncAuth as EventListener);
      window.removeEventListener("auth:logout", syncAuth as EventListener);
    };
  }, []);

  // Автоматичний логаут після 30 хвилин неактивності
  useEffect(() => {
    if (!isAuthenticated) return;

    let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      // Оновлюємо час останньої активності
      localStorage.setItem('lastActivity', Date.now().toString());
      
      inactivityTimer = setTimeout(() => {
        console.log('[Auth] Автоматичний логаут через 30 хвилин неактивності');
        authApi.logout();
        setIsAuthenticated(false);
        setActiveItem("dashboard");
        setEditingKPId(null);
      }, INACTIVITY_TIMEOUT);
    };

    // Перевіряємо час останньої активності при завантаженні
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(lastActivity, 10);
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        console.log('[Auth] Сесія закінчилась через неактивність');
        authApi.logout();
        setIsAuthenticated(false);
        setActiveItem("dashboard");
        setEditingKPId(null);
        return;
      }
    }

    // Події активності користувача
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Встановлюємо початковий таймер
    resetTimer();

    // Додаємо слухачі подій
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [isAuthenticated]);

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
      "kp-lead": "Керівник КП",
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
        { label: "Меню та страви" },
      ],
      "kp-templates": [
        { label: "КП", href: "#" },
        { label: "Шаблони КП" },
      ],
      "kp-archive": [
        { label: "КП", href: "#" },
        { label: "Архів КП" },
      ],
      "checklists": [
        { label: "Відділ Продажів", href: "#" },
        { label: "Чекліст" },
      ],
      "all-questionnaires": [
        { label: "Відділ Продажів", href: "#" },
        { label: "Анкети" },
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
      users: [
        { label: "Загальні", href: "#" },
        { label: "Користувачі" },
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
        return <CreateKP kpId={editingKPId} onClose={() => setEditingKPId(null)} />;
      case "menu-dishes":
        return <MenuManagement />;
      case "equipment":
        return <EquipmentManagement />;
      case "service":
        return <ServiceManagement />;
      case "kp-templates":
        return <KPTemplates />;
      case "kp-archive":
        return <KPArchive />;
      case "calendar":
        return <EventsCalendar />;
      case "all-kp":
        return <AllKP onEditKP={(kpId) => {
          setEditingKPId(kpId);
          setActiveItem("create-kp");
        }} />;
      case "client-questionnaires":
        return <SalesDepartment />;
      case "checklists":
        return <ChecklistManagement />;
      case "all-questionnaires":
        return (
          <AllQuestionnaires
            onCreate={() => {
              // Переходимо в розділ відділу продажів для створення/редагування анкети
              setActiveItem("client-questionnaires");
            }}
            onEdit={(questionnaireId) => {
              // TODO: Відкрити форму редагування анкети по ID
              setActiveItem("client-questionnaires");
            }}
          />
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
        return <ProcurementExcel />;
      case "recipes-management":
        return <RecipesManagement />;
      case "service-excel":
        return <ServiceExcel />;
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
      case "users":
        return <UsersManagement />;
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
          <SheetContent side="left" className="p-0 w-[260px] h-full max-h-screen flex flex-col overflow-hidden">
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