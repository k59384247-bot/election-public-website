/**
 * Throwaway smoke test: confirms apiRequest fails with a typed, catchable
 * NETWORK_ERROR against the placeholder API base URL, instead of hanging
 * or throwing an unhandled exception. Run with `npx tsx src/lib/smoke-test.ts`.
 * Safe to delete once real integration tests exist.
 */

import { apiRequest, ApiRequestError } from './apiClient';

async function main() {
  console.log('NEXT_PUBLIC_API_BASE_URL =', process.env.NEXT_PUBLIC_API_BASE_URL);
  console.log('NEXT_PUBLIC_TENANT_ID =', process.env.NEXT_PUBLIC_TENANT_ID);
  console.log('Calling apiRequest against placeholder base URL...\n');

  const startedAt = Date.now();
  try {
    await apiRequest('/v1/elections/active');
    console.log('UNEXPECTED: request succeeded against a placeholder URL.');
    process.exitCode = 1;
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    if (err instanceof ApiRequestError) {
      console.log(`Caught typed ApiRequestError after ${elapsedMs}ms:`);
      console.log('  code:   ', err.code);
      console.log('  message:', err.message);
      if (err.code === 'NETWORK_ERROR') {
        console.log('\nPASS: failure was a distinguishable, typed NETWORK_ERROR.');
      } else {
        console.log('\nFAIL: expected code NETWORK_ERROR, got', err.code);
        process.exitCode = 1;
      }
    } else {
      console.log('FAIL: threw a non-ApiRequestError value:', err);
      process.exitCode = 1;
    }
  }
}

main();
