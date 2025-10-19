/**
 * Test Data Generators
 *
 * Utilities for generating consistent test data across E2E tests.
 */

import { PasswordEntryType } from '../../sdk/src/types-v2';

export interface TestPasswordEntry {
  type: PasswordEntryType;
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  customFields?: Record<string, string>;
}

/**
 * Generate test password entries for different types
 */
export const TEST_ENTRIES: Record<PasswordEntryType, TestPasswordEntry> = {
  [PasswordEntryType.Login]: {
    type: PasswordEntryType.Login,
    title: 'Test Gmail Account',
    username: 'testuser@gmail.com',
    password: 'SecureP@ssw0rd123!',
    url: 'https://gmail.com',
    notes: 'Primary email account',
  },
  [PasswordEntryType.CreditCard]: {
    type: PasswordEntryType.CreditCard,
    title: 'Test Visa Card',
    username: '4532015112830366',
    password: '123', // CVV
    notes: 'Expires 12/2025',
    customFields: {
      cardholderName: 'John Doe',
      expiryDate: '12/25',
    },
  },
  [PasswordEntryType.SecureNote]: {
    type: PasswordEntryType.SecureNote,
    title: 'WiFi Password',
    notes: 'Home WiFi: MyNetwork\nPassword: SuperSecret123',
  },
  [PasswordEntryType.Identity]: {
    type: PasswordEntryType.Identity,
    title: 'Personal Identity',
    username: 'John Doe',
    notes: 'SSN: XXX-XX-1234\nPassport: AB1234567',
    customFields: {
      dateOfBirth: '01/01/1990',
      address: '123 Main St, City, State 12345',
    },
  },
  [PasswordEntryType.ApiKey]: {
    type: PasswordEntryType.ApiKey,
    title: 'GitHub API Key',
    username: 'github-user',
    password: 'ghp_test1234567890abcdefghijklmnop',
    url: 'https://api.github.com',
    notes: 'Personal access token for CI/CD',
  },
  [PasswordEntryType.SshKey]: {
    type: PasswordEntryType.SshKey,
    title: 'Production Server SSH',
    username: 'deploy',
    password: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...',
    url: 'prod-server.example.com',
    notes: 'Production deployment key',
  },
  [PasswordEntryType.CryptoWallet]: {
    type: PasswordEntryType.CryptoWallet,
    title: 'Solana Devnet Wallet',
    username: 'DevnetWallet',
    password: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
    notes: 'Test wallet - NEVER use on mainnet',
    customFields: {
      walletType: 'Solana',
      publicKey: 'DevTest1111111111111111111111111111111',
    },
  },
};

/**
 * Generate password entries for bulk operations
 */
export function generateBulkEntries(count: number, baseType: PasswordEntryType = PasswordEntryType.Login): TestPasswordEntry[] {
  const entries: TestPasswordEntry[] = [];
  const baseEntry = TEST_ENTRIES[baseType];

  for (let i = 1; i <= count; i++) {
    entries.push({
      ...baseEntry,
      title: `${baseEntry.title} #${i}`,
      username: baseEntry.username ? `${baseEntry.username.split('@')[0]}${i}@test.com` : `user${i}`,
      password: `${baseEntry.password}${i}`,
    });
  }

  return entries;
}

/**
 * Generate weak passwords for password health testing
 */
export const WEAK_PASSWORDS = [
  'password',
  '123456',
  'qwerty',
  'abc123',
  'letmein',
  'welcome',
];

/**
 * Generate strong passwords for password health testing
 */
export const STRONG_PASSWORDS = [
  'Xk9#mP$vL2@qW7nR',
  'T3$tP@ssw0rd!2024',
  'aB1@cD2#eF3$gH4%',
  'Secure!Pass123@Word',
];

/**
 * Test TOTP secrets for 2FA testing
 */
export const TEST_TOTP_SECRETS = {
  google: 'JBSWY3DPEHPK3PXP',
  github: 'HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ',
  aws: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
};

/**
 * Test categories
 */
export const TEST_CATEGORIES = [
  'Personal',
  'Work',
  'Finance',
  'Social Media',
  'Development',
  'Shopping',
];

/**
 * Generate random string for unique identifiers
 */
export function randomString(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Wait helper with random jitter
 */
export function sleep(ms: number, jitter: number = 0): Promise<void> {
  const actualMs = ms + Math.random() * jitter;
  return new Promise(resolve => setTimeout(resolve, actualMs));
}
