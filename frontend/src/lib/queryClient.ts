import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 хвилин - дані вважаються свіжими
      gcTime: 1000 * 60 * 30, // 30 хвилин - кеш зберігається (раніше cacheTime)
      refetchOnWindowFocus: false, // не перезавантажувати при фокусі
      retry: 1,
    },
  },
});

