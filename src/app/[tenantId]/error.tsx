'use client';

import { useEffect } from 'react';
import { TenantLoadError } from '@/features/tenant/components/TenantLoadError';

export default function TenantRouteError({
  error,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[TenantRoute] rendering failed:', error);
  }, [error]);

  return <TenantLoadError />;
}
