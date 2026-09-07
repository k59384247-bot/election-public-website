'use client';

import { useTenant } from '../TenantContext';
import type { TenantPublicInfo } from '@/lib/types';

export function TenantLogo({
  className,
  alt,
  tenant: tenantProp,
}: {
  className: string;
  alt?: string;
  tenant?: TenantPublicInfo;
}) {
  const context = useTenant();
  const tenant = tenantProp ?? context.tenant;
  const accessibleLabel = alt ?? `${tenant.name} logo`;

  if (!tenant.logoUrl) {
    return (
      <span className={`${className} tenant-wordmark`} role="img" aria-label={accessibleLabel}>
        {tenant.name}
      </span>
    );
  }

  return <img className={className} src={tenant.logoUrl} alt={accessibleLabel} />;
}
