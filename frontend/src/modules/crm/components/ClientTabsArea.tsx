import React, { useRef, useState, useEffect } from 'react';
import { X, User, Package, Plus, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../components/ui/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog';
import type { TabData, ClientTabData, OrderTabData } from '../hooks/useClientTabs';

interface ClientTabsAreaProps {
  tabs: TabData[];
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string, force?: boolean) => void;
  onNewClient: () => void;
  isMaxTabsReached: boolean;
  children: React.ReactNode;
}

export function ClientTabsArea({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onNewClient,
  isMaxTabsReached,
  children,
}: ClientTabsAreaProps) {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [tabToClose, setTabToClose] = useState<string | null>(null);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);

  // Check scroll state
  const checkScroll = () => {
    const container = tabsContainerRef.current;
    if (!container) return;

    setShowLeftScroll(container.scrollLeft > 0);
    setShowRightScroll(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 5
    );
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [tabs]);

  const scrollTabs = (direction: 'left' | 'right') => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleTabClose = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tab = tabs.find((t) => t.id === tabId);
    
    if (tab?.hasUnsavedChanges) {
      setTabToClose(tabId);
    } else {
      onTabClose(tabId);
    }
  };

  const confirmClose = () => {
    if (tabToClose) {
      onTabClose(tabToClose, true);
      setTabToClose(null);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (tabId: string) => {
    setDraggedTab(tabId);
  };

  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    if (draggedTab && draggedTab !== tabId) {
      setDragOverTab(tabId);
    }
  };

  const handleDragEnd = () => {
    setDraggedTab(null);
    setDragOverTab(null);
  };

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    if (draggedTab && draggedTab !== targetTabId) {
      // Reorder tabs - handled by parent component
      // For now, just reset state
    }
    handleDragEnd();
  };

  if (tabs.length === 0) {
    // If children are provided (like client list), show them instead of empty state
    if (children) {
      return (
        <div className="h-full flex flex-col">
          {children}
        </div>
      );
    }
    
    // Otherwise show empty state
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <User className="w-16 h-16 mb-4 text-[#FF5A00] opacity-30" />
        <h3 className="text-lg font-medium mb-2">Виберіть клієнта зі списку</h3>
        <p className="text-sm text-gray-400 mb-4">
          або створіть нового клієнта
        </p>
        <Button onClick={onNewClient} className="bg-[#FF5A00] hover:bg-[#FF5A00]/90">
          <Plus className="w-4 h-4 mr-2" />
          Новий клієнт
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tabs bar */}
      <div className="h-10 bg-gray-100 flex items-end shrink-0 border-b">
        {/* Left scroll button */}
        {showLeftScroll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scrollTabs('left')}
            className="h-full px-1 rounded-none shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}

        {/* Tabs container */}
        <div
          ref={tabsContainerRef}
          className="flex-1 flex items-end overflow-x-auto scrollbar-hide"
          onScroll={checkScroll}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isClient = tab.type === 'client';
            const Icon = isClient ? User : Package;
            const label = isClient
              ? (tab as ClientTabData).clientName
              : (tab as OrderTabData).orderNumber;

            return (
              <div
                key={tab.id}
                draggable
                onDragStart={() => handleDragStart(tab.id)}
                onDragOver={(e) => handleDragOver(e, tab.id)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, tab.id)}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'group relative flex items-center gap-1.5 px-3 h-9 cursor-pointer',
                  'border-t border-l border-r border-transparent',
                  'transition-all duration-150 ease-out',
                  'select-none',
                  isActive
                    ? 'bg-white border-gray-200 rounded-t-lg -mb-px z-10'
                    : 'bg-gray-50 hover:bg-gray-100 rounded-t-md mt-1 mx-0.5',
                  draggedTab === tab.id && 'opacity-50',
                  dragOverTab === tab.id && 'border-l-blue-500'
                )}
                style={{ minWidth: '120px', maxWidth: '200px' }}
              >
                <Icon
                  className={cn(
                    'w-3.5 h-3.5 shrink-0',
                    isClient ? 'text-[#FF5A00]' : 'text-emerald-500'
                  )}
                />
                <span className="text-sm truncate flex-1">
                  {label}
                </span>
                {tab.hasUnsavedChanges && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                )}
                <button
                  onClick={(e) => handleTabClose(tab.id, e)}
                  className={cn(
                    'w-5 h-5 rounded flex items-center justify-center shrink-0',
                    'transition-colors',
                    isActive
                      ? 'hover:bg-gray-200'
                      : 'opacity-0 group-hover:opacity-100 hover:bg-gray-300'
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right scroll button */}
        {showRightScroll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scrollTabs('right')}
            className="h-full px-1 rounded-none shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}

        {/* New tab button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewClient}
          disabled={isMaxTabsReached}
          className={cn(
            'h-8 w-8 p-0 rounded-full mx-1 my-auto shrink-0',
            'hover:bg-gray-200 transition-transform hover:scale-110',
            isMaxTabsReached && 'opacity-50 cursor-not-allowed'
          )}
          title={isMaxTabsReached ? 'Забагато відкритих табів (макс. 10)' : 'Новий клієнт'}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Max tabs warning */}
      {isMaxTabsReached && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4" />
          <span>Забагато відкритих табів. Закрийте деякі, щоб відкрити нові.</span>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-auto bg-white">
        {children}
      </div>

      {/* Unsaved changes confirmation dialog */}
      <AlertDialog open={!!tabToClose} onOpenChange={(open) => !open && setTabToClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Незбережені зміни</AlertDialogTitle>
            <AlertDialogDescription>
              У цій вкладці є незбережені зміни. Ви впевнені, що хочете її закрити?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClose}
              className="bg-red-600 hover:bg-red-700"
            >
              Закрити без збереження
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

