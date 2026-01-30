import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Дані вважаються свіжими всю сесію - оновлюються через WebSocket
      gcTime: Infinity, // Кеш зберігається всю активну сесію користувача
      refetchOnWindowFocus: false, // не перезавантажувати при фокусі
      refetchOnMount: false, // не перезавантажувати при монтуванні (використовуємо кеш)
      refetchOnReconnect: false, // не перезавантажувати при переподключенні
      retry: 1,
    },
  },
});

