# Communications Module - Unified Inbox

## 📐 Responsive Breakpoints

```typescript
export const breakpoints = {
  mobile: '640px',    // Sidebar стає drawer
  tablet: '1024px',   // Context panel toggle
  desktop: '1280px',  // Full 3-column
}
```

### Mobile (<640px)
- Single column layout
- Sidebar як drawer (hamburger menu)
- Context panel як modal
- Messages full width

### Tablet (640-1024px)
- Sidebar + Chat area
- Context panel як toggle sidebar

### Desktop (>1024px)
- Full 3-column layout
- Context panel опціонально

## 🏗️ Component Structure

### Layout Components
- `CommunicationsLayout` - Main 3-column layout with responsive behavior
- `ConversationsSidebar` - Left sidebar with filters and conversation list
- `ChatArea` - Main chat area with messages
- `ContextPanel` - Right sidebar with client info, files, history

### UI Components
- `ConversationItem` - Single conversation in list
- `MessageBubble` - Message display component
- `MessageInput` - Message input with attachments
- `AttachmentPreview` - File attachment preview
- `PlatformIcon` - Platform icon with color
- `SourceBadge` - Platform badge
- `UnreadBadge` - Unread count badge
- `QuickActions` - Floating action buttons

### Utility Components
- `ErrorBoundary` - Error handling
- `EmptyState` - Empty states
- `SkeletonLoader` - Loading skeletons

## 🛠️ Utilities

### Format Timestamp
```typescript
import { formatTimestamp, formatFullDate, formatTime } from '../utils';

formatTimestamp('2024-01-15T10:30:00Z'); // "5 хв тому"
formatFullDate('2024-01-15T10:30:00Z'); // "15 січня 2024, 10:30"
formatTime('2024-01-15T10:30:00Z'); // "10:30"
```

### Constants
```typescript
import { MAX_MESSAGE_LENGTH, PLATFORM_NAMES } from '../utils';

MAX_MESSAGE_LENGTH // 4000
MAX_ATTACHMENT_SIZE // 25 MB
PLATFORM_NAMES.telegram // "Telegram"
```

## ✅ Accessibility Features

- ARIA labels на всіх інтерактивних елементах
- Keyboard navigation (Tab, Enter, Escape)
- Screen reader support
- Focus management
- Semantic HTML (header, main, aside, nav)

## 🎨 Design Tokens

Всі кольори, spacing, typography визначені в `src/design-tokens.ts`:
- Platform colors (telegram, whatsapp, email, facebook)
- Gray scale
- Status colors (success, warning, error, info)
- Spacing scale
- Typography scale

## 📝 Naming Conventions

- **Components**: PascalCase (`MessageBubble.tsx`)
- **Utilities**: camelCase (`formatTimestamp.ts`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_MESSAGE_LENGTH`)
- **CSS classes**: kebab-case (`message-bubble`)

## 🚀 Usage

```tsx
import { InboxPageEnhanced } from './pages/InboxPageEnhanced';
import { CommunicationsErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <CommunicationsErrorBoundary>
      <InboxPageEnhanced />
    </CommunicationsErrorBoundary>
  );
}
```

## 🎬 Animations

Анімації визначені в `styles/animations.css`:
- Shimmer для skeleton loaders
- Fade in (150ms)
- Slide in left/right (200ms)
- Bounce для нових повідомлень
- Scale down для кнопок
- Checkmark animation

## 📱 Mobile Features

- Drawer для sidebar (Sheet component)
- Modal для context panel (Dialog component)
- Touch-friendly buttons (min 44x44px)
- Swipe gestures (optional)

## 🔒 Error Handling

- Error Boundary для catch помилок
- Graceful fallbacks
- Error messages для користувача
- Console logging для розробки

## 📦 Empty States

Predefined empty states:
- `EmptyStates.NoConversations`
- `EmptyStates.NoMessages`
- `EmptyStates.NoFiles`
- `EmptyStates.NoClient`
- `EmptyStates.NoOrders`
- `EmptyStates.SearchEmpty(query)`

