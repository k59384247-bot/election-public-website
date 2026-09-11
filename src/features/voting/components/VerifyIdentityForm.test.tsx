// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantPublicInfo } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  tenant: null as TenantPublicInfo | null,
  submitIdentity: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ electionId: 'election-1' }),
}));

vi.mock('../VotingSessionContext', () => ({
  useVotingSession: () => ({
    submitIdentity: mocks.submitIdentity,
    lockoutNotice: null,
    dismissLockoutNotice: vi.fn(),
  }),
}));

vi.mock('../guards/requireStep', () => ({
  useRequireStep: vi.fn(),
}));

vi.mock('@/features/tenant/TenantContext', () => ({
  useTenant: () => ({ tenantId: 'tenant-a', tenant: mocks.tenant }),
}));

const { VerifyIdentityForm } = await import('./VerifyIdentityForm');

function tenant(organizationType?: TenantPublicInfo['organizationType']): TenantPublicInfo {
  return {
    id: 'tenant-id',
    tenantId: 'tenant-a',
    name: 'Tenant A',
    logoUrl: null,
    primaryColor: null,
    description: null,
    organizationType,
  };
}

describe('VerifyIdentityForm terminology', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.submitIdentity.mockReset().mockResolvedValue(undefined);
    mocks.tenant = tenant('student');
  });

  it('shows Matric Number and submits the existing identity flow for students', async () => {
    render(<VerifyIdentityForm />);

    const identifier = screen.getByLabelText('Matric Number');
    fireEvent.change(identifier, { target: { value: '123456789' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'voter@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(mocks.submitIdentity).toHaveBeenCalledWith(
        'election-1',
        '123456789',
        'voter@example.com'
      );
    });
  });

  it('allows matric numbers containing letters and slashes on mobile keyboards', () => {
    render(<VerifyIdentityForm />);

    const identifier = screen.getByLabelText('Matric Number');
    expect(identifier.getAttribute('type')).toBe('text');
    expect(identifier.getAttribute('inputmode')).toBe('text');

    fireEvent.change(identifier, { target: { value: 'CSC/2024/001' } });
    expect((identifier as HTMLInputElement).value).toBe('CSC/2024/001');
  });

  it('shows Voter ID Number for general organizations', () => {
    mocks.tenant = tenant('general');

    render(<VerifyIdentityForm />);

    expect(screen.getByLabelText('Voter ID Number')).toBeTruthy();
    expect(screen.queryByLabelText('Matric Number')).toBeNull();
    expect(screen.getAllByText(/voter id number/i)).toHaveLength(2);
  });

  it('keeps legacy student terminology when organizationType is missing', () => {
    mocks.tenant = tenant(undefined);

    render(<VerifyIdentityForm />);

    expect(screen.getByLabelText('Matric Number')).toBeTruthy();
  });
});
