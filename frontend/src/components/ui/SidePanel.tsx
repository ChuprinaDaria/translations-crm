import React from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';
import { Button } from './button';
import { ScrollArea } from './scroll-area';

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Бокова панель що виїжджає справа
 * Працює в парі з SideTabs
 */
export function SidePanel({
  open,
  onClose,
  title,
  children,
  width = 'md',
  className,
}: SidePanelProps) {
  
  const widthClasses = {
    sm: 'w-[320px]',
    md: 'w-[400px]',
    lg: 'w-[540px]',
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full bg-white shadow-xl z-50',
          'transform transition-transform duration-300 ease-out',
          'border-l border-gray-200',
          widthClasses[width],
          open ? 'translate-x-0' : 'translate-x-full',
          className
        )}
        style={{ marginRight: '48px' }} // Відступ для табів (w-12 = 48px)
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        
        {/* Content */}
        <ScrollArea className="h-[calc(100%-57px)]">
          <div className="p-4">
            {children}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

