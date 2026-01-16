import { useState, useCallback, useEffect } from 'react';

export type TabType = 'client' | 'order';

export interface ClientTabData {
  id: string;
  type: 'client';
  clientId: string;
  clientName: string;
  hasUnsavedChanges?: boolean;
}

export interface OrderTabData {
  id: string;
  type: 'order';
  orderId: string;
  orderNumber: string;
  clientId?: string;
  hasUnsavedChanges?: boolean;
}

export type TabData = ClientTabData | OrderTabData;

const MAX_TABS = 10;
const STORAGE_KEY = 'crm_client_tabs';

interface UseClientTabsReturn {
  tabs: TabData[];
  activeTabId: string | null;
  openClientTab: (clientId: string, clientName: string) => boolean;
  openOrderTab: (orderId: string, orderNumber: string, clientId?: string) => boolean;
  closeTab: (tabId: string, force?: boolean) => void;
  closeAllTabs: () => void;
  switchTab: (tabId: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  setTabUnsavedChanges: (tabId: string, hasChanges: boolean) => void;
  hasUnsavedChanges: () => boolean;
  getActiveTab: () => TabData | null;
  isMaxTabsReached: boolean;
}

export function useClientTabs(): UseClientTabsReturn {
  const [tabs, setTabs] = useState<TabData[]>(() => {
    // Restore tabs from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.tabs || [];
      }
    } catch {
      // Ignore errors
    }
    return [];
  });

  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.activeTabId || null;
      }
    } catch {
      // Ignore errors
    }
    return null;
  });

  // Save tabs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeTabId }));
    } catch {
      // Ignore errors
    }
  }, [tabs, activeTabId]);

  const openClientTab = useCallback((clientId: string, clientName: string): boolean => {
    // Check if tab already exists
    const existingTab = tabs.find(
      (tab) => tab.type === 'client' && (tab as ClientTabData).clientId === clientId
    );

    if (existingTab) {
      setActiveTabId(existingTab.id);
      return true;
    }

    // Check max tabs
    if (tabs.length >= MAX_TABS) {
      return false;
    }

    const newTab: ClientTabData = {
      id: `client-${clientId}-${Date.now()}`,
      type: 'client',
      clientId,
      clientName,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    return true;
  }, [tabs]);

  const openOrderTab = useCallback((orderId: string, orderNumber: string, clientId?: string): boolean => {
    // Check if tab already exists
    const existingTab = tabs.find(
      (tab) => tab.type === 'order' && (tab as OrderTabData).orderId === orderId
    );

    if (existingTab) {
      setActiveTabId(existingTab.id);
      return true;
    }

    // Check max tabs
    if (tabs.length >= MAX_TABS) {
      return false;
    }

    const newTab: OrderTabData = {
      id: `order-${orderId}-${Date.now()}`,
      type: 'order',
      orderId,
      orderNumber,
      clientId,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    return true;
  }, [tabs]);

  const closeTab = useCallback((tabId: string, force = false) => {
    const tab = tabs.find((t) => t.id === tabId);
    
    if (!force && tab?.hasUnsavedChanges) {
      // Will be handled by the component to show confirmation
      return;
    }

    setTabs((prev) => {
      const index = prev.findIndex((t) => t.id === tabId);
      const newTabs = prev.filter((t) => t.id !== tabId);
      
      // Update active tab if needed
      if (activeTabId === tabId && newTabs.length > 0) {
        // Switch to adjacent tab
        const newIndex = Math.min(index, newTabs.length - 1);
        setActiveTabId(newTabs[newIndex]?.id || null);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }
      
      return newTabs;
    });
  }, [tabs, activeTabId]);

  const closeAllTabs = useCallback(() => {
    const hasUnsaved = tabs.some((tab) => tab.hasUnsavedChanges);
    if (hasUnsaved) {
      // Will be handled by component
      return;
    }
    setTabs([]);
    setActiveTabId(null);
  }, [tabs]);

  const switchTab = useCallback((tabId: string) => {
    if (tabs.some((t) => t.id === tabId)) {
      setActiveTabId(tabId);
    }
  }, [tabs]);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((prev) => {
      const newTabs = [...prev];
      const [removed] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, removed);
      return newTabs;
    });
  }, []);

  const setTabUnsavedChanges = useCallback((tabId: string, hasChanges: boolean) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, hasUnsavedChanges: hasChanges } : tab
      )
    );
  }, []);

  const hasUnsavedChanges = useCallback(() => {
    return tabs.some((tab) => tab.hasUnsavedChanges);
  }, [tabs]);

  const getActiveTab = useCallback((): TabData | null => {
    return tabs.find((tab) => tab.id === activeTabId) || null;
  }, [tabs, activeTabId]);

  return {
    tabs,
    activeTabId,
    openClientTab,
    openOrderTab,
    closeTab,
    closeAllTabs,
    switchTab,
    reorderTabs,
    setTabUnsavedChanges,
    hasUnsavedChanges,
    getActiveTab,
    isMaxTabsReached: tabs.length >= MAX_TABS,
  };
}

