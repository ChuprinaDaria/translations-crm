import React from 'react';
import { 
  CreditCard, 
  Package, 
  UserPlus,
  FileText, 
  FolderOpen,
  Menu
} from 'lucide-react';
import { cn } from '../../../components/ui/utils';
import { toast } from 'sonner';

interface QuickActionsSidebarProps {
  isSidebarOpen?: boolean;
  clientId?: string;
  orderId?: string;
  onPaymentClick: () => void;
  onTrackingClick: () => void;
  onClientClick: () => void;
  onOrderClick: () => void;
  onDocumentsClick: () => void;
  onToggleSidebar?: () => void;
}

export function QuickActionsSidebar({
  isSidebarOpen = false,
  clientId,
  orderId,
  onPaymentClick,
  onTrackingClick,
  onClientClick,
  onOrderClick,
  onDocumentsClick,
  onToggleSidebar,
}: QuickActionsSidebarProps) {
  const actions = [
    {
      id: 'sidebar',
      icon: Menu,
      tooltip: 'Відкрити список діалогів',
      onClick: onToggleSidebar || (() => {
        console.log('Toggle sidebar clicked but handler not provided');
      }),
      requiresOrder: false,
      requiresClient: false,
      alwaysVisible: true, // Завжди показуємо кнопку
    },
    {
      id: 'payment',
      icon: CreditCard,
      tooltip: 'Оплата',
      onClick: onPaymentClick,
      requiresOrder: true,
    },
    {
      id: 'tracking',
      icon: Package,
      tooltip: 'Трекінг',
      onClick: onTrackingClick,
      requiresOrder: true,
    },
    {
      id: 'client',
      icon: UserPlus,
      tooltip: clientId ? 'Переглянути клієнта' : 'Створити клієнта',
      onClick: onClientClick,
      requiresOrder: false,
    },
    {
      id: 'order',
      icon: FileText,
      tooltip: 'Створити замовлення',
      onClick: onOrderClick,
      requiresClient: true,
    },
    {
      id: 'documents',
      icon: FolderOpen,
      tooltip: 'Завантажити документи',
      onClick: onDocumentsClick,
    },
  ];

  const handleClick = (action: typeof actions[0]) => {
    if (action.requiresOrder && !orderId) {
      toast.info('Спочатку створіть замовлення');
      return;
    }
    if (action.requiresClient && !clientId) {
      toast.info('Спочатку створіть клієнта');
      return;
    }
    action.onClick();
  };

  return (
    <div className="w-14 h-full bg-white border-l border-gray-200 flex flex-col items-center gap-2 py-3">
      {actions.map((action) => {
        const Icon = action.icon;
        const isSidebarButton = action.id === 'sidebar';
        
        // Кнопка sidebar завжди активна
        const isDisabled = isSidebarButton
          ? false 
          : (action.requiresOrder && !orderId) || (action.requiresClient && !clientId);
        
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => {
              if (isSidebarButton) {
                console.log('Sidebar toggle clicked, handler:', !!onToggleSidebar);
              }
              handleClick(action);
            }}
            title={action.tooltip}
            disabled={!isSidebarButton && isDisabled}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              'transition-all duration-150 ring-1 ring-black/5',
              isSidebarButton
                ? cn(
                    'cursor-pointer hover:scale-105 active:scale-95 shadow-sm border border-gray-300',
                    isSidebarOpen
                      ? 'bg-gray-100'
                      : 'bg-white hover:bg-gray-50'
                  )
                : isDisabled 
                ? 'bg-gray-100 border border-gray-200 cursor-not-allowed opacity-80'
                : 'bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer hover:scale-105 active:scale-95 shadow-sm'
            )}
            style={isSidebarButton ? { zIndex: 10 } : undefined}
          >
            <Icon 
              className="w-5 h-5"
              style={{ color: isDisabled && !isSidebarButton ? '#9ca3af' : '#374151' }}
              strokeWidth={isSidebarButton ? 2.5 : 2} 
            />
          </button>
        );
      })}
    </div>
  );
}
