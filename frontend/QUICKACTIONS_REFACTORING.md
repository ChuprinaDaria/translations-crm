# Рефакторинг QuickActionsSidebar

## Проблема

На сторінці `InboxPageEnhanced.tsx` було дублювання правих бокових панелей:
1. **Правильна панель** - `QuickActionsSidebar` всередині `ChatTabsArea` (починається від верху)
2. **Неправильна панель** - `aside` з `SideTabs` (починається на середині сторінці)

## Виконані зміни

### 1. Видалено дублюючу панель

**Файл:** `translations-crm/frontend/src/modules/communications/pages/InboxPageEnhanced.tsx`

- Видалено `aside` з `SideTabs` (рядки 1556-1565)
- Видалено `SidePanel` з контентом для notes та files (рядки 1568-1601)
- Видалено стан `sidePanelTab` та пов'язані обробники
- Видалено непотрібні імпорти: `SideTabs`, `SidePanel`, `InternalNotes`, `AttachmentPreview`, а також іконки з `lucide-react`

### 2. Зроблено QuickActionsSidebar універсальним

**Файл:** `translations-crm/frontend/src/modules/communications/components/QuickActionsSidebar.tsx`

**До:**
```typescript
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
```

**Після:**
```typescript
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
```

### 3. Оновлено ChatTabsArea

**Файл:** `translations-crm/frontend/src/modules/communications/components/ChatTabsArea.tsx`

- Додано `useMemo` для формування масиву `quickActions`
- Actions формуються динамічно на основі стану (activeTabId, clientId, orderId)
- Передача єдиного prop `actions` замість багатьох окремих props

### 4. Додано експорт

**Файл:** `translations-crm/frontend/src/modules/communications/components/index.ts`

```typescript
export { QuickActionsSidebar, type QuickAction } from './QuickActionsSidebar';
```

### 5. Додано документацію

**Файли:**
- `QuickActionsSidebar.README.md` - повна документація з прикладами
- `QuickActionsSidebar.example.tsx` - робочі приклади використання на різних сторінках

## Візуальний результат

### До (баг):
```
┌──────────────────────────────────────────┬────┐
│ [Tab1] [Tab2] [Tab3]                     │    │
├──────────────────────────────────────────┤    │
│ Chat Header                              │    │ ← пусто
├──────────────────────────────────────────┤────│
│                                          │ ≡  │
│ Messages...                              │ 📋 │ ← іконки починаються
│                                          │ 📁 │   тут (зміщені вниз)
│                                          │ 👤 │
├──────────────────────────────────────────┤ 📦 │
│ [Message Input]                          │ 💳 │
└──────────────────────────────────────────┴────┘
```

### Після (фікс):
```
┌──────────────────────────────────────────┬────┐
│ [Tab1] [Tab2] [Tab3]                     │ ≡  │ ← іконки починаються
├──────────────────────────────────────────┤ 📋 │   від самого верху
│ Chat Header                              │ 📁 │
├──────────────────────────────────────────┤ 👤 │
│                                          │ 📄 │
│ Messages...                              │ 📦 │
│                                          │ 💳 │
│                                          │    │
├──────────────────────────────────────────┤    │
│ [Message Input]                          │    │
└──────────────────────────────────────────┴────┘
```

## Використання на інших сторінках

Тепер `QuickActionsSidebar` можна використовувати на будь-якій сторінці:

```tsx
import { QuickActionsSidebar, type QuickAction } from '@/modules/communications/components';
import { Save, Edit, Trash } from 'lucide-react';

// У вашому компоненті
const quickActions = useMemo<QuickAction[]>(() => [
  {
    id: 'save',
    icon: Save,
    tooltip: 'Зберегти',
    onClick: handleSave,
    disabled: !hasChanges,
    disabledMessage: 'Немає змін',
  },
  {
    id: 'edit',
    icon: Edit,
    tooltip: 'Редагувати',
    onClick: handleEdit,
    disabled: !selectedId,
  },
], [hasChanges, selectedId]);

// В JSX
<div className="h-full w-full flex overflow-hidden">
  <div className="flex-1 overflow-auto">
    {/* Ваш контент */}
  </div>
  <div className="flex-shrink-0 h-full">
    <QuickActionsSidebar actions={quickActions} />
  </div>
</div>
```

## Переваги рефакторингу

1. ✅ **Видалено дублювання** - одна панель замість двох
2. ✅ **Універсальність** - можна використовувати на будь-якій сторінці
3. ✅ **Гнучкість** - легко додавати/видаляти actions
4. ✅ **Типізація** - повна TypeScript підтримка
5. ✅ **Документація** - README та приклади
6. ✅ **Чистий код** - менше props, більше гнучкості

## Файли, які були змінені

1. `translations-crm/frontend/src/modules/communications/pages/InboxPageEnhanced.tsx`
2. `translations-crm/frontend/src/modules/communications/components/QuickActionsSidebar.tsx`
3. `translations-crm/frontend/src/modules/communications/components/ChatTabsArea.tsx`
4. `translations-crm/frontend/src/modules/communications/components/index.ts`

## Файли, які були додані

1. `translations-crm/frontend/src/modules/communications/components/QuickActionsSidebar.README.md`
2. `translations-crm/frontend/src/modules/communications/components/QuickActionsSidebar.example.tsx`
3. `translations-crm/frontend/QUICKACTIONS_REFACTORING.md` (цей файл)

