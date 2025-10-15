/**
 * Lockbox TypeScript SDK
 *
 * Provides a convenient interface for interacting with the Lockbox Solana program.
 * Handles encryption, decryption, and all on-chain interactions.
 *
 * @packageDocumentation
 */

import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';
import IDL from './idl/lockbox.json';

// V2 (default)
export { LockboxV2Client as default } from './client-v2';
export { LockboxV2Client } from './client-v2';

// V1 (legacy namespace)
export { LockboxClient as LockboxV1Client } from './client-v1';

// Constants
export * from './constants';

// Types
export * from './types-v2';
export type { Lockbox } from './types';

// Utils
export * from './utils';

// Retry utilities
export * from './retry';

// Error formatting
export * from './error-formatter';

// IDLs
export { default as IDL_V1 } from './idl/lockbox.json';
export { default as IDL_V2 } from '../idl/lockbox-v2.json';

