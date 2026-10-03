// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Election } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  submitPublicRegistration: vi.fn(),
}));

vi.mock('../VotingSessionContext', () => ({
  useVotingSession: () => ({
    submitPublicRegistration: mocks.submitPublicRegistration,
    lockoutNotice: null,
    dismissLockoutNotice: vi.fn(),
  }),
}));

vi.mock('../guards/requireStep', () => ({
  useRequireStep: vi.fn(),
}));

const { PublicRegistrationForm } = await import('./PublicRegistrationForm');

const election = {
  id: 'public-election',
  title: 'Public Election',
  description: '',
  thumbnailUrl: null,
  status: 'voting_open',
  visibility: 'public',
  registrationFields: [
    { id: 'name-field', key: 'name', label: 'Full name', type: 'text', required: false },
    { id: 'email-field', key: 'email', label: 'Email', type: 'email', required: false },
    { id: 'gender-field', key: 'gender', label: 'Gender', type: 'select', required: false, options: ['Female', 'Male'] },
    { id: 'age-field', key: 'age', label: 'Age', type: 'number', required: false },
    { id: 'terms-field', key: 'terms', label: 'Accept terms', type: 'checkbox', required: false },
  ],
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-01-02T00:00:00.000Z',
  votesCast: 0,
  contactEmail: null,
  contactWhatsapp: null,
  contactPhone: null,
  positions: [],
} satisfies Election;

describe('PublicRegistrationForm', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mocks.submitPublicRegistration.mockReset().mockResolvedValue(undefined);
  });

  it('requires every configured field, including a false required flag and checkbox', async () => {
    render(<PublicRegistrationForm election={election} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Enter your full name.')).toBeTruthy();
    expect(screen.getByText('Confirm accept terms.')).toBeTruthy();
    expect(mocks.submitPublicRegistration).not.toHaveBeenCalled();
  });

  it('sends the supplied field answers and matching public email values', async () => {
    render(<PublicRegistrationForm election={election} />);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Example Voter' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'voter@example.com' } });
    fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'Female' } });
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '21' } });
    fireEvent.click(screen.getByLabelText('Accept terms'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(mocks.submitPublicRegistration).toHaveBeenCalledWith(
        'public-election',
        'voter@example.com',
        {
          name: 'Example Voter',
          email: 'voter@example.com',
          gender: 'Female',
          age: 21,
          terms: true,
        }
      );
    });
  });
});
