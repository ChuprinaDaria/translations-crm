import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../../components/ui/sheet';

interface CommunicationsLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  contextPanel?: React.ReactNode;
  onSearch?: (query: string) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

/**
 * Основний layout для unified inbox з 3 колонками
 * - Лівий sidebar (240px) - список розмов
 * - Центральна область (flex-1) - чат
 * - Правий sidebar (320px, toggle) - контекстна панель
 */
export function CommunicationsLayout({
  children,
  sidebar,
  contextPanel,
  onSearch,
  isSidebarOpen: externalSidebarOpen,
  onToggleSidebar,
}: CommunicationsLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  // Використовуємо external state якщо передано, інакше internal
  const isSidebarOpen = externalSidebarOpen !== undefined ? externalSidebarOpen : internalSidebarOpen;

  // Responsive detection
  useEffect(() => {
    const checkBreakpoint = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearch?.(value);
  };

  // Використовуємо callback для toggle sidebar
  const handleToggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    } else {
      setInternalSidebarOpen(!internalSidebarOpen);
    }
  };

  return (
    <div 
      className="bg-gray-50"
      style={{
        display: 'grid',
        gridTemplateRows: '64px 1fr',
        height: 'calc(100dvh - 4rem)',
      }}
    >
      {/* Header - row 1: fixed 64px */}
      <header className="border-b border-gray-200 bg-white flex items-center justify-between px-4">
        <div className="flex items-center gap-4 flex-1 max-w-md">
          {/* Search */}
          <div className="relative flex-1">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" 
              aria-hidden="true"
            />
            <Input
              type="text"
              placeholder="Пошук по всіх чатах..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-9 h-9 bg-gray-50 border-gray-200 focus:bg-white"
              aria-label="Search conversations"
            />
          </div>
        </div>

        {/* Right side actions - removed, now using SideTabs */}
      </header>

      {/* Main content area - takes remaining height */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Chat Area - fills available space */}
        <main 
          className="flex-1 min-w-0 bg-white h-full pr-[64px]"
          role="main"
          aria-label="Chat area"
        >
          {children}
        </main>

      </div>

      {/* Sidebar Drawer - Opens from RIGHT (works on all screen sizes) */}
      <Sheet
        open={isSidebarOpen}
        onOpenChange={(open) => {
          if (open === isSidebarOpen) return;
          handleToggleSidebar();
        }}
      >
        <SheetContent side="right" hideOverlay className="w-96 p-0 z-[60] shadow-2xl border-l border-gray-200 mr-[64px]">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Розмови</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto">
            {sidebar}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

