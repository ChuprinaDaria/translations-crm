# API Module Structure

This directory contains the modular API structure for the application.

## Structure

```
api/
├── config.ts      # API configuration, base URL, query keys
├── client.ts      # API client with fetch wrappers and interceptors
├── token.ts       # JWT token management
└── README.md      # This file
```

## Usage

### Base URL
The API base URL is configured as `/api/v1` in `config.ts`.

### Query Keys
Query keys are organized by module for easy cache invalidation:

```typescript
import { queryKeys } from '@/lib/api';

// Communications
queryKeys.communications.conversations()
queryKeys.communications.conversation(id)

// CRM
queryKeys.crm.orders()
queryKeys.crm.order(id)
queryKeys.crm.orderByStatus(status)

// Finance
queryKeys.finance.transactions()
queryKeys.finance.invoices()

// Analytics
queryKeys.analytics.dashboard()
queryKeys.analytics.metrics()
```

### API Client
The `apiFetch` function handles:
- JWT token injection
- 401 error handling (auto-logout)
- Content-Type detection
- Error parsing

### Token Management
The `tokenManager` handles:
- Token storage/retrieval
- JWT expiration checking
- Event dispatching for auth state changes

## Migration Notes

- All API calls now use `/api/v1` base URL
- JWT handling is centralized in `token.ts`
- Query keys are ready for TanStack Query integration
- 401 errors automatically trigger logout

