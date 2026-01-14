# API Layer Refactoring Summary

## Overview
The API layer has been refactored to support modular backend structure with versioned endpoints and organized query keys.

## Changes Made

### 1. Modular API Structure

Created new directory structure:
```
src/lib/api/
├── config.ts      # API configuration, base URL, query keys
├── client.ts      # API client with fetch wrappers and interceptors
├── token.ts       # JWT token management
└── README.md      # Documentation
```

### 2. Base URL Update

**Before:** `/api`
**After:** `/api/v1`

All API requests now use the versioned endpoint `/api/v1`.

### 3. JWT Handling

**Enhanced 401 handling:**
- Automatic token removal on 401 responses
- Custom event dispatch (`auth:token-changed`) for reactive UI updates
- JWT expiration checking with configurable leeway (default: 30 seconds)
- Proper error handling without breaking the call chain

**Token Manager (`token.ts`):**
- `getToken()` - Retrieve token from localStorage
- `setToken(token)` - Save token and dispatch event
- `removeToken()` - Remove token and dispatch logout event
- `isAuthenticated()` - Check token validity and expiration

### 4. Query Keys Factory Pattern

Created `queryKeys` object for TanStack Query integration:

```typescript
import { queryKeys } from '@/lib/api';

// Communications module
queryKeys.communications.all
queryKeys.communications.conversations()
queryKeys.communications.conversation(id)
queryKeys.communications.messages(conversationId)

// CRM module
queryKeys.crm.orders()
queryKeys.crm.order(id)
queryKeys.crm.orderByStatus(status)
queryKeys.crm.clients()
queryKeys.crm.client(id)

// Finance module
queryKeys.finance.transactions()
queryKeys.finance.invoices()
queryKeys.finance.payments()

// Analytics module
queryKeys.analytics.dashboard()
queryKeys.analytics.metrics()
queryKeys.analytics.reports()
```

**Benefits:**
- Type-safe query keys
- Easy cache invalidation (e.g., `queryClient.invalidateQueries(queryKeys.crm.orders())`)
- Hierarchical structure mirrors module organization
- Ready for TanStack Query integration

### 5. API Client (`client.ts`)

**Features:**
- `apiFetch<T>()` - Generic fetch wrapper with:
  - Automatic JWT token injection
  - 401 error handling
  - Content-Type detection (JSON/FormData/Text)
  - Error parsing and throwing
  
- `apiFetchMultipart<T>()` - Specialized for FormData uploads

**Error Handling:**
- Custom `ApiError` class with status, statusText, and data
- Proper error propagation
- 401 responses trigger automatic logout

### 6. Backward Compatibility

The main `api.ts` file now re-exports everything from modular structure:

```typescript
export { API_BASE_URL, getImageUrl, queryKeys } from './api/config';
export { apiFetch, apiFetchMultipart, ApiError } from './api/client';
export { tokenManager } from './api/token';
```

**All existing imports continue to work:**
```typescript
import { tokenManager, authApi, clientsApi } from '@/lib/api';
```

## Migration Guide

### For New Code

Use the modular imports:
```typescript
import { apiFetch } from '@/lib/api/client';
import { queryKeys } from '@/lib/api/config';
import { tokenManager } from '@/lib/api/token';
```

### For TanStack Query

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api';
import { apiFetch } from '@/lib/api/client';

// Query
const { data } = useQuery({
  queryKey: queryKeys.crm.orders(),
  queryFn: () => apiFetch('/orders'),
});

// Mutation with cache invalidation
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: (data) => apiFetch('/orders', { method: 'POST', body: JSON.stringify(data) }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.crm.orders() });
  },
});
```

## Testing

All existing API calls should continue to work. The base URL change from `/api` to `/api/v1` requires backend support for the `/api/v1` prefix.

## Next Steps

1. Update backend to support `/api/v1` endpoints
2. Integrate TanStack Query using the query keys
3. Create module-specific API files in `modules/*/api/` directories
4. Migrate API calls to use module-specific endpoints

