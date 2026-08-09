/**
 * Configured React Query client. Not wired into a <QueryClientProvider>
 * yet — that happens when app/layout.tsx is built in a later phase.
 */

import { QueryClient } from '@tanstack/react-query';

const ONE_MINUTE_MS = 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 30_000),
      // Data is considered fresh for a minute, enabling stale-while-revalidate
      // instead of refetching on every mount/focus.
      staleTime: ONE_MINUTE_MS,
      refetchIntervalInBackground: false,
    },
  },
});
