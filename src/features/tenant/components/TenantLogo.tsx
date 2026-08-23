'use client';

import { useTenant } from '../TenantContext';

export function TenantLogo({
  className,
  alt,
}: {
  className: string;
  alt?: string;
}) {
  const { tenant } = useTenant();

  return (
    <img
      className={className}
      src={tenant.logoUrl ?? '/assets/images/amsul-logo.png'}
      alt={alt ?? `${tenant.name} logo`}
    />
  );
}
