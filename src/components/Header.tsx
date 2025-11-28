import React from "react";
import { Menu } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Button } from "./ui/button";

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
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center">
                  {index > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {index === breadcrumbs.length - 1 ? (
                      <BreadcrumbPage className="font-semibold text-gray-900 truncate max-w-[150px] md:max-w-none">
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        href={crumb.href || "#"}
                        className="text-gray-500 hover:text-gray-700 truncate max-w-[100px]"
                      >
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

        {/* Порожній простір справа */}
        <div />
      </div>
    </header>
  );
}
