import { cn } from './utils';
import { LucideIcon } from 'lucide-react';

export interface SideTab {
  id: string;
  icon: LucideIcon;
  label: string;
  color: string; // Tailwind колір, наприклад 'blue', 'green', 'amber'
  disabled?: boolean;
}

export interface QuickAction {
  id: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface SideTabsProps {
  tabs: SideTab[];
  activeTab: string | null;
  onTabChange: (tabId: string | null) => void;
  position?: 'right' | 'left';
  className?: string;
  quickActions?: QuickAction[];
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
  quickActions = [],
}: SideTabsProps) {
  const handleTabClick = (tabId: string) => {
    // Якщо клік на активний таб — закриваємо
    if (activeTab === tabId) {
      onTabChange(null);
    } else {
      onTabChange(tabId);
    }
  };

  // Кольори для табів - сірий стиль для всіх
  const getTabColors = () => {
    // Всі таби мають сірий стиль як у SVG
    return {
      bg: 'bg-white hover:bg-gray-50',
      bgActive: 'bg-gray-100',
      text: 'text-gray-600',
      border: 'border-gray-300',
    };
  };

  return (
    <div
      className={cn(
        // Тепер SideTabs працює в flexbox лейауті, тому не потрібне fixed позиціонування
        // Він знаходиться всередині aside з flexbox структурою
        'h-full w-full flex flex-col',
        className
      )}
    >
      {/* Контейнер - таби вгорі */}
      <div className="flex flex-col gap-1 p-1 pt-0">
        {/* Основні таби */}
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const colors = getTabColors();
          const Icon = tab.icon;
          const isDisabled = tab.disabled;

          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && handleTabClick(tab.id)}
              disabled={isDisabled}
              title={tab.label}
              className={cn(
                'w-12 h-12 flex items-center justify-center',
                'transition-all duration-200 ease-out',
                'rounded-lg',
                isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
                isActive ? colors.bgActive : colors.bg,
                colors.text,
                isActive && 'shadow-md',
                !isActive && !isDisabled && (position === 'right' ? 'hover:-translate-x-1' : 'hover:translate-x-1'),
                isDisabled && 'opacity-50'
              )}
            >
              <Icon className="w-5 h-5" style={{ color: 'rgb(55, 65, 81)' }} />
            </button>
          );
        })}

        {/* Quick Actions — в тому ж списку, як інші таби */}
        {quickActions && quickActions.length > 0 && quickActions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              title={action.label}
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                'w-12 h-12 flex items-center justify-center',
                'transition-all duration-200 ease-out',
                'rounded-lg',
                'bg-white hover:bg-gray-50',
                'text-gray-600',
                'cursor-pointer',
                !action.disabled && (position === 'right' ? 'hover:-translate-x-1' : 'hover:translate-x-1'),
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <ActionIcon className="w-5 h-5" style={{ color: 'rgb(55, 65, 81)' }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

