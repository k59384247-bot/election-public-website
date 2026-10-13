'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTenant } from '@/features/tenant/TenantContext';
import { TenantLogo } from '@/features/tenant/components/TenantLogo';

/**
 * Shared chrome for the ballot/review/submitting/receipt screens (screens
 * 4-8): nav + the `.vote__main` content column. Distinct from
 * VoteFlowLayout (screens 2-3), which uses the two-column `.verify` shell —
 * screens-html gives the ballot flow its own single-column `.vote` page
 * shell instead. Mounted once by the vote route for whichever step is
 * active, so nav never remounts between ballot -> review -> submitting ->
 * receipt.
 */
export function VotePageShell({
  children,
  mobileCenteredLogo = false,
  className = '',
}: {
  children: ReactNode;
  mobileCenteredLogo?: boolean;
  className?: string;
}) {
  const { tenantId, tenant } = useTenant();
  return (
    <div className={`vote${mobileCenteredLogo ? ' vote--mobile-centered-logo' : ''}${className ? ` ${className}` : ''}`}>
      <header>
        <nav className="navbar" aria-label="Primary">
          <Link className="navbar__brand" href={`/${tenantId}`} aria-label={`${tenant.name} home`}>
            <TenantLogo className="navbar__logo" alt={`${tenant.name} logo`} />
          </Link>
        </nav>
      </header>

      <main className="vote__main">{children}</main>
    </div>
  );
}
