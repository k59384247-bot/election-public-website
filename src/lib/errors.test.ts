import { describe, expect, it } from 'vitest';
import { getErrorDescriptor, NETWORK_ERROR_CODE } from './errors';

describe('getErrorDescriptor', () => {
  it('prompts the voter to resend after a network error while verifying an OTP', () => {
    expect(getErrorDescriptor(NETWORK_ERROR_CODE, 'otp_verification')).toMatchObject({
      userMessage:
        'We could not reach the server. Check your connection and click Resend Code to request a new verification code.',
      recoveryAction: 'show_resend',
    });
  });

  it('keeps the default network recovery message outside OTP verification', () => {
    expect(getErrorDescriptor(NETWORK_ERROR_CODE)).toMatchObject({
      userMessage: 'We could not reach the server. Check your connection and try again.',
      recoveryAction: 'retry',
    });
  });
});
