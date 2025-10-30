/**
 * Unit Tests for Conflict Handler
 *
 * Tests multi-device conflict detection and resolution logic.
 */

import {
  isConflictError,
  resolveConflict,
  getConflictMessage,
  retryWithBackoff,
  withConflictHandling,
  detectStateChange,
  OptimisticUpdateManager,
  ConflictError,
} from '../conflict-handler';

describe('Conflict Handler', () => {
  describe('isConflictError', () => {
    it('should detect conflict errors by type', () => {
      const error: ConflictError = {
        type: 'conflict',
        message: 'Conflict detected',
        localVersion: 1,
        remoteVersion: 2,
      };

      expect(isConflictError(error)).toBe(true);
    });

    it('should detect conflict errors by message content', () => {
      const errors = [
        new Error('Entry already been modified on another device'),
        new Error('Transaction simulation failed'),
        new Error('Account in use'),
      ];

      errors.forEach(error => {
        expect(isConflictError(error)).toBe(true);
      });
    });

    it('should return false for non-conflict errors', () => {
      const errors = [
        new Error('Network error'),
        new Error('Invalid input'),
        { message: 'Some other error' },
        null,
        undefined,
        'string error',
      ];

      errors.forEach(error => {
        expect(isConflictError(error)).toBe(false);
      });
    });

    it('should handle non-object errors', () => {
      expect(isConflictError('string')).toBe(false);
      expect(isConflictError(123)).toBe(false);
      expect(isConflictError(null)).toBe(false);
      expect(isConflictError(undefined)).toBe(false);
    });
  });

  describe('resolveConflict', () => {
    it('should suggest refresh for version mismatch', () => {
      const error: ConflictError = {
        type: 'conflict',
        message: 'Version mismatch',
        localVersion: 1,
        remoteVersion: 2,
      };

      const resolution = resolveConflict(error);

      expect(resolution.action).toBe('refresh');
      expect(resolution.refreshNeeded).toBe(true);
      expect(resolution.userMessage).toContain('updated from another device');
    });

    it('should suggest retry for concurrent modification', () => {
      const error: ConflictError = {
        type: 'conflict',
        message: 'Entry already been modified',
        localVersion: 1,
        remoteVersion: 1,
      };

      const resolution = resolveConflict(error);

      expect(resolution.action).toBe('retry');
      expect(resolution.refreshNeeded).toBe(true);
      expect(resolution.userMessage).toContain('Another device');
    });

    it('should suggest retry for account in use', () => {
      const error: ConflictError = {
        type: 'conflict',
        message: 'Account in use',
        localVersion: 1,
        remoteVersion: 1,
      };

      const resolution = resolveConflict(error);

      expect(resolution.action).toBe('retry');
      expect(resolution.refreshNeeded).toBe(true);
    });

    it('should have user-friendly messages', () => {
      const error: ConflictError = {
        type: 'conflict',
        message: 'Generic conflict',
        localVersion: 1,
        remoteVersion: 2,
      };

      const resolution = resolveConflict(error);

      expect(resolution.userMessage).not.toContain('error');
      expect(resolution.userMessage).not.toContain('Error');
      expect(resolution.userMessage.length).toBeGreaterThan(10);
    });
  });

  describe('getConflictMessage', () => {
    it('should include entry ID when provided', () => {
      const error: ConflictError = {
        type: 'conflict',
        message: 'Conflict',
        localVersion: 1,
        remoteVersion: 2,
        entryId: 42,
      };

      const message = getConflictMessage(error);

      expect(message).toContain('42');
      expect(message).toContain('entry');
    });

    it('should provide generic message without entry ID', () => {
      const error: ConflictError = {
        type: 'conflict',
        message: 'Conflict',
        localVersion: 1,
        remoteVersion: 2,
      };

      const message = getConflictMessage(error);

      expect(message).not.toContain('entry #');
      expect(message).toContain('vault');
    });

    it('should be user-friendly', () => {
      const error: ConflictError = {
        type: 'conflict',
        message: 'Conflict',
        localVersion: 1,
        remoteVersion: 2,
      };

      const message = getConflictMessage(error);

      expect(message).not.toMatch(/[A-Z_]{5,}/); // No ALL_CAPS error codes
      expect(message).toMatch(/[a-z]/); // Has lowercase letters
    });
  });

  describe('retryWithBackoff', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          const error: ConflictError = {
            type: 'conflict',
            message: 'Conflict',
            localVersion: 1,
            remoteVersion: 2,
          };
          throw error;
        }
        return 'success';
      });

      const result = await retryWithBackoff(operation, 3, 10);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-conflict errors', async () => {
      const operation = jest.fn(async () => {
        throw new Error('Network error');
      });

      await expect(retryWithBackoff(operation, 3, 10)).rejects.toThrow('Network error');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries', async () => {
      const operation = jest.fn(async () => {
        const error: ConflictError = {
          type: 'conflict',
          message: 'Conflict',
          localVersion: 1,
          remoteVersion: 2,
        };
        throw error;
      });

      try {
        await retryWithBackoff(operation, 2, 10);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use exponential backoff', async () => {
      const timestamps: number[] = [];
      const operation = jest.fn(async () => {
        timestamps.push(Date.now());
        const error: ConflictError = {
          type: 'conflict',
          message: 'Conflict',
          localVersion: 1,
          remoteVersion: 2,
        };
        throw error;
      });

      try {
        await retryWithBackoff(operation, 3, 100);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Check that delays increase (with some tolerance for timing)
      if (timestamps.length >= 3) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        expect(delay2).toBeGreaterThan(delay1 * 1.5);
      }
    });

    it('should succeed on first try if no error', async () => {
      const operation = jest.fn(async () => 'success');

      const result = await retryWithBackoff(operation, 3, 10);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('withConflictHandling', () => {
    it('should handle successful operations', async () => {
      const operation = jest.fn(async () => 'success');
      const onRefresh = jest.fn(async () => {});

      const result = await withConflictHandling(operation, onRefresh);

      expect(result).toBe('success');
      expect(onRefresh).not.toHaveBeenCalled();
    });

    it('should refresh on conflict after retries exhausted', async () => {
      // Operation always fails to test that refresh is called
      const operation = jest.fn(async () => {
        const error: ConflictError = {
          type: 'conflict',
          message: 'Conflict',
          localVersion: 1,
          remoteVersion: 2,
        };
        throw error;
      });
      const onRefresh = jest.fn(async () => {});

      try {
        // Use 1 retry to avoid timeout
        await withConflictHandling(operation, onRefresh, 1);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }

      // onRefresh should be called after all retries failed
      expect(onRefresh).toHaveBeenCalled();
      expect(operation).toHaveBeenCalledTimes(2); // Initial + 1 retry
    }, 10000); // Increase test timeout

    it('should throw user-friendly error on conflict', async () => {
      const operation = jest.fn(async () => {
        const error: ConflictError = {
          type: 'conflict',
          message: 'Conflict',
          localVersion: 1,
          remoteVersion: 2,
        };
        throw error;
      });
      const onRefresh = jest.fn(async () => {});

      try {
        // Use 1 retry with short delay to avoid timeout
        await withConflictHandling(operation, onRefresh, 1);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toMatch(/updated from another device/);
      }
    }, 10000); // Increase test timeout

    it('should propagate non-conflict errors', async () => {
      const operation = jest.fn(async () => {
        throw new Error('Network error');
      });
      const onRefresh = jest.fn(async () => {});

      await expect(
        withConflictHandling(operation, onRefresh)
      ).rejects.toThrow('Network error');
    });

    it('should work without refresh callback', async () => {
      const operation = jest.fn(async () => 'success');

      const result = await withConflictHandling(operation);

      expect(result).toBe('success');
    });
  });

  describe('detectStateChange', () => {
    it('should detect version increase', async () => {
      const fetchState = jest.fn(async () => 2);

      const changed = await detectStateChange(fetchState, 1);

      expect(changed).toBe(true);
    });

    it('should detect no change', async () => {
      const fetchState = jest.fn(async () => 1);

      const changed = await detectStateChange(fetchState, 1);

      expect(changed).toBe(false);
    });

    it('should handle fetch errors gracefully', async () => {
      const fetchState = jest.fn(async () => {
        throw new Error('Network error');
      });

      const changed = await detectStateChange(fetchState, 1);

      expect(changed).toBe(false);
    });
  });

  describe('OptimisticUpdateManager', () => {
    interface TestState {
      value: number;
      text: string;
    }

    it('should apply optimistic updates immediately', async () => {
      const fetchState = jest.fn(async (): Promise<TestState> => ({
        value: 1,
        text: 'initial',
      }));
      const applyUpdate = jest.fn(async (update: Partial<TestState>): Promise<TestState> => ({
        value: update.value || 1,
        text: update.text || 'initial',
      }));

      const manager = new OptimisticUpdateManager(fetchState, applyUpdate);

      await manager.refresh();
      const updated = await manager.update({ value: 2 });

      expect(updated.value).toBe(2);
      expect(manager.getState()?.value).toBe(2);
    });

    it('should sync with server in background', async () => {
      const fetchState = jest.fn(async (): Promise<TestState> => ({
        value: 1,
        text: 'initial',
      }));
      const applyUpdate = jest.fn(async (update: Partial<TestState>): Promise<TestState> => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          value: update.value || 1,
          text: update.text || 'synced',
        };
      });

      const manager = new OptimisticUpdateManager(fetchState, applyUpdate);

      await manager.refresh();
      await manager.update({ value: 2 });
      await manager.waitForSync();

      const state = manager.getState();
      expect(state?.text).toBe('synced');
    });

    it('should revert on server error', async () => {
      const fetchState = jest.fn(async (): Promise<TestState> => ({
        value: 1,
        text: 'initial',
      }));
      const applyUpdate = jest.fn(async (): Promise<TestState> => {
        throw new Error('Server error');
      });

      const manager = new OptimisticUpdateManager(fetchState, applyUpdate);

      await manager.refresh();

      // Update returns optimistic state immediately
      const updated = await manager.update({ value: 2 });
      expect(updated.value).toBe(2); // Optimistically updated

      // Wait for server sync to fail
      try {
        await manager.waitForSync();
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toBe('Server error');
      }

      const state = manager.getState();
      expect(state?.value).toBe(1); // Reverted after error
    });

    it('should refresh state from server', async () => {
      let serverValue = 1;
      const fetchState = jest.fn(async (): Promise<TestState> => ({
        value: serverValue,
        text: 'server',
      }));
      const applyUpdate = jest.fn(async (update: Partial<TestState>): Promise<TestState> => ({
        value: update.value || 1,
        text: 'updated',
      }));

      const manager = new OptimisticUpdateManager(fetchState, applyUpdate);

      await manager.refresh();
      expect(manager.getState()?.value).toBe(1);

      serverValue = 5;
      await manager.refresh();
      expect(manager.getState()?.value).toBe(5);
    });

    it('should handle concurrent updates', async () => {
      const fetchState = jest.fn(async (): Promise<TestState> => ({
        value: 0,
        text: 'initial',
      }));
      const applyUpdate = jest.fn(async (update: Partial<TestState>): Promise<TestState> => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          value: update.value || 0,
          text: 'updated',
        };
      });

      const manager = new OptimisticUpdateManager(fetchState, applyUpdate);

      await manager.refresh();

      // Fire multiple updates
      const updates = [
        manager.update({ value: 1 }),
        manager.update({ value: 2 }),
        manager.update({ value: 3 }),
      ];

      await Promise.all(updates);
      await manager.waitForSync();

      // Last update should win
      expect(manager.getState()?.value).toBe(3);
    });
  });

  describe('Error Messages', () => {
    it('should provide actionable conflict messages', () => {
      const error: ConflictError = {
        type: 'conflict',
        message: 'Conflict',
        localVersion: 1,
        remoteVersion: 2,
        entryId: 123,
      };

      const message = getConflictMessage(error);

      expect(message).toContain('refresh');
      expect(message).toContain('try again');
      expect(message.length).toBeGreaterThan(20);
    });

    it('should mention other devices', () => {
      const error: ConflictError = {
        type: 'conflict',
        message: 'Conflict',
        localVersion: 1,
        remoteVersion: 2,
      };

      const resolution = resolveConflict(error);

      expect(resolution.userMessage.toLowerCase()).toContain('device');
    });
  });

  describe('Performance', () => {
    it('should handle rapid conflict checks', () => {
      const errors = Array(1000).fill(null).map((_, i) => ({
        type: 'conflict' as const,
        message: `Conflict ${i}`,
        localVersion: 1,
        remoteVersion: 2,
      }));

      const start = Date.now();
      errors.forEach(error => {
        isConflictError(error);
        resolveConflict(error);
        getConflictMessage(error);
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });
});
