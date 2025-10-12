/**
 * Browser polyfills for Node.js modules
 * Must be imported before any other code that uses these globals
 */

import { Buffer } from 'buffer';

// Set Buffer globally for Solana Web3.js and other dependencies
(window as any).Buffer = Buffer;
(globalThis as any).Buffer = Buffer;

// Also set process.env for compatibility
(window as any).process = {
  env: {},
};
(globalThis as any).process = {
  env: {},
};

// Set global for compatibility
(window as any).global = globalThis;
