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
import { UsersManagement } from "./components/UsersManagement";
import { AutobotSettingsPage } from "./modules/autobot/pages/AutobotSettingsPage";
import { AuthPage } from "./components/auth/AuthPage";
import { TermsOfService } from "./pages/TermsOfService";
import { GDPRPolicy } from "./pages/GDPRPolicy";
import { Toaster } from "./components/ui/sonner";
import { tokenManager, authApi, settingsApi } from "./lib/api";
import { I18nProvider } from "./lib/i18n";
import { initFacebookSDK, logFacebookPageView } from "./lib/facebook-sdk";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "./components/ui/sheet";
// import { CommandPalette, useCommandPalette } from "./modules/command-palette";

type UserRole = "OWNER" | "ACCOUNTANT" | "MANAGER";

// Константа для таймауту неактивності (30 хвилин в мілісекундах)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeItem, setActiveItem] = useState("analytics");
  const [userRole, setUserRole] = useState<UserRole>("MANAGER");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [editingKPId, setEditingKPId] = useState<number | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  // const commandPalette = useCommandPalette();

  // Listen to pathname changes
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

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
        
        // Отримуємо роль та is_admin з токену
        if (isAuth) {
          const token = localStorage.getItem('auth_token');
          if (token) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const role = payload.role || "MANAGER";
              // Нормалізуємо роль до правильного формату
              const normalizedRole = role.toUpperCase();
              if (normalizedRole === "OWNER" || normalizedRole === "ACCOUNTANT" || normalizedRole === "MANAGER") {
                setUserRole(normalizedRole as UserRole);
              } else {
                setUserRole("MANAGER"); // За замовчуванням
              }
              
              // Перевірка is_admin з різних можливих форматів
              const isAdminFromPayload =
                payload.is_admin === true ||
                payload.is_admin === "true" ||
                payload.is_admin === 1 ||
                payload.isAdmin === true ||
                payload.isAdmin === "true" ||
                payload.isAdmin === 1 ||
                payload.admin === true ||
                payload.admin === "true" ||
                payload.admin === 1 ||
                (typeof payload.role === "string" && payload.role.toLowerCase().includes("admin"));
              setIsAdmin(isAdminFromPayload);
            } catch (e) {
              console.error("Помилка декодування токену:", e);
            }
          }
        }
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

  // Initialize Facebook SDK when authenticated and App ID is available
  useEffect(() => {
    if (!isAuthenticated) return;

    const initSDK = async () => {
      try {
        const facebookConfig = await settingsApi.getFacebookConfig();
        if (facebookConfig.app_id) {
          await initFacebookSDK(facebookConfig.app_id);
          // Log initial page view after SDK initialization
          logFacebookPageView();
        }
      } catch (error) {
        // Silently fail - Facebook SDK is optional
        console.debug('Facebook SDK initialization skipped:', error);
      }
    };

    initSDK();
  }, [isAuthenticated]);

  // Log page view on route changes
  useEffect(() => {
    if (isAuthenticated) {
      // Small delay to ensure route has changed
      const timer = setTimeout(() => {
        logFacebookPageView();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentPath, isAuthenticated]);

  // Listen for navigation events (e.g., from command palette or other components)
  useEffect(() => {
    const handleNavigate = (event: CustomEvent) => {
      const { path, kpId } = event.detail;
      if (path?.startsWith('/clients/')) {
        const clientId = path.split('/clients/')[1];
        if (clientId) {
          setActiveItem('clients');
          // Dispatch event to ClientsPageEnhanced to select the client
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('navigate:client', { detail: { clientId } })
            );
          }, 100);
        }
      } else if (path === '/crm' && kpId) {
        setActiveItem('crm');
        // Dispatch event to BoardPage to select the order
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('navigate:order', { detail: { orderId: kpId } })
          );
        }, 100);
      } else if (path === '/crm') {
        setActiveItem('crm');
      }
    };

    window.addEventListener('command:navigate', handleNavigate as EventListener);
    return () => {
      window.removeEventListener('command:navigate', handleNavigate as EventListener);
    };
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
      "OWNER": "Адміністратор",
      "ACCOUNTANT": "Бухгалтер",
      "MANAGER": "Менеджер",
    };
    return roleLabels[role] || role;
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
      users: [{ label: "Users" }],
      settings: [{ label: "Settings" }],
    };

    return (
      breadcrumbMap[activeItem] || [{ label: "Analytics" }]
    );
  };

  const renderContent = () => {
    // Перевірка чи це сторінка з документацією (не потребує sidebar)
    if (currentPath === "/terms" || currentPath === "/gdpr") {
      if (currentPath === "/terms") {
        return <TermsOfService />;
      }
      if (currentPath === "/gdpr") {
        return <GDPRPolicy />;
      }
    }

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
      case "users":
        return <UsersManagement />;
      case "settings":
        return <Settings />;
      case "autobot":
        return <AutobotSettingsPage />;
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

  // Якщо це сторінка документації - показуємо без sidebar
  if (isAuthenticated && (currentPath === "/terms" || currentPath === "/gdpr")) {
    return (
      <I18nProvider>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          {renderContent()}
          <footer className="border-t bg-white mt-auto py-4 px-6">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600">
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <a 
                  href="/terms" 
                  className="hover:text-[#FF5A00] transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, "", "/terms");
                    setCurrentPath("/terms");
                  }}
                >
                  Умови використання
                </a>
                <span className="text-gray-300">|</span>
                <a 
                  href="/gdpr" 
                  className="hover:text-[#FF5A00] transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, "", "/gdpr");
                    setCurrentPath("/gdpr");
                  }}
                >
                  Політика конфіденційності (GDPR)
                </a>
                <span className="text-gray-300">|</span>
                <a 
                  href="#" 
                  className="hover:text-[#FF5A00] transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, "", "/");
                    setCurrentPath("/");
                    setActiveItem("analytics");
                  }}
                >
                  На головну
                </a>
              </div>
            </div>
          </footer>
        </div>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider>
      <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sidebar
          activeItem={activeItem}
          onItemClick={handleMenuItemClick}
          userRole={userRole}
          isAdmin={isAdmin}
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
              isAdmin={isAdmin}
              isMobile={true}
              onLogout={handleLogout}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="transition-all duration-300 lg:ml-[260px] flex flex-col min-h-screen">
        <Header
          breadcrumbs={getBreadcrumbs()}
          onMobileMenuClick={() => setMobileMenuOpen(true)}
          isMobile={isMobile}
        />

        <main className="pt-16 flex-1">
          <div className={activeItem === 'inbox' ? '' : 'p-4 md:p-6'}>{renderContent()}</div>
        </main>

        {/* Footer with links */}
        {isAuthenticated && (
          <footer className="border-t bg-white mt-auto py-4 px-6">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600">
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <a 
                  href="/terms" 
                  className="hover:text-[#FF5A00] transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, "", "/terms");
                    setCurrentPath("/terms");
                  }}
                >
                  Умови використання
                </a>
                <span className="text-gray-300">|</span>
                <a 
                  href="/gdpr" 
                  className="hover:text-[#FF5A00] transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, "", "/gdpr");
                    setCurrentPath("/gdpr");
                  }}
                >
                  Політика конфіденційності (GDPR)
                </a>
              </div>
              <div className="text-xs text-gray-500 text-center md:text-right">
                <p className="mb-1">
                  <span className="font-semibold">Instagram Data Deletion:</span>{" "}
                  <code className="bg-gray-100 px-1 rounded text-[10px]">POST /api/v1/communications/instagram/data-deletion</code>
                </p>
                <p>
                  <span className="font-semibold">Instagram Deauthorization:</span>{" "}
                  <code className="bg-gray-100 px-1 rounded text-[10px]">POST /api/v1/communications/instagram/deauthorize</code>
                </p>
              </div>
            </div>
          </footer>
        )}
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