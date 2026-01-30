import { useState, useEffect } from 'react';

interface TabState {
  conversationId: string;
  platform: string;
  externalId: string;
}

export const useTabsState = () => {
  const [openTabs, setOpenTabs] = useState<TabState[]>(() => {
    // Відновлюємо з localStorage при завантаженні
    try {
      const saved = localStorage.getItem('inbox-open-tabs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load tabs from localStorage:', e);
      return [];
    }
  });

  // Зберігаємо в localStorage при зміні
  useEffect(() => {
    try {
      localStorage.setItem('inbox-open-tabs', JSON.stringify(openTabs));
    } catch (e) {
      console.error('Failed to save tabs to localStorage:', e);
    }
  }, [openTabs]);

  const addTab = (tab: TabState) => {
    setOpenTabs(prev => {
      // Не додаємо дублікат
      if (prev.some(t => t.conversationId === tab.conversationId)) {
        return prev;
      }
      return [...prev, tab];
    });
  };

  const removeTab = (conversationId: string) => {
    setOpenTabs(prev => prev.filter(t => t.conversationId !== conversationId));
  };

  const clearTabs = () => {
    setOpenTabs([]);
    try {
      localStorage.removeItem('inbox-open-tabs');
    } catch (e) {
      console.error('Failed to clear tabs from localStorage:', e);
    }
  };

  return { openTabs, addTab, removeTab, clearTabs };
};

