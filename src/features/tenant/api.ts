import { apiRequest } from '@/lib/apiClient';
import { ApiRequestError } from '@/lib/apiClient';
import type { TenantPublicInfo } from '@/lib/types';

/** Public tenant configuration used to resolve and brand a tenant route. */
export async function getTenantPublicInfo(tenantId: string): Promise<TenantPublicInfo> {
  const { data } = await apiRequest<TenantPublicInfo>(
    `/v1/tenants/${encodeURIComponent(tenantId)}/public`,
    { cache: 'no-store' }
  );

  return data;
}

export function createFallbackTenantPublicInfo(tenantId: string): TenantPublicInfo {
  return {
    id: tenantId,
    tenantId,
    name: 'Election Portal',
    logoUrl: null,
    primaryColor: null,
    description: null,
    organizationType: 'student',
  };
}

function isInvalidTenantError(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    (error.code === 'TENANT_NOT_FOUND' || error.code === 'INVALID_TENANT')
  );
}

/**
 * Resolves public tenant data without making optional presentation config a
 * prerequisite for voting. Invalid tenant identifiers still fail normally.
 */
export async function resolveTenantPublicInfo(
  tenantId: string,
  load: (tenantId: string) => Promise<TenantPublicInfo> = getTenantPublicInfo
): Promise<TenantPublicInfo> {
  try {
    return await load(tenantId);
  } catch (error) {
    if (isInvalidTenantError(error)) throw error;
    return createFallbackTenantPublicInfo(tenantId);
  }
}
