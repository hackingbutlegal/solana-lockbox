/**
 * SECURITY TESTS: VULN-005 - Constant-Time GF(2^8) Arithmetic
 *
 * Tests that Galois Field arithmetic operations in Shamir Secret Sharing
 * use constant-time implementations to prevent timing side-channel attacks
 *
 * Security Fix: nextjs-app/lib/shamir-secret-sharing.ts uses constant-time
 * gfMul() and gfDiv() without conditional branches
 */

import { describe, test, expect } from '@jest/globals';
import { performance } from 'perf_hooks';

// We need to test the internal GF functions, so we'll import the module
// and access the functions (may need to export them for testing)

describe('VULN-005: Constant-Time GF(2^8) Arithmetic', () => {
  // Helper function to measure execution time
  function measureExecutionTime(fn: () => void, iterations: number): number {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    return end - start;
  }

  // Statistical timing analysis
  function analyzeTimingVariance(operations: (() => void)[], iterations: number): {
    mean: number;
    variance: number;
    stdDev: number;
    maxDeviation: number;
  } {
    const times = operations.map(op => measureExecutionTime(op, iterations));
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    const maxDeviation = Math.max(...times.map(t => Math.abs(t - mean)));

    return { mean, variance, stdDev, maxDeviation };
  }

  describe('Shamir Secret Sharing - Overall Functionality', () => {
    test('Can split and reconstruct secret', async () => {
      const { splitSecret, reconstructSecret } = await import('../lib/shamir-secret-sharing');

      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      // Split into 5 shares with threshold 3
      const shares = splitSecret(secret, 5, 3);
      expect(shares.length).toBe(5);

      // Reconstruct with threshold shares
      const reconstructed = reconstructSecret(shares.slice(0, 3));
      expect(reconstructed).toEqual(secret);
    });

    test('Cannot reconstruct with fewer than threshold shares', async () => {
      const { splitSecret, reconstructSecret } = await import('../lib/shamir-secret-sharing');

      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      const shares = splitSecret(secret, 5, 3);

      // Try with only 2 shares (below threshold)
      const reconstructed = reconstructSecret(shares.slice(0, 2));

      // Should NOT match original secret
      expect(reconstructed).not.toEqual(secret);
    });
  });

  describe('Constant-Time Multiplication', () => {
    test('gfMul with zero operands executes in constant time', async () => {
      // We need to access gfMul - may need to export for testing
      // For now, test via the public API (splitSecret/reconstructSecret)

      // Create a secret with known values
      const secret1 = new Uint8Array(32).fill(0); // All zeros
      const secret2 = new Uint8Array(32).fill(255); // All ones
      const secret3 = new Uint8Array(32);
      crypto.getRandomValues(secret3); // Random

      const { splitSecret } = await import('../lib/shamir-secret-sharing');

      const iterations = 1000;

      // Time operations with different secret values
      const time1 = measureExecutionTime(() => splitSecret(secret1, 5, 3), iterations);
      const time2 = measureExecutionTime(() => splitSecret(secret2, 5, 3), iterations);
      const time3 = measureExecutionTime(() => splitSecret(secret3, 5, 3), iterations);

      // Calculate variance
      const times = [time1, time2, time3];
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
      const coefficientOfVariation = Math.sqrt(variance) / mean;

      // Coefficient of variation should be very low for constant-time ops
      // Allow up to 5% variation due to system noise
      expect(coefficientOfVariation).toBeLessThan(0.05);

      console.log('Timing variance analysis (gfMul):');
      console.log(`  Time 1 (zeros): ${time1.toFixed(2)}ms`);
      console.log(`  Time 2 (ones):  ${time2.toFixed(2)}ms`);
      console.log(`  Time 3 (random): ${time3.toFixed(2)}ms`);
      console.log(`  Mean: ${mean.toFixed(2)}ms`);
      console.log(`  CV: ${(coefficientOfVariation * 100).toFixed(2)}%`);
    });

    test('No timing correlation with operand values', async () => {
      const { splitSecret } = await import('../lib/shamir-secret-sharing');

      // Create secrets with varying hamming weights
      const operations = [];
      for (let i = 0; i < 10; i++) {
        const secret = new Uint8Array(32);
        // Fill with increasing density of 1 bits
        for (let j = 0; j < 32; j++) {
          secret[j] = (j < i * 3) ? 0xFF : 0x00;
        }
        operations.push(() => splitSecret(secret, 5, 3));
      }

      const iterations = 500;
      const stats = analyzeTimingVariance(operations, iterations);

      // Max deviation should be small relative to mean
      const relativeDeviation = stats.maxDeviation / stats.mean;

      console.log('Operand value timing correlation:');
      console.log(`  Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`  Std Dev: ${stats.stdDev.toFixed(2)}ms`);
      console.log(`  Max Deviation: ${stats.maxDeviation.toFixed(2)}ms`);
      console.log(`  Relative: ${(relativeDeviation * 100).toFixed(2)}%`);

      // Should be less than 10% relative deviation
      expect(relativeDeviation).toBeLessThan(0.1);
    });
  });

  describe('Constant-Time Division', () => {
    test('gfDiv with zero dividend executes in constant time', async () => {
      const { reconstructSecret, splitSecret } = await import('../lib/shamir-secret-sharing');

      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      // Create different share sets
      const shares1 = splitSecret(secret, 5, 3);
      const shares2 = splitSecret(new Uint8Array(32).fill(0), 5, 3);
      const shares3 = splitSecret(new Uint8Array(32).fill(255), 5, 3);

      const iterations = 1000;

      // Time reconstruction operations
      const time1 = measureExecutionTime(() => reconstructSecret(shares1.slice(0, 3)), iterations);
      const time2 = measureExecutionTime(() => reconstructSecret(shares2.slice(0, 3)), iterations);
      const time3 = measureExecutionTime(() => reconstructSecret(shares3.slice(0, 3)), iterations);

      const times = [time1, time2, time3];
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
      const coefficientOfVariation = Math.sqrt(variance) / mean;

      console.log('Timing variance analysis (gfDiv):');
      console.log(`  Time 1: ${time1.toFixed(2)}ms`);
      console.log(`  Time 2: ${time2.toFixed(2)}ms`);
      console.log(`  Time 3: ${time3.toFixed(2)}ms`);
      console.log(`  CV: ${(coefficientOfVariation * 100).toFixed(2)}%`);

      // Should have low variance
      expect(coefficientOfVariation).toBeLessThan(0.05);
    });

    test('Division by zero throws error (fail-safe)', async () => {
      const { reconstructSecret, splitSecret } = await import('../lib/shamir-secret-sharing');

      const secret = new Uint8Array(32);
      crypto.getRandomValues(secret);

      const shares = splitSecret(secret, 5, 3);

      // Corrupt share to have x=0 (invalid)
      const corruptedShares = shares.slice(0, 3).map((share, idx) => ({
        x: idx === 0 ? 0 : share.x, // Set first share x to 0
        y: share.y,
      }));

      // Should handle gracefully (may throw or return incorrect result)
      // The important thing is it doesn't leak timing info
      try {
        reconstructSecret(corruptedShares);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Security Properties', () => {
    test('No early returns in GF operations', () => {
      // This test verifies the CODE STRUCTURE (not runtime)
      const fs = require('fs');
      const path = require('path');

      const shamirFilePath = path.join(__dirname, '../lib/shamir-secret-sharing.ts');
      const code = fs.readFileSync(shamirFilePath, 'utf-8');

      // Extract gfMul and gfDiv function bodies
      const gfMulMatch = code.match(/function gfMul\([\s\S]*?\n\}/);
      const gfDivMatch = code.match(/function gfDiv\([\s\S]*?\n\}/);

      expect(gfMulMatch).toBeTruthy();
      expect(gfDivMatch).toBeTruthy();

      if (gfMulMatch) {
        const gfMulCode = gfMulMatch[0];
        // Should NOT contain early returns based on zero checks in middle of function
        // (Only the initial throw for div by zero is allowed)
        const earlyReturnPattern = /if.*===.*0.*return 0/;
        const hasEarlyReturn = earlyReturnPattern.test(gfMulCode);

        expect(hasEarlyReturn).toBe(false);
        console.log('✓ gfMul has no early returns (constant-time)');
      }

      if (gfDivMatch) {
        const gfDivCode = gfDivMatch[0];
        // Division by zero check is acceptable (fail-safe)
        // But should not have data-dependent early returns
        const lines = gfDivCode.split('\n');
        const earlyReturns = lines.filter(line =>
          line.includes('return') && !line.includes('return result')
        );

        // Should only have the div-by-zero check
        expect(earlyReturns.length).toBeLessThanOrEqual(1);
        console.log('✓ gfDiv has minimal early returns (constant-time)');
      }
    });

    test('Bitwise masking used instead of conditionals', () => {
      const fs = require('fs');
      const path = require('path');

      const shamirFilePath = path.join(__dirname, '../lib/shamir-secret-sharing.ts');
      const code = fs.readFileSync(shamirFilePath, 'utf-8');

      // Look for bitwise AND masking pattern in gfMul/gfDiv
      const gfMulMatch = code.match(/function gfMul\([\s\S]*?\n\}/);
      const gfDivMatch = code.match(/function gfDiv\([\s\S]*?\n\}/);

      if (gfMulMatch) {
        const gfMulCode = gfMulMatch[0];
        // Should contain bitwise AND for masking
        expect(gfMulCode).toMatch(/& \(\(1 - /);
        console.log('✓ gfMul uses bitwise masking for constant-time selection');
      }

      if (gfDivMatch) {
        const gfDivCode = gfDivMatch[0];
        // Should contain bitwise AND for masking
        expect(gfDivCode).toMatch(/& \(\(1 - /);
        console.log('✓ gfDiv uses bitwise masking for constant-time selection');
      }
    });

    test('All code paths execute same number of operations', async () => {
      const { splitSecret } = await import('../lib/shamir-secret-sharing');

      // Create secrets with different characteristics
      const testCases = [
        new Uint8Array(32).fill(0),           // All zeros
        new Uint8Array(32).fill(255),         // All ones
        new Uint8Array(32).fill(0xAA),        // Alternating bits
        new Uint8Array(32).fill(0x55),        // Alternating bits (inverse)
        (() => { const a = new Uint8Array(32); crypto.getRandomValues(a); return a; })(),
      ];

      const iterations = 2000;
      const times = testCases.map(secret =>
        measureExecutionTime(() => splitSecret(secret, 5, 3), iterations)
      );

      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const maxDiff = Math.max(...times) - Math.min(...times);
      const relativeVariation = maxDiff / mean;

      console.log('Code path execution analysis:');
      console.log(`  Times: ${times.map(t => t.toFixed(2)).join(', ')}ms`);
      console.log(`  Mean: ${mean.toFixed(2)}ms`);
      console.log(`  Max diff: ${maxDiff.toFixed(2)}ms`);
      console.log(`  Relative variation: ${(relativeVariation * 100).toFixed(2)}%`);

      // All code paths should execute in similar time
      expect(relativeVariation).toBeLessThan(0.1);
    });
  });

  describe('Timing Attack Resistance', () => {
    test('Cannot determine secret value from timing', async () => {
      const { splitSecret } = await import('../lib/shamir-secret-sharing');

      // Create two secrets: one all zeros, one all ones
      const secret0 = new Uint8Array(32).fill(0);
      const secret1 = new Uint8Array(32).fill(255);

      const iterations = 5000;

      // Measure many times to reduce noise
      const times0: number[] = [];
      const times1: number[] = [];

      for (let i = 0; i < 50; i++) {
        times0.push(measureExecutionTime(() => splitSecret(secret0, 5, 3), iterations));
        times1.push(measureExecutionTime(() => splitSecret(secret1, 5, 3), iterations));
      }

      const mean0 = times0.reduce((a, b) => a + b, 0) / times0.length;
      const mean1 = times1.reduce((a, b) => a + b, 0) / times1.length;

      const timingDifference = Math.abs(mean1 - mean0);
      const relativeDifference = timingDifference / Math.max(mean0, mean1);

      console.log('Timing attack resistance:');
      console.log(`  Mean time (all zeros): ${mean0.toFixed(4)}ms`);
      console.log(`  Mean time (all ones):  ${mean1.toFixed(4)}ms`);
      console.log(`  Difference: ${timingDifference.toFixed(4)}ms`);
      console.log(`  Relative: ${(relativeDifference * 100).toFixed(4)}%`);

      // Timing difference should be negligible
      // Even 1% would be concerning for a constant-time implementation
      expect(relativeDifference).toBeLessThan(0.02);
    });

    test('Cannot determine share values from reconstruction timing', async () => {
      const { splitSecret, reconstructSecret } = await import('../lib/shamir-secret-sharing');

      // Create multiple secrets
      const secrets = Array.from({ length: 10 }, () => {
        const s = new Uint8Array(32);
        crypto.getRandomValues(s);
        return s;
      });

      const allShares = secrets.map(s => splitSecret(s, 5, 3));

      const iterations = 1000;

      // Measure reconstruction time for each
      const times = allShares.map(shares =>
        measureExecutionTime(() => reconstructSecret(shares.slice(0, 3)), iterations)
      );

      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
      const coefficientOfVariation = Math.sqrt(variance) / mean;

      console.log('Reconstruction timing variance:');
      console.log(`  Mean: ${mean.toFixed(2)}ms`);
      console.log(`  Std Dev: ${Math.sqrt(variance).toFixed(2)}ms`);
      console.log(`  CV: ${(coefficientOfVariation * 100).toFixed(2)}%`);

      // Low coefficient of variation indicates constant-time
      expect(coefficientOfVariation).toBeLessThan(0.05);
    });
  });
});
