import { apiRequest } from '@/lib/apiClient';
import type { TenantPublicInfo } from '@/lib/types';

/** Public tenant configuration used to resolve and brand a tenant route. */
export async function getTenantPublicInfo(tenantId: string): Promise<TenantPublicInfo> {
  const { data } = await apiRequest<TenantPublicInfo>(
    `/v1/tenants/${encodeURIComponent(tenantId)}/public`,
    { cache: 'no-store' }
  );

  return data;
}
