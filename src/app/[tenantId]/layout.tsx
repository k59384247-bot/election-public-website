import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiRequestError } from '@/lib/apiClient';
import { getTenantPublicInfo } from '@/features/tenant/api';
import { TenantProviders } from '@/features/tenant/TenantContext';

async function resolveTenant(tenantId: string) {
  try {
    return await getTenantPublicInfo(tenantId);
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.code === 'TENANT_NOT_FOUND' || error.code === 'INVALID_TENANT')
    ) {
      notFound();
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const tenant = await resolveTenant((await params).tenantId);
  return {
    title: `${tenant.name} Elections — StruktHQ`,
    description: tenant.description ?? `${tenant.name} elections — vote securely online.`,
  };
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await resolveTenant(tenantId);

  return (
    <TenantProviders tenantId={tenantId} tenant={tenant}>
      {children}
    </TenantProviders>
  );
}
