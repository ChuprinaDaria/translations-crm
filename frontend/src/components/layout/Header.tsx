import React, { useState, useEffect } from "react";
import { Home, Menu } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { Button } from "../ui/button";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { NotificationCenter } from "@/modules/notifications/components/NotificationCenter";
import { NotificationSettings } from "@/modules/notifications/components/NotificationSettings";
import { getUserIdFromToken } from "@/modules/notifications/utils/userId";

interface HeaderProps {
  breadcrumbs: { label: string; href?: string }[];
  onMobileMenuClick?: () => void;
  isMobile?: boolean;
}

export function Header({ 
  breadcrumbs, 
  onMobileMenuClick,
  isMobile = false
}: HeaderProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Отримати user_id з токену
    const id = getUserIdFromToken();
    setUserId(id);
  }, []);

  return (
    <header className="fixed top-0 right-0 lg:left-[260px] left-0 h-16 bg-white border-b border-gray-200 z-40 shadow-sm">
      <div className="h-full px-4 md:px-6 flex items-center justify-between gap-2 md:gap-4">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMobileMenuClick}
              className="lg:hidden p-2"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
          
          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList className="gap-2">
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center">
                  {index > 0 && <BreadcrumbSeparator className="text-gray-300" />}
                  <BreadcrumbItem>
                    {index === breadcrumbs.length - 1 ? (
                      <BreadcrumbPage className="font-semibold text-gray-900 truncate max-w-[180px] md:max-w-none flex items-center gap-2">
                        {index === 0 && <Home className="w-4 h-4 text-gray-500" />}
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        href={crumb.href || "#"}
                        className="text-gray-500 hover:text-gray-700 truncate max-w-[140px] px-2 py-1 rounded-md hover:bg-gray-100 flex items-center gap-2"
                      >
                        {index === 0 && <Home className="w-4 h-4 text-gray-400" />}
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          {/* Mobile: Show only last breadcrumb */}
          <div className="sm:hidden truncate text-sm font-semibold text-gray-900">
            {breadcrumbs[breadcrumbs.length - 1].label}
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Notification Center */}
          {userId && (
            <>
              <NotificationCenter 
                userId={userId} 
                onNotificationClick={(notification) => {
                  if (notification.action_url) {
                    window.location.href = notification.action_url;
                  }
                }}
              />
              <NotificationSettings userId={userId} />
            </>
          )}
          
          {/* Language Switcher */}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
