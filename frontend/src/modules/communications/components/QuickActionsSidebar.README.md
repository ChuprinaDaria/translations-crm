# QuickActionsSidebar - Універсальний компонент бокової панелі

## Опис

`QuickActionsSidebar` - це універсальний компонент, який відображає вертикальну панель з іконками дій праворуч від основного контенту. Компонент може бути використаний на будь-якій сторінці з різними наборами дій.

## Візуальний результат

```
┌──────────────────────────────────────────┬────┐
│ [Tab1] [Tab2] [Tab3]                     │ ≡  │ ← іконки починаються
├──────────────────────────────────────────┤ 💳 │   від самого верху
│ Chat Header                              │ 📦 │
├──────────────────────────────────────────┤ 👤 │
│                                          │ 📄 │
│ Messages...                              │ 📁 │
│                                          │    │
│                                          │    │
├──────────────────────────────────────────┤    │
│ [Message Input]                          │    │
└──────────────────────────────────────────┴────┘
```

## API

### Типи

```typescript
export interface QuickAction {
  id: string;                    // Унікальний ідентифікатор
  icon: LucideIcon;              // Іконка з lucide-react
  tooltip: string;               // Текст підказки при hover
  onClick: () => void;           // Обробник кліку
  disabled?: boolean;            // Чи кнопка вимкнена
  isActive?: boolean;            // Чи кнопка в активному стані
  disabledMessage?: string;      // Повідомлення при кліку на disabled кнопку
}

interface QuickActionsSidebarProps {
  actions: QuickAction[];        // Масив дій для відображення
}
```

### Props

- **actions** (required): Масив об'єктів `QuickAction` для відображення

## Використання

### Базове використання

```tsx
import { QuickActionsSidebar, type QuickAction } from './QuickActionsSidebar';
import { Save, Trash } from 'lucide-react';

const actions: QuickAction[] = [
  {
    id: 'save',
    icon: Save,
    tooltip: 'Зберегти',
    onClick: () => console.log('Saving...'),
  },
  {
    id: 'delete',
    icon: Trash,
    tooltip: 'Видалити',
    onClick: () => console.log('Deleting...'),
  },
];

<QuickActionsSidebar actions={actions} />
```

### Використання з disabled станом

```tsx
const actions: QuickAction[] = [
  {
    id: 'save',
    icon: Save,
    tooltip: 'Зберегти',
    onClick: handleSave,
    disabled: !hasChanges,
    disabledMessage: 'Немає змін для збереження',
  },
];
```

### Використання з активним станом (для toggle кнопок)

```tsx
const [isSidebarOpen, setIsSidebarOpen] = useState(false);

const actions: QuickAction[] = [
  {
    id: 'sidebar',
    icon: Menu,
    tooltip: 'Відкрити список',
    onClick: () => setIsSidebarOpen(!isSidebarOpen),
    isActive: isSidebarOpen,
  },
];
```

### Використання з useMemo (рекомендовано)

```tsx
const quickActions = useMemo<QuickAction[]>(() => [
  {
    id: 'save',
    icon: Save,
    tooltip: 'Зберегти',
    onClick: handleSave,
    disabled: !hasChanges,
  },
], [hasChanges, handleSave]);

<QuickActionsSidebar actions={quickActions} />
```

## Layout

Компонент завжди повинен бути обгорнутий в flex контейнер:

```tsx
<div className="h-full w-full flex overflow-hidden">
  {/* Main content */}
  <div className="flex-1 overflow-auto">
    {/* Ваш контент тут */}
  </div>
  
  {/* QuickActionsSidebar на повну висоту справа */}
  <div className="flex-shrink-0 h-full">
    <QuickActionsSidebar actions={quickActions} />
  </div>
</div>
```

## Приклади використання на різних сторінках

### Inbox Page (Комунікації)

```tsx
const quickActions = useMemo<QuickAction[]>(() => [
  {
    id: 'sidebar',
    icon: Menu,
    tooltip: 'Відкрити список діалогів',
    onClick: () => setIsSidebarOpen(!isSidebarOpen),
    isActive: isSidebarOpen,
  },
  {
    id: 'payment',
    icon: CreditCard,
    tooltip: 'Оплата',
    onClick: handlePayment,
    disabled: !orderId,
    disabledMessage: 'Najpierw utwórz zlecenie',
  },
  {
    id: 'tracking',
    icon: Package,
    tooltip: 'Трекінг',
    onClick: handleTracking,
    disabled: !orderId,
  },
], [isSidebarOpen, orderId]);
```

### Orders Page (CRM)

```tsx
const quickActions = useMemo<QuickAction[]>(() => [
  {
    id: 'add',
    icon: Plus,
    tooltip: 'Створити нове замовлення',
    onClick: handleCreateOrder,
  },
  {
    id: 'edit',
    icon: Edit,
    tooltip: 'Редагувати замовлення',
    onClick: handleEditOrder,
    disabled: !selectedOrderId,
  },
], [selectedOrderId]);
```

### Clients Page

```tsx
const quickActions = useMemo<QuickAction[]>(() => [
  {
    id: 'add',
    icon: Plus,
    tooltip: 'Додати нового клієнта',
    onClick: handleAddClient,
  },
  {
    id: 'edit',
    icon: Edit,
    tooltip: 'Редагувати клієнта',
    onClick: handleEditClient,
    disabled: !selectedClientId,
  },
], [selectedClientId]);
```

## Важливі моменти

1. **Завжди використовуйте `useMemo`** для масиву actions, щоб уникнути зайвих ре-рендерів
2. **`disabled`** - контролює чи кнопка активна
3. **`isActive`** - показує чи кнопка в активному стані (для toggle кнопок)
4. **`disabledMessage`** - показується користувачу при кліку на disabled кнопку через toast
5. **Layout** - завжди використовуйте flex контейнер з `h-full` та розміщуйте sidebar з `flex-shrink-0`
6. **Ширина** - sidebar має фіксовану ширину 56px (14 * 4px tailwind)
7. **Іконки** - використовуйте іконки з `lucide-react`

## Стилізація

Компонент використовує наступні стилі:
- **Звичайна кнопка**: біла з тінню, hover ефект, scale анімація
- **Disabled кнопка**: сіра, без hover ефекту, непрозора
- **Active кнопка**: сірий фон, жирніша іконка

Всі стилі можуть бути налаштовані через Tailwind CSS класи.

