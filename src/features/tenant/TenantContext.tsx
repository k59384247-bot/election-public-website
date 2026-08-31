'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { VotingSessionProvider } from '@/features/voting/VotingSessionContext';
import { auth } from '@/lib/firebase';
import type { TenantPublicInfo } from '@/lib/types';
import { buildTenantTheme } from './theme';

interface TenantContextValue {
  tenantId: string;
  tenant: TenantPublicInfo;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProviders({
  tenantId,
  tenant,
  children,
}: {
  tenantId: string;
  tenant: TenantPublicInfo;
  children: ReactNode;
}) {
  // Firebase Auth is shared by all tenants. Clear a voter session when the
  // browser changes tenant so an election-scoped token cannot linger across
  // tenant navigation.
  useEffect(() => {
    void auth.signOut().catch(() => {});
  }, [tenantId]);

  const value = useMemo(() => ({ tenantId, tenant }), [tenantId, tenant]);
  const theme = useMemo(() => buildTenantTheme(tenant.primaryColor), [tenant.primaryColor]);

  return (
    <TenantContext.Provider value={value}>
      <VotingSessionProvider key={tenantId} tenantId={tenantId}>
        <div
          className="tenant-shell"
          style={theme as React.CSSProperties}
        >
          {children}
        </div>
      </VotingSessionProvider>
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a tenant route');
  }
  return context;
}
