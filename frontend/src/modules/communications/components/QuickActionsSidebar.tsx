import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../components/ui/utils';
import { toast } from 'sonner';

export interface QuickAction {
  id: string;
  icon: LucideIcon;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  isActive?: boolean;
  disabledMessage?: string;
}

interface QuickActionsSidebarProps {
  actions: QuickAction[];
}

export function QuickActionsSidebar({
  actions,
}: QuickActionsSidebarProps) {
  const handleClick = (action: QuickAction) => {
    if (action.disabled) {
      if (action.disabledMessage) {
        toast.info(action.disabledMessage);
      }
      return;
    }
    action.onClick();
  };

  return (
    <div className="w-14 h-full bg-white border-l border-gray-200 flex flex-col items-center gap-2 py-3">
      {actions.map((action) => {
        const Icon = action.icon;
        const isDisabled = action.disabled;
        const isActive = action.isActive;
        
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => handleClick(action)}
            title={action.tooltip}
            disabled={isDisabled}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              'transition-all duration-150 ring-1 ring-black/5',
              isActive
                ? 'bg-gray-100 border border-gray-300 cursor-pointer hover:scale-105 active:scale-95 shadow-sm'
                : isDisabled 
                ? 'bg-gray-100 border border-gray-200 cursor-not-allowed opacity-80'
                : 'bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer hover:scale-105 active:scale-95 shadow-sm'
            )}
          >
            <Icon 
              className="w-5 h-5"
              style={{ color: isDisabled ? '#9ca3af' : '#374151' }}
              strokeWidth={isActive ? 2.5 : 2} 
            />
          </button>
        );
      })}
    </div>
  );
}
