# Modules Structure

This directory contains domain-driven modules that organize the application by business domain rather than technical concerns.

## Module Structure

Each module follows a consistent structure:

```
module-name/
├── components/    # React components specific to this domain
├── hooks/         # Custom React hooks for this domain
├── api/           # API endpoints and data fetching logic
├── pages/         # Page-level components (routes)
└── index.ts       # Public API exports for the module
```

## Modules

### CRM (`modules/crm/`)
Manages customer relationships, orders, and kanban boards.

**Components:**
- ClientListPage
- ClientDetailsDialog
- ClientSelectDialog

**Future additions:**
- KanbanBoard
- KanbanCard
- OrderDetailPage

### Communications (`modules/communications/`)
Unified inbox and messaging system.

**Future additions:**
- Inbox component
- MessageList
- MessageThread

### Finance (`modules/finance/`)
Transactions, invoices, and financial management.

**Future additions:**
- TransactionList
- InvoiceList
- InvoiceDetail

### Analytics (`modules/analytics/`)
Dashboards, reports, and metrics.

**Components:**
- DashboardPage
- Dashboard
- KPICard

## Usage

Import from modules using their public API:

```typescript
import { ClientListPage, ClientDetailsDialog } from '@/modules/crm';
import { DashboardPage, KPICard } from '@/modules/analytics';
```

## Migration Guide

Components are being gradually moved from `src/components/` to appropriate modules. See `src/_legacy/README.md` for deprecated code.

