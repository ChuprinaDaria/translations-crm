import React from 'react';
import { Plus, Paperclip, FileText, Star } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip';
import { cn } from '../../../components/ui/utils';

interface QuickActionsProps {
  onCreateClient?: () => void;
  onDownloadFiles?: () => void;
  onCreateOrder?: () => void;
  onMarkImportant?: () => void;
  isImportant?: boolean;
  className?: string;
}

/**
 * Floating action buttons над input area
 * Icons: Create Client, Download Files, Create Order, Important
 * Layout: Horizontal row, 40x40 buttons
 */
export function QuickActions({
  onCreateClient,
  onDownloadFiles,
  onCreateOrder,
  onMarkImportant,
  isImportant = false,
  className,
}: QuickActionsProps) {
  const actions = [
    {
      icon: Plus,
      label: 'Створити клієнта',
      onClick: onCreateClient,
      variant: 'default' as const,
    },
    {
      icon: Paperclip,
      label: 'Завантажити файли',
      onClick: onDownloadFiles,
      variant: 'outline' as const,
    },
    {
      icon: FileText,
      label: 'Створити замовлення',
      onClick: onCreateOrder,
      variant: 'outline' as const,
    },
    {
      icon: Star,
      label: isImportant ? 'Прибрати з важливих' : 'Позначити важливим',
      onClick: onMarkImportant,
      variant: isImportant ? 'default' as const : 'outline' as const,
    },
  ].filter((action) => action.onClick);

  if (actions.length === 0) return null;

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm',
          'hover:bg-gray-50 hover:shadow-md transition-all duration-100',
          className
        )}
      >
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Button
                  variant={action.variant}
                  size="sm"
                  className={cn(
                    'h-10 w-10 p-0 shrink-0',
                    action.variant === 'default' && 'bg-[#FF5A00] hover:bg-[#FF5A00]/90 text-white',
                    'active:scale-95 transition-transform duration-100'
                  )}
                  onClick={action.onClick}
                >
                  <Icon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{action.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

