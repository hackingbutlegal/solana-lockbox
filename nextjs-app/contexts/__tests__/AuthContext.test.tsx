/**
 * AuthContext Tests
 *
 * Tests for session management and authentication flow:
 * - Session initialization and cleanup
 * - Timeout tracking (absolute and inactivity)
 * - Activity updates
 * - Client instance management
 * - Error handling
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth, AuthProvider } from '../AuthContext';
import { PublicKey } from '@solana/web3.js';

// Mock dependencies
jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: jest.fn(),
  useConnection: jest.fn(),
}));

jest.mock('../../sdk/src/client-v2', () => ({
  LockboxV2Client: jest.fn().mockImplementation(() => ({
    // Mock client methods
    connection: {},
    wallet: {},
  })),
}));

jest.mock('../../lib/crypto', () => ({
  generateChallenge: jest.fn(() => new Uint8Array([1, 2, 3])),
  createSessionKeyFromSignature: jest.fn(() => Promise.resolve(new Uint8Array(32))),
  wipeSensitiveData: jest.fn(),
}));

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LockboxV2Client } from '../../sdk/src/client-v2';
import { generateChallenge, createSessionKeyFromSignature, wipeSensitiveData } from '../../lib/crypto';

describe('AuthContext', () => {
  const mockPublicKey = new PublicKey('11111111111111111111111111111112');
  const mockSignature = new Uint8Array(64).fill(42);

  let mockWallet: any;
  let mockConnection: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock wallet
    mockWallet = {
      publicKey: mockPublicKey,
      signMessage: jest.fn().mockResolvedValue(mockSignature),
      signTransaction: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    };

    // Mock connection
    mockConnection = {
      connection: {
        rpcEndpoint: 'https://api.devnet.solana.com',
      },
    };

    (useWallet as jest.Mock).mockReturnValue(mockWallet);
    (useConnection as jest.Mock).mockReturnValue(mockConnection);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider programId="7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB">
      {children}
    </AuthProvider>
  );

  describe('Initialization', () => {
    it('should initialize with no active session', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isSessionActive).toBe(false);
      expect(result.current.client).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Session Management', () => {
    it('should initialize session successfully', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.initializeSession();
      });

      expect(success).toBe(true);
      expect(result.current.isSessionActive).toBe(true);
      expect(result.current.client).not.toBeNull();
      expect(mockWallet.signMessage).toHaveBeenCalled();
      expect(generateChallenge).toHaveBeenCalledWith(mockPublicKey);
      expect(createSessionKeyFromSignature).toHaveBeenCalled();
    });

    it('should fail initialization without wallet', async () => {
      (useWallet as jest.Mock).mockReturnValue({
        ...mockWallet,
        publicKey: null,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.initializeSession();
      });

      expect(success).toBe(false);
      expect(result.current.isSessionActive).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    it('should fail initialization without signMessage', async () => {
      (useWallet as jest.Mock).mockReturnValue({
        ...mockWallet,
        signMessage: undefined,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.initializeSession();
      });

      expect(success).toBe(false);
      expect(result.current.isSessionActive).toBe(false);
    });

    it('should clear session and wipe sensitive data', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Initialize session first
      await act(async () => {
        await result.current.initializeSession();
      });

      expect(result.current.isSessionActive).toBe(true);

      // Clear session
      act(() => {
        result.current.clearSession();
      });

      expect(result.current.isSessionActive).toBe(false);
      expect(result.current.client).toBeNull();
      expect(wipeSensitiveData).toHaveBeenCalled();
    });
  });

  describe('Activity Tracking', () => {
    it('should update activity timestamp', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.initializeSession();
      });

      const initialTimeRemaining = result.current.sessionTimeRemaining;

      // Update activity
      act(() => {
        result.current.updateActivity();
      });

      // Time remaining should be reset (closer to max)
      await waitFor(() => {
        expect(result.current.sessionTimeRemaining).toBeGreaterThanOrEqual(initialTimeRemaining || 0);
      });
    });
  });

  describe('Timeout Management', () => {
    it('should track session time remaining', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.initializeSession();
      });

      expect(result.current.sessionTimeRemaining).toBeGreaterThan(0);
      expect(result.current.sessionTimeRemaining).toBeLessThanOrEqual(900); // 15 min = 900 sec
    });

    it('should check session timeout immediately', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.initializeSession();
      });

      // Should not throw or clear session if valid
      act(() => {
        result.current.checkSessionTimeout();
      });

      expect(result.current.isSessionActive).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle signature rejection', async () => {
      (useWallet as jest.Mock).mockReturnValue({
        ...mockWallet,
        signMessage: jest.fn().mockRejectedValue(new Error('User rejected')),
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.initializeSession();
      });

      expect(success).toBe(false);
      expect(result.current.isSessionActive).toBe(false);
      expect(result.current.error).toContain('rejected');
    });

    it('should handle client creation errors', async () => {
      (LockboxV2Client as jest.Mock).mockImplementation(() => {
        throw new Error('Client creation failed');
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.initializeSession();
      });

      expect(success).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Client Instance', () => {
    it('should create client with session key', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.initializeSession();
      });

      expect(LockboxV2Client).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: mockConnection.connection,
          wallet: mockWallet,
        })
      );
    });
  });
});
