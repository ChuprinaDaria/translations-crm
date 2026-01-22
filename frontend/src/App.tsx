import { useState, useEffect } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { DashboardPage } from "./modules/analytics/pages/DashboardPage";
import { InboxPageEnhanced } from "./modules/communications/pages/InboxPageEnhanced";
import { CRMPage } from "./modules/crm/pages/CRMPage";
import { FinancePage } from "./modules/finance/pages/FinancePage";
import { ClientsPageEnhanced } from "./modules/crm/pages/ClientsPageEnhanced";
import { TranslatorsPage } from "./modules/crm/pages/TranslatorsPage";
import { LanguagesPage } from "./modules/crm/pages/LanguagesPage";
import { Settings } from "./components/Settings";
import { AuthPage } from "./components/auth/AuthPage";
import { Toaster } from "./components/ui/sonner";
import { tokenManager, authApi } from "./lib/api";
import { I18nProvider } from "./lib/i18n";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "./components/ui/sheet";
// import { CommandPalette, useCommandPalette } from "./modules/command-palette";

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
  const [activeItem, setActiveItem] = useState("analytics");
  const [userRole] = useState<UserRole>("kp-manager");
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [editingKPId, setEditingKPId] = useState<number | null>(null);
  // const commandPalette = useCommandPalette();

  // Load Google Fonts (Inter as Gilroy replacement)
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = "https://fonts.googleapis.com";
    document.head.appendChild(link);
    
    const fontLink = document.createElement("link");
    fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    fontLink.rel = "stylesheet";
    document.head.appendChild(fontLink);
    
    return () => {
      try {
        if (document.head.contains(link)) {
          document.head.removeChild(link);
        }
        if (document.head.contains(fontLink)) {
          document.head.removeChild(fontLink);
        }
      } catch (e) {
        // Ignore errors during cleanup
      }
    };
  }, []);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        // Перевірка dev режиму (для розробки)
        const devMode = import.meta.env.DEV && localStorage.getItem('dev_mode') === 'true';
        if (devMode) {
          console.log('[Dev] Dev mode enabled - skipping authentication');
          setIsAuthenticated(true);
          setIsCheckingAuth(false);
          return;
        }
        
        const isAuth = tokenManager.isAuthenticated();
        setIsAuthenticated(isAuth);
      } catch (error) {
        console.error("Auth check error:", error);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    
    checkAuth();
  }, []);

  // Sync auth state when token changes (401, logout in another place, etc.)
  useEffect(() => {
    const syncAuth = () => {
      const isAuth = tokenManager.isAuthenticated();
      setIsAuthenticated(isAuth);
      if (!isAuth) {
        setActiveItem("analytics");
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
        setActiveItem("analytics");
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
        setActiveItem("analytics");
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
    localStorage.removeItem('dev_mode'); // Очищаємо dev_mode при виході
    setIsAuthenticated(false);
    setActiveItem("analytics");
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
    return (
      <I18nProvider>
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      </I18nProvider>
    );
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
      inbox: [{ label: "Inbox" }],
      crm: [{ label: "Замовлення" }],
      finance: [{ label: "Finance" }],
      clients: [{ label: "Clients" }],
      translators: [{ label: "Translators" }],
      languages: [{ label: "Мови" }],
      analytics: [{ label: "Analytics" }],
      settings: [{ label: "Settings" }],
    };

    return (
      breadcrumbMap[activeItem] || [{ label: "Analytics" }]
    );
  };

  const renderContent = () => {
    switch (activeItem) {
      case "inbox":
        return <InboxPageEnhanced />;
      case "crm":
        return <CRMPage />;
      case "finance":
        return <FinancePage />;
      case "clients":
        return <ClientsPageEnhanced />;
      case "translators":
        return <TranslatorsPage />;
      case "languages":
        return <LanguagesPage />;
      case "analytics":
        return <DashboardPage userRole={getRoleLabel(userRole)} onNavigate={setActiveItem} />;
      case "settings":
        return <Settings />;
      default:
        return <DashboardPage userRole={getRoleLabel(userRole)} onNavigate={setActiveItem} />;
    }
  };

  const handleMenuItemClick = (item: string) => {
    setActiveItem(item);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <I18nProvider>
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
          <div className={activeItem === 'inbox' ? '' : 'p-4 md:p-6'}>{renderContent()}</div>
        </main>
      </div>

      <Toaster position="top-right" />
      
      {/* Command Palette - доступний скрізь */}
      {/* {isAuthenticated && (
        <CommandPalette
          open={commandPalette.open}
          onOpenChange={commandPalette.setOpen}
        />
      )} */}
      </div>
    </I18nProvider>
  );
}

export default App;