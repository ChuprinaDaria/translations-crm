import React, { useState, useEffect } from 'react';
import { Search, Menu, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../../components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { cn } from '../../../components/ui/utils';

interface CommunicationsLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  contextPanel?: React.ReactNode;
  onSearch?: (query: string) => void;
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
}: CommunicationsLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Responsive detection
  useEffect(() => {
    const checkBreakpoint = () => {
      setIsMobile(window.innerWidth < 640);
      setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024);
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

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50">
      {/* Header */}
      <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 shrink-0">
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

          {/* Mobile menu button - справа від пошуку */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden shrink-0"
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            aria-label="Toggle sidebar"
            aria-expanded={isMobileSidebarOpen}
          >
            {isMobileSidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </Button>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Context panel toggle - Desktop/Tablet */}
          {contextPanel && !isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsContextPanelOpen(!isContextPanelOpen)}
              className="hidden md:flex"
              aria-label="Toggle context panel"
              aria-expanded={isContextPanelOpen}
            >
              {isContextPanelOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          )}
          {/* Context panel toggle - Mobile */}
          {contextPanel && isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsContextPanelOpen(true)}
              className="md:hidden"
              aria-label="Open context panel"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Desktop/Tablet */}
        <aside
          className={cn(
            'w-60 border-r border-gray-200 bg-white flex flex-col shrink-0',
            'hidden md:flex',
            'transition-sidebar'
          )}
          aria-label="Conversations sidebar"
        >
          {sidebar}
        </aside>

        {/* Chat Area */}
        <main 
          className="flex-1 flex flex-col overflow-hidden bg-white"
          role="main"
          aria-label="Chat area"
        >
          {children}
        </main>

        {/* Right Sidebar - Context Panel (Desktop/Tablet) */}
        {contextPanel && !isMobile && (
          <aside
            className={cn(
              'w-80 border-l border-gray-200 bg-white flex flex-col shrink-0',
              'hidden lg:flex',
              isContextPanelOpen && 'lg:flex',
              'transition-sidebar'
            )}
            aria-label="Context panel"
          >
            {contextPanel}
          </aside>
        )}
      </div>

      {/* Mobile Sidebar Drawer - Opens from RIGHT */}
      <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
        <SheetContent side="right" className="w-[280px] sm:w-[320px] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Розмови</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto">
            {sidebar}
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile Context Panel Modal */}
      {contextPanel && isMobile && (
        <Dialog open={isContextPanelOpen} onOpenChange={setIsContextPanelOpen}>
          <DialogContent className="max-w-[90vw] h-[90vh] p-0 flex flex-col">
            <DialogHeader className="p-4 border-b shrink-0">
              <DialogTitle>Контекст</DialogTitle>
              <DialogDescription className="sr-only">
                Контекстна інформація про розмову та клієнта
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {contextPanel}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

