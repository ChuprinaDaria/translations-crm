/**
 * Приклад використання QuickActionsSidebar на різних сторінках
 * 
 * QuickActionsSidebar - це універсальний компонент, який може бути
 * використаний на будь-якій сторінці з різними actions.
 */

import React, { useMemo } from 'react';
import { 
  Menu,
  Save,
  Trash,
  Plus,
  Edit,
  Settings,
} from 'lucide-react';
import { QuickActionsSidebar, type QuickAction } from './QuickActionsSidebar';

/**
 * Приклад 1: Використання на сторінці CRM (Orders Page)
 */
export function OrdersPageExample() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  const quickActions = useMemo<QuickAction[]>(() => [
    {
      id: 'sidebar',
      icon: Menu,
      tooltip: 'Відкрити список замовлень',
      onClick: () => setIsSidebarOpen(!isSidebarOpen),
      disabled: false,
      isActive: isSidebarOpen,
    },
    {
      id: 'save',
      icon: Save,
      tooltip: 'Зберегти зміни',
      onClick: () => console.log('Saving order...'),
      disabled: !hasUnsavedChanges,
      disabledMessage: 'Немає змін для збереження',
    },
    {
      id: 'add',
      icon: Plus,
      tooltip: 'Створити нове замовлення',
      onClick: () => console.log('Creating new order...'),
      disabled: false,
    },
    {
      id: 'edit',
      icon: Edit,
      tooltip: 'Редагувати замовлення',
      onClick: () => console.log('Editing order...'),
      disabled: !selectedOrderId,
      disabledMessage: 'Виберіть замовлення',
    },
    {
      id: 'delete',
      icon: Trash,
      tooltip: 'Видалити замовлення',
      onClick: () => console.log('Deleting order...'),
      disabled: !selectedOrderId,
      disabledMessage: 'Виберіть замовлення',
    },
  ], [isSidebarOpen, selectedOrderId, hasUnsavedChanges]);

  return (
    <div className="h-full w-full flex overflow-hidden">
      <div className="flex-1 overflow-auto">
        {/* Main content here */}
        <h1>Orders Page</h1>
      </div>
      
      {/* QuickActionsSidebar на повну висоту справа */}
      <div className="flex-shrink-0 h-full">
        <QuickActionsSidebar actions={quickActions} />
      </div>
    </div>
  );
}

/**
 * Приклад 2: Використання на сторінці Clients
 */
export function ClientsPageExample() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [selectedClientId, setSelectedClientId] = React.useState<string | null>(null);

  const quickActions = useMemo<QuickAction[]>(() => [
    {
      id: 'sidebar',
      icon: Menu,
      tooltip: 'Відкрити список клієнтів',
      onClick: () => setIsSidebarOpen(!isSidebarOpen),
      disabled: false,
      isActive: isSidebarOpen,
    },
    {
      id: 'add',
      icon: Plus,
      tooltip: 'Додати нового клієнта',
      onClick: () => console.log('Adding new client...'),
      disabled: false,
    },
    {
      id: 'edit',
      icon: Edit,
      tooltip: 'Редагувати клієнта',
      onClick: () => console.log('Editing client...'),
      disabled: !selectedClientId,
      disabledMessage: 'Виберіть клієнта',
    },
    {
      id: 'settings',
      icon: Settings,
      tooltip: 'Налаштування клієнта',
      onClick: () => console.log('Opening client settings...'),
      disabled: !selectedClientId,
      disabledMessage: 'Виберіть клієнта',
    },
  ], [isSidebarOpen, selectedClientId]);

  return (
    <div className="h-full w-full flex overflow-hidden">
      <div className="flex-1 overflow-auto">
        {/* Main content here */}
        <h1>Clients Page</h1>
      </div>
      
      {/* QuickActionsSidebar на повну висоту справа */}
      <div className="flex-shrink-0 h-full">
        <QuickActionsSidebar actions={quickActions} />
      </div>
    </div>
  );
}

/**
 * Приклад 3: Мінімальне використання без sidebar toggle
 */
export function MinimalExample() {
  const quickActions = useMemo<QuickAction[]>(() => [
    {
      id: 'save',
      icon: Save,
      tooltip: 'Зберегти',
      onClick: () => console.log('Saving...'),
      disabled: false,
    },
    {
      id: 'delete',
      icon: Trash,
      tooltip: 'Видалити',
      onClick: () => console.log('Deleting...'),
      disabled: false,
    },
  ], []);

  return (
    <div className="h-full w-full flex overflow-hidden">
      <div className="flex-1 overflow-auto">
        {/* Main content here */}
        <h1>Simple Page</h1>
      </div>
      
      <div className="flex-shrink-0 h-full">
        <QuickActionsSidebar actions={quickActions} />
      </div>
    </div>
  );
}

/**
 * Важливі моменти при використанні QuickActionsSidebar:
 * 
 * 1. Завжди використовуйте useMemo для actions, щоб уникнути зайвих ре-рендерів
 * 2. Властивість `disabled` контролює чи кнопка активна
 * 3. Властивість `isActive` показує чи кнопка в активному стані (напр. для sidebar toggle)
 * 4. `disabledMessage` показується користувачу при кліку на disabled кнопку
 * 5. Завжди розміщуйте QuickActionsSidebar в flex контейнері з h-full
 * 6. Використовуйте flex-shrink-0 для sidebar, щоб він не зменшувався
 */

