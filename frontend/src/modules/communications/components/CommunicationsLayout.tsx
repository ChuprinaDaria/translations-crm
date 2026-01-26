import React, { useState, useEffect } from 'react';
import { Search, FileText, StickyNote, User, Lightbulb, FolderOpen, Menu, CreditCard, Package, UserPlus } from 'lucide-react';
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
import { SideTabs, type SideTab, type QuickAction } from '../../../components/ui';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { InternalNotes } from '../../crm/components/InternalNotes';
import { AttachmentPreview } from './AttachmentPreview';

// Базові таби для Inbox (без quickActions, вони додаються динамічно)
const BASE_INBOX_SIDE_TABS: SideTab[] = [
  { id: 'sidebar', icon: Menu, label: 'Відкрити список діалогів', color: 'gray' },
  { id: 'notes', icon: StickyNote, label: 'Нотатки', color: 'purple' },
  { id: 'files', icon: FolderOpen, label: 'Файли', color: 'orange' },
];

interface CommunicationsLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  contextPanel?: React.ReactNode;
  onSearch?: (query: string) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  quickActions?: QuickAction[];
  activeSideTab?: string | null;
  onActiveSideTabChange?: (tabId: string | null) => void;
  // Дані для відображення нотаток та файлів активного чату
  activeConversationId?: string | null;
  activeMessages?: Array<{
    id: string;
    attachments?: Array<{
      id?: string;
      type: string;
      filename: string;
      mime_type: string;
      size: number;
      url?: string;
    }>;
  }>;
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
  quickActions = [],
  activeSideTab: externalActiveSideTab,
  onActiveSideTabChange,
  activeConversationId,
  activeMessages = [],
}: CommunicationsLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [internalActiveSideTab, setInternalActiveSideTab] = useState<string | null>(null);
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  // Використовуємо external state якщо передано, інакше internal
  const isSidebarOpen = externalSidebarOpen !== undefined ? externalSidebarOpen : internalSidebarOpen;
  const activeSideTab = externalActiveSideTab !== undefined ? externalActiveSideTab : internalActiveSideTab;
  
  const setActiveSideTab = (tabId: string | null) => {
    if (onActiveSideTabChange) {
      onActiveSideTabChange(tabId);
    } else {
      setInternalActiveSideTab(tabId);
    }
  };

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

  // Формуємо повний список табів з quickActions
  const allTabs = React.useMemo(() => {
    const tabs: SideTab[] = [...BASE_INBOX_SIDE_TABS];
    
    // Додаємо quickActions як таби
    quickActions.forEach((action) => {
      tabs.push({
        id: action.id,
        icon: action.icon,
        label: action.label,
        color: 'gray',
        disabled: action.disabled,
      });
    });
    
    return tabs;
  }, [quickActions]);

  // Обробник кліку на таб
  const handleTabChange = (tabId: string | null) => {
    if (!tabId) {
      setActiveSideTab(null);
      return;
    }

    // Обробка кліку на таб "sidebar"
    if (tabId === 'sidebar') {
      handleToggleSidebar();
      setActiveSideTab(null);
      return;
    }

    // Перевіряємо чи це quickAction
    const quickAction = quickActions.find((action) => action.id === tabId);
    if (quickAction) {
      // Виконуємо дію quickAction (disabled перевірка вже в SideTabs)
      if (!quickAction.disabled) {
        quickAction.onClick();
      }
      // Не зберігаємо активний таб для quickActions (вони виконують дію і закриваються)
      setActiveSideTab(null);
      return;
    }

    // Для звичайних табів (notes, files) - переключаємо
    if (tabId === activeSideTab) {
      setActiveSideTab(null);
    } else {
      setActiveSideTab(tabId);
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
          className="flex-1 min-w-0 bg-white h-full"
          role="main"
          aria-label="Chat area"
        >
          {children}
        </main>

        {/* Right Sidebar - Context Panel (Desktop/Tablet) */}
        {contextPanel && !isMobile && isContextPanelOpen && (
          <aside
            className={cn(
              'w-96 h-full border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-hidden',
              'transition-all duration-300 ease-out z-40 mr-14'
            )}
            aria-label="Context panel"
          >
            {React.isValidElement(contextPanel)
              ? React.cloneElement(contextPanel as React.ReactElement<any>, {
                  activeSideTab,
                })
              : contextPanel}
          </aside>
        )}
      </div>

      {/* Sidebar Drawer - Opens from RIGHT (works on all screen sizes) */}
      <Sheet
        open={isSidebarOpen}
        onOpenChange={(open) => {
          if (open === isSidebarOpen) return;
          handleToggleSidebar();
        }}
      >
        <SheetContent side="right" hideOverlay className="w-96 p-0 z-[60] shadow-2xl border-l border-gray-200 mr-14">
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
              {React.isValidElement(contextPanel)
                ? React.cloneElement(contextPanel as React.ReactElement<any>, {
                    activeSideTab,
                  })
                : contextPanel}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Side Panel for Notes and Files */}
      {!isMobile && activeSideTab && activeSideTab !== 'sidebar' && (
        <aside
          className={cn(
            'w-96 h-full border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-hidden',
            'transition-all duration-300 ease-out z-40 mr-14'
          )}
          aria-label="Side panel"
        >
          <ScrollArea className="flex-1">
            {activeSideTab === 'notes' && activeConversationId && (
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Нотатки</h3>
                <InternalNotes
                  entityType="chat"
                  entityId={activeConversationId}
                />
              </div>
            )}
            {activeSideTab === 'files' && activeMessages && (
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Файли</h3>
                <div className="grid grid-cols-2 gap-3">
                  {activeMessages
                    .flatMap((msg) => msg.attachments || [])
                    .filter((att) => att && att.url)
                    .map((attachment, idx) => (
                      <AttachmentPreview
                        key={attachment.id || idx}
                        attachment={attachment}
                        onDownload={() => {
                          if (attachment.url) {
                            window.open(attachment.url, '_blank');
                          }
                        }}
                      />
                    ))}
                  {activeMessages.flatMap((msg) => msg.attachments || []).filter((att) => att && att.url).length === 0 && (
                    <div className="col-span-2 text-center text-gray-500 py-8">
                      <FolderOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Немає файлів</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
        </aside>
      )}

      {/* SideTabs - Vertical colored tabs on the right (завжди видимі) */}
      {!isMobile && (
        <SideTabs
          tabs={allTabs}
          activeTab={activeSideTab}
          onTabChange={handleTabChange}
          position="right"
        />
      )}
    </div>
  );
}

