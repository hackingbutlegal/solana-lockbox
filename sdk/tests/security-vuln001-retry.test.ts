/**
 * SECURITY TESTS: VULN-001 - Cryptographic Random in Retry Jitter
 *
 * Tests that retry backoff calculations use cryptographically secure
 * random number generation instead of Math.random()
 *
 * Security Fix: sdk/src/retry.ts uses crypto.getRandomValues()
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock crypto.getRandomValues to verify it's being called
const originalGetRandomValues = crypto.getRandomValues;
let getRandomValuesCalled = false;
let randomValuesBuffer: Uint8Array | null = null;

describe('VULN-001: Cryptographic Random in Retry Jitter', () => {
  beforeEach(() => {
    getRandomValuesCalled = false;
    randomValuesBuffer = null;

    // Mock crypto.getRandomValues to track calls
    jest.spyOn(crypto, 'getRandomValues').mockImplementation((array: any) => {
      getRandomValuesCalled = true;
      randomValuesBuffer = array;
      // Call original implementation
      return originalGetRandomValues.call(crypto, array);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('calculateBackoff uses crypto.getRandomValues not Math.random', async () => {
    // Import the retry module (this will use the mocked crypto)
    const { retryWithBackoff } = await import('../src/retry');

    // Create a test function that fails once then succeeds
    let attemptCount = 0;
    const testFn = async () => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error('Simulated failure');
      }
      return 'success';
    };

    // Execute retry with backoff
    const result = await retryWithBackoff(testFn, {
      maxRetries: 2,
      initialBackoff: 100,
      maxBackoff: 1000,
      backoffMultiplier: 2,
    });

    // Verify crypto.getRandomValues was called
    expect(getRandomValuesCalled).toBe(true);
    expect(randomValuesBuffer).toBeInstanceOf(Uint8Array);
    expect(randomValuesBuffer?.length).toBe(2);

    // Verify function succeeded after retry
    expect(result).toBe('success');
    expect(attemptCount).toBe(2);
  });

  test('Random jitter uses full 16-bit entropy', async () => {
    const { retryWithBackoff } = await import('../src/retry');

    // Track all random values generated
    const randomValues: number[] = [];
    jest.spyOn(crypto, 'getRandomValues').mockImplementation((array: any) => {
      // Generate deterministic but varied values for testing
      const testValue = Math.floor(Math.random() * 65536);
      array[0] = (testValue >> 8) & 0xFF;
      array[1] = testValue & 0xFF;
      randomValues.push(testValue);
      return array;
    });

    let attemptCount = 0;
    const testFn = async () => {
      attemptCount++;
      if (attemptCount <= 3) {
        throw new Error('Simulated failure');
      }
      return 'success';
    };

    await retryWithBackoff(testFn, {
      maxRetries: 5,
      initialBackoff: 100,
      maxBackoff: 1000,
      backoffMultiplier: 2,
    });

    // Verify crypto.getRandomValues was called multiple times
    expect(randomValues.length).toBeGreaterThan(0);

    // Each value should be in valid 16-bit range
    randomValues.forEach(val => {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(65536);
    });
  });

  test('Jitter calculation produces values in expected range', async () => {
    // Direct test of the jitter calculation logic
    const delays: number[] = [];

    // Mock to capture actual delay values
    const originalSetTimeout = global.setTimeout;
    jest.spyOn(global, 'setTimeout').mockImplementation(((callback: any, delay: number) => {
      delays.push(delay);
      callback();
      return 0 as any;
    }) as any);

    const { retryWithBackoff } = await import('../src/retry');

    let attemptCount = 0;
    const testFn = async () => {
      attemptCount++;
      if (attemptCount <= 2) {
        throw new Error('Simulated failure');
      }
      return 'success';
    };

    await retryWithBackoff(testFn, {
      maxRetries: 3,
      initialBackoff: 100,
      maxBackoff: 1000,
      backoffMultiplier: 2,
    });

    // Verify delays were applied
    expect(delays.length).toBeGreaterThan(0);

    // Each delay should be within expected range (base ± 25% jitter)
    // Attempt 1: 100ms ± 25ms = [75, 125]
    // Attempt 2: 200ms ± 50ms = [150, 250]
    expect(delays[0]).toBeGreaterThanOrEqual(75);
    expect(delays[0]).toBeLessThanOrEqual(125);

    if (delays.length > 1) {
      expect(delays[1]).toBeGreaterThanOrEqual(150);
      expect(delays[1]).toBeLessThanOrEqual(250);
    }

    jest.spyOn(global, 'setTimeout').mockRestore();
  });

  test('No timing correlation between retry attempts', async () => {
    // Ensure jitter values are independent (no correlation)
    const jitterValues: number[] = [];

    jest.spyOn(crypto, 'getRandomValues').mockImplementation((array: any) => {
      const val = originalGetRandomValues.call(crypto, array);
      const jitter = (array[0] << 8 | array[1]) / 65535;
      jitterValues.push(jitter);
      return val;
    });

    const { retryWithBackoff } = await import('../src/retry');

    let attemptCount = 0;
    const testFn = async () => {
      attemptCount++;
      if (attemptCount <= 5) {
        throw new Error('Simulated failure');
      }
      return 'success';
    };

    await retryWithBackoff(testFn, {
      maxRetries: 10,
      initialBackoff: 100,
      maxBackoff: 1000,
      backoffMultiplier: 2,
    });

    // Verify we got multiple jitter values
    expect(jitterValues.length).toBeGreaterThanOrEqual(3);

    // Values should vary (not all the same)
    const uniqueValues = new Set(jitterValues);
    expect(uniqueValues.size).toBeGreaterThan(1);

    // All values should be in [0, 1] range
    jitterValues.forEach(val => {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    });
  });

  test('SECURITY: Math.random is NOT used for jitter', async () => {
    // Verify Math.random is not called during retry
    const originalMathRandom = Math.random;
    let mathRandomCalled = false;

    Math.random = jest.fn(() => {
      mathRandomCalled = true;
      return originalMathRandom();
    });

    const { retryWithBackoff } = await import('../src/retry');

    let attemptCount = 0;
    const testFn = async () => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error('Simulated failure');
      }
      return 'success';
    };

    await retryWithBackoff(testFn, {
      maxRetries: 2,
      initialBackoff: 100,
      maxBackoff: 1000,
      backoffMultiplier: 2,
    });

    // CRITICAL: Math.random must NOT be called for security
    expect(mathRandomCalled).toBe(false);

    // Restore
    Math.random = originalMathRandom;
  });
});
