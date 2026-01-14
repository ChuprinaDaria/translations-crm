# Project Refactoring Summary

## Overview
This document describes the refactoring of the project structure to align with domain-driven design principles, moving away from the old "KP/Recipes" structure.

## Changes Made

### 1. New Directory Structure

Created `src/modules/` directory with domain-specific modules:
- `communications/` - Unified Inbox and messaging
- `crm/` - Customer relationships, Kanban, Clients
- `finance/` - Transactions, Invoices
- `analytics/` - Dashboards, Reports, Metrics

Each module follows a consistent structure:
```
module-name/
├── components/    # React components specific to this domain
├── hooks/         # Custom React hooks for this domain
├── api/           # API endpoints and data fetching logic
├── pages/         # Page-level components (routes)
└── index.ts       # Public API exports for the module
```

### 2. Layout Components

Created `src/components/layout/` directory:
- Moved `Sidebar.tsx` → `components/layout/Sidebar.tsx`
- Moved `Header.tsx` → `components/layout/Header.tsx`
- Updated imports in `App.tsx`

### 3. Component Migration

**CRM Module:**
- `Clients.tsx` → `modules/crm/pages/ClientListPage.tsx`
- `ClientDetailsDialog.tsx` → `modules/crm/components/ClientDetailsDialog.tsx`
- `ClientSelectDialog.tsx` → `modules/crm/components/ClientSelectDialog.tsx`

**Analytics Module:**
- `DashboardEnhanced.tsx` → `modules/analytics/pages/DashboardPage.tsx`
- `Dashboard.tsx` → `modules/analytics/components/Dashboard.tsx`
- `KPICard.tsx` → `modules/analytics/components/KPICard.tsx`

### 4. Legacy Code

Created `src/_legacy/` directory for deprecated code:
- `questionnaireSteps/` - Old questionnaire step components
- `templates/` - Old template management components
- `RecipesManagement.tsx` - Old recipe management component

### 5. Import Updates

Updated import paths in:
- `App.tsx` - Updated to use new module paths
- `SalesDepartment.tsx` - Updated ClientDetailsDialog import
- `DashboardPage.tsx` - Fixed UI component imports
- `ClientListPage.tsx` - Fixed UI component imports

## Remaining Work

### Components Still in `src/components/` (to be migrated):
- `AllKP.tsx` → Should move to CRM module
- `CreateKP.tsx` → Should move to CRM module
- `KPArchive.tsx` → Should move to CRM module
- `KPTemplates.tsx` → Should move to CRM module
- `MenuManagement.tsx` → Should move to appropriate module
- `EquipmentManagement.tsx` → Should move to appropriate module
- `ServiceManagement.tsx` → Should move to appropriate module
- `SalesDepartment.tsx` → Should move to CRM module
- `AllQuestionnaires.tsx` → Should move to CRM module
- `ChecklistManagement.tsx` → Should move to CRM module
- `Settings.tsx` → Should move to appropriate module
- `UsersManagement.tsx` → Should move to appropriate module
- `BenefitsManagement.tsx` → Should move to Finance module
- `ProcurementExcel.tsx` → Should move to Finance module
- `ServiceExcel.tsx` → Should move to Finance module
- `EventsCalendar.tsx` → Should move to CRM module

### Module Structure Completion

Each module needs:
1. **API files** - Extract API calls from `lib/api.ts` into module-specific API files
2. **Hooks** - Create custom hooks for module-specific logic
3. **Components** - Complete component migration
4. **Pages** - Create page-level components for routing

## Usage Examples

### Importing from Modules

```typescript
// CRM Module
import { ClientListPage, ClientDetailsDialog } from '@/modules/crm';

// Analytics Module
import { DashboardPage, KPICard } from '@/modules/analytics';

// Layout Components
import { Sidebar, Header } from '@/components/layout';
```

## Notes

- UI components remain in `src/components/ui/` (unchanged)
- Legacy code in `src/_legacy/` should not be imported in new code
- All module exports are defined in `index.ts` files for clean imports
- Import paths use relative paths (`../../components/ui/...`) from modules

## Next Steps

1. Complete component migration to appropriate modules
2. Extract API logic into module-specific API files
3. Create custom hooks for module-specific logic
4. Update routing to use new page components
5. Remove legacy code once migration is complete

