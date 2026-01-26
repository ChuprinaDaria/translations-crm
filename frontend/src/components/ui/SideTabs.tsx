import React, { useState } from 'react';
import { cn } from './utils';
import { LucideIcon } from 'lucide-react';

export interface SideTab {
  id: string;
  icon: LucideIcon;
  label: string;
  color: string; // Tailwind колір, наприклад 'blue', 'green', 'amber'
}

interface SideTabsProps {
  tabs: SideTab[];
  activeTab: string | null;
  onTabChange: (tabId: string | null) => void;
  position?: 'right' | 'left';
  className?: string;
}

/**
 * Вертикальні таби-вушка збоку екрану
 * Використовується для відкриття бокових панелей
 */
export function SideTabs({
  tabs,
  activeTab,
  onTabChange,
  position = 'right',
  className,
}: SideTabsProps) {
  
  const handleTabClick = (tabId: string) => {
    // Якщо клік на активний таб — закриваємо
    if (activeTab === tabId) {
      onTabChange(null);
    } else {
      onTabChange(tabId);
    }
  };

  // Кольори для табів
  const getTabColors = (color: string, isActive: boolean) => {
    const colors: Record<string, { bg: string; bgActive: string; text: string; border: string }> = {
      blue: {
        bg: 'bg-blue-50 hover:bg-blue-100',
        bgActive: 'bg-blue-500',
        text: isActive ? 'text-white' : 'text-blue-600',
        border: 'border-blue-500',
      },
      green: {
        bg: 'bg-green-50 hover:bg-green-100',
        bgActive: 'bg-green-500',
        text: isActive ? 'text-white' : 'text-green-600',
        border: 'border-green-500',
      },
      amber: {
        bg: 'bg-amber-50 hover:bg-amber-100',
        bgActive: 'bg-amber-500',
        text: isActive ? 'text-white' : 'text-amber-600',
        border: 'border-amber-500',
      },
      purple: {
        bg: 'bg-purple-50 hover:bg-purple-100',
        bgActive: 'bg-purple-500',
        text: isActive ? 'text-white' : 'text-purple-600',
        border: 'border-purple-500',
      },
      orange: {
        bg: 'bg-orange-50 hover:bg-orange-100',
        bgActive: 'bg-orange-500',
        text: isActive ? 'text-white' : 'text-orange-600',
        border: 'border-orange-500',
      },
      gray: {
        bg: 'bg-gray-50 hover:bg-gray-100',
        bgActive: 'bg-gray-500',
        text: isActive ? 'text-white' : 'text-gray-600',
        border: 'border-gray-500',
      },
    };
    return colors[color] || colors.gray;
  };

  return (
    <div
      className={cn(
        'fixed top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1',
        position === 'right' ? 'right-0' : 'left-0',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const colors = getTabColors(tab.color, isActive);
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            title={tab.label}
            className={cn(
              // Базові стилі
              'w-12 h-12 flex items-center justify-center',
              'transition-all duration-200 ease-out',
              // Форма вушка
              position === 'right' 
                ? 'rounded-l-lg border-l-2 border-t border-b' 
                : 'rounded-r-lg border-r-2 border-t border-b',
              // Колір
              isActive ? colors.bgActive : colors.bg,
              colors.text,
              colors.border,
              // Тінь при активному
              isActive && 'shadow-lg',
              // Виїзд при hover
              !isActive && (position === 'right' ? 'hover:-translate-x-1' : 'hover:translate-x-1')
            )}
          >
            <Icon className="w-5 h-5" />
          </button>
        );
      })}
    </div>
  );
}

