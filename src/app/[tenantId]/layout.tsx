import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiRequestError } from '@/lib/apiClient';
import { getTenantPublicInfo } from '@/features/tenant/api';
import { TenantLoadError } from '@/features/tenant/components/TenantLoadError';
import { TenantProviders } from '@/features/tenant/TenantContext';

async function resolveTenant(tenantId: string) {
  try {
    const tenant = await getTenantPublicInfo(tenantId);
    if (!tenant.name.trim()) {
      throw new Error('Tenant name is unavailable');
    }
    return tenant;
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.code === 'TENANT_NOT_FOUND' || error.code === 'INVALID_TENANT')
    ) {
      notFound();
    }
    console.error('[TenantLayout] tenant configuration unavailable:', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const tenant = await resolveTenant((await params).tenantId);
  if (!tenant) {
    return {
      title: 'Unable to load elections',
      description: 'Election data is temporarily unavailable.',
    };
  }

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

  if (!tenant) {
    return <TenantLoadError />;
  }

  return (
    <TenantProviders tenantId={tenantId} tenant={tenant}>
      {children}
    </TenantProviders>
  );
}
