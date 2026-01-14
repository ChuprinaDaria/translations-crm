# Project Structure

## Overview

The project has been refactored to follow domain-driven design principles, organizing code by business domain rather than technical concerns.

## Directory Structure

```
src/
├── modules/              # Domain modules
│   ├── analytics/        # Dashboards, Reports, Metrics
│   ├── communications/   # Unified Inbox, Messaging
│   ├── crm/              # Customer Relationships, Kanban, Clients
│   └── finance/          # Transactions, Invoices
├── components/
│   ├── layout/           # Layout components (Sidebar, Header)
│   ├── ui/               # Generic UI components (shadcn/ui)
│   └── [other]/          # Shared components
├── _legacy/              # Deprecated code (to be removed)
├── hooks/                # Shared hooks
├── lib/                  # Shared libraries (API client)
└── utils/                # Utility functions
```

## Module Structure

Each module follows this structure:

```
module-name/
├── components/    # React components specific to this domain
├── hooks/         # Custom React hooks for this domain
├── api/           # API endpoints and data fetching logic
├── pages/         # Page-level components (routes)
└── index.ts       # Public API exports for the module
```

## Current Module Contents

### CRM Module (`modules/crm/`)
- **Pages:** ClientListPage
- **Components:** ClientDetailsDialog, ClientSelectDialog
- **Future:** KanbanBoard, KanbanCard, OrderDetailPage

### Analytics Module (`modules/analytics/`)
- **Pages:** DashboardPage
- **Components:** Dashboard, KPICard
- **Future:** ReportsPage, Chart components

### Communications Module (`modules/communications/`)
- **Future:** Inbox, MessageList, MessageThread

### Finance Module (`modules/finance/`)
- **Future:** TransactionList, InvoiceList, InvoiceDetail

## Layout Components

Located in `components/layout/`:
- `Sidebar.tsx` - Main navigation sidebar
- `Header.tsx` - Top header with breadcrumbs

## Legacy Code

Deprecated code in `_legacy/`:
- `questionnaireSteps/` - Old questionnaire components
- `templates/` - Old template management
- `RecipesManagement.tsx` - Old recipe management

**Note:** Do not import from `_legacy/` in new code. These will be removed once migration is complete.

## Import Examples

```typescript
// From modules
import { ClientListPage } from '@/modules/crm/pages/ClientListPage';
import { DashboardPage } from '@/modules/analytics/pages/DashboardPage';

// From layout
import { Sidebar, Header } from '@/components/layout';

// From UI components
import { Button, Card } from '@/components/ui/button';
```

## Migration Status

✅ Completed:
- Created module structure
- Moved layout components
- Migrated CRM components (Clients, ClientDetailsDialog, ClientSelectDialog)
- Migrated Analytics components (Dashboard, DashboardPage, KPICard)
- Created legacy folder and moved deprecated code
- Updated import paths

⏳ Remaining:
- Migrate remaining components to appropriate modules
- Extract API logic into module-specific API files
- Create custom hooks for module-specific logic
- Complete module implementations

