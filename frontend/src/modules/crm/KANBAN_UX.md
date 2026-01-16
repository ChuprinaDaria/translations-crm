# Kanban Board - Fluid UX Implementation

## Overview
Перероблено CRM Kanban Board з використанням сучасних технологій для досягнення "Fluid UX" як в Trello чи Linear.

## Технології

### Встановлені бібліотеки:
- `@dnd-kit/core` - основа для drag-and-drop
- `@dnd-kit/sortable` - сортування елементів
- `@dnd-kit/utilities` - утиліти для трансформацій
- `framer-motion` - плавні анімації та переходи

## Ключові особливості

### 1. Optimistic UI
- Миттєве оновлення інтерфейсу при переміщенні картки
- Автоматичний rollback при помилці API
- Візуальна індикація процесу оновлення

### 2. DragOverlay
- Картка з ротацією (<3deg) та тінню під час перетягування
- Плавна анімація появи/зникнення
- Відстеження курсора миші

### 3. Placeholder
- Показ місця скидання картки
- Підсвічування колонки при наведенні
- Порожній placeholder для порожніх колонок

### 4. Плавні анімації
- Spring-анімації для природного руху
- Layout animations для автоматичного переміщення
- AnimatePresence для появи/зникнення карток

### 5. Haptic Feedback
- Вібрація при успішному переміщенні (якщо підтримується)
- Візуальний фідбек через анімації

## Структура компонентів

### `KanbanCard.tsx`
- `KanbanCard` - базова картка з усіма стилями
- `SortableKanbanCard` - draggable версія з `@dnd-kit/sortable`
- Підтримка `isOverlay` для DragOverlay

### `KanbanColumn.tsx`
- Droppable колонка з `useDroppable`
- Незалежний скрол для кожної колонки
- AnimatePresence для плавних переходів

### `BoardPage.tsx`
- DndContext з конфігурацією sensors
- Optimistic UI з rollback
- API інтеграція для оновлення статусу

## API Integration

```typescript
PATCH /api/v1/crm/orders/{orderId}
Body: { status: "do_wykonania" | "do_poswiadczenia" | ... }
```

## Статуси замовлень

- `DO_WYKONANIA` - До виконання
- `DO_POSWIADCZENIA` - До підтвердження  
- `DO_WYDANIA` - До видачі
- `USTNE` - Усне
- `CLOSED` - Закрито

## Стилізація

- Колонки: `bg-muted/50` з незалежним скролом
- Картки: `hover:border-orange-500/50` при наведенні
- Підсвічування: `bg-orange-50/50` при перетягуванні над колонкою
- Бордери: кольорові залежно від дедлайну (червоний = просрочено/сьогодні)

## Відмінності від старої версії

1. ✅ Немає "стрибання" карток при перетягуванні
2. ✅ Плавні переходи між позиціями
3. ✅ Миттєве оновлення UI (Optimistic UI)
4. ✅ Візуальний фідбек через DragOverlay
5. ✅ Автоматичний rollback при помилках
6. ✅ Haptic feedback для кращого UX

