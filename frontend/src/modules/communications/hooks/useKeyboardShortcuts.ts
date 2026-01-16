import { useEffect } from 'react';

interface KeyboardShortcutHandlers {
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onCloseAll?: () => void;
}

/**
 * Hook для keyboard shortcuts у chat tabs
 * Shortcuts:
 * - Ctrl+W / Cmd+W - закрити активний таб
 * - Ctrl+Tab - наступний таб
 * - Ctrl+Shift+Tab - попередній таб
 * - Ctrl+Shift+W - закрити всі таби
 */
export function useKeyboardShortcuts(
  openChatsCount: number,
  activeIndex: number,
  handlers: KeyboardShortcutHandlers
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ігнорувати якщо фокус в input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl+W або Cmd+W - закрити активний таб
      if ((e.ctrlKey || e.metaKey) && e.key === 'w' && !e.shiftKey) {
        if (openChatsCount > 0) {
          e.preventDefault();
          handlers.onClose();
        }
      }

      // Ctrl+Shift+W - закрити всі таби
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'w') {
        if (openChatsCount > 0 && handlers.onCloseAll) {
          e.preventDefault();
          handlers.onCloseAll();
        }
      }

      // Ctrl+Tab - наступний таб
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        if (openChatsCount > 1) {
          e.preventDefault();
          handlers.onNext();
        }
      }

      // Ctrl+Shift+Tab - попередній таб
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        if (openChatsCount > 1) {
          e.preventDefault();
          handlers.onPrev();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openChatsCount, activeIndex, handlers]);
}

