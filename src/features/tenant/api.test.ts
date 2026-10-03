import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '@/lib/apiClient';
import { createFallbackTenantPublicInfo, resolveTenantPublicInfo } from './api';

describe('public tenant configuration', () => {
  it('keeps organizationType when the public endpoint returns it', async () => {
    const tenant = await resolveTenantPublicInfo('general-tenant', async () => ({
      id: 'tenant-id',
      tenantId: 'general-tenant',
      name: 'General Organization',
      logoUrl: null,
      primaryColor: null,
      description: null,
      organizationType: 'general',
    }));

    expect(tenant.organizationType).toBe('general');
  });

  it('keeps a supported heading font from the public tenant response', async () => {
    const tenant = await resolveTenantPublicInfo('space-tenant', async () => ({
      id: 'tenant-id',
      tenantId: 'space-tenant',
      name: 'Space Organization',
      logoUrl: null,
      primaryColor: null,
      description: null,
      headingFont: 'space-grotesk',
    }));

    expect(tenant.headingFont).toBe('space-grotesk');
  });

  it('falls back to student configuration when loading fails', async () => {
    const tenant = await resolveTenantPublicInfo('tenant-a', async () => {
      throw new ApiRequestError('INTERNAL', 'Configuration unavailable');
    });

    expect(tenant).toEqual(createFallbackTenantPublicInfo('tenant-a'));
    expect(tenant.name).toBe('Election Portal');
    expect(tenant.headingFont).toBe('georgia');
    expect(tenant.organizationType).toBe('student');
  });

  it('still lets invalid tenants reach the existing not-found handling', async () => {
    const error = new ApiRequestError('TENANT_NOT_FOUND', 'Tenant not found');

    await expect(
      resolveTenantPublicInfo('missing-tenant', async () => {
        throw error;
      })
    ).rejects.toBe(error);
  });
});
