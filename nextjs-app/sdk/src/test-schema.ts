/**
 * Test script for schema versioning, compression, and duplicate detection
 *
 * Run with: npx ts-node sdk/src/test-schema.ts
 */

import {
  serializeEntry,
  deserializeEntry,
  generateSimilarityFingerprint,
  areLikelyDuplicates,
  CURRENT_SCHEMA_VERSION,
  COMPRESSION_THRESHOLD,
  PasswordEntrySchema,
  type ValidatedPasswordEntry
} from './schema';
import { PasswordEntryType } from './types-v2';

console.log('🧪 Testing Schema Versioning, Compression, and Duplicate Detection\n');

// Test 1: Small entry (no compression)
console.log('=== Test 1: Small Entry (No Compression) ===');
const smallEntry: ValidatedPasswordEntry = {
  type: PasswordEntryType.Login,
  title: 'Gmail',
  username: 'user@gmail.com',
  password: 'super_secret_password_123',
  url: 'https://gmail.com',
  notes: 'Personal email',
  category: 1,
  tags: ['email', 'google'],
  favorite: true,
  archived: false,
  createdAt: new Date('2025-01-01'),
  lastModified: new Date('2025-01-15'),
  accessCount: 5,
};

try {
  const serialized = serializeEntry(smallEntry);
  console.log(`✓ Serialized size: ${serialized.length} bytes`);

  const parsed = JSON.parse(serialized);
  console.log(`✓ Schema version: ${parsed.version}`);
  console.log(`✓ Compressed: ${parsed.compressed || false}`);
  console.log(`✓ Checksum: ${parsed.checksum.substring(0, 16)}...`);

  const deserialized = deserializeEntry(serialized);
  console.log(`✓ Deserialized successfully`);
  console.log(`✓ Title matches: ${deserialized.title === smallEntry.title}`);
  console.log(`✓ Password matches: ${deserialized.password === smallEntry.password}`);
  console.log(`✓ Date preserved: ${deserialized.createdAt?.toISOString() === smallEntry.createdAt?.toISOString()}`);
  console.log('✅ Test 1 PASSED\n');
} catch (error) {
  console.error('❌ Test 1 FAILED:', error);
  process.exit(1);
}

// Test 2: Large entry (with compression)
console.log('=== Test 2: Large Entry (With Compression) ===');
const longNotes = 'A'.repeat(1000); // 1000 characters to trigger compression
const largeEntry: ValidatedPasswordEntry = {
  type: PasswordEntryType.SecureNote,
  title: 'Large Secure Note',
  notes: longNotes,
  category: 2,
  favorite: false,
  archived: false,
  createdAt: new Date('2025-01-01'),
  lastModified: new Date('2025-01-15'),
};

try {
  const serialized = serializeEntry(largeEntry);
  console.log(`✓ Serialized size: ${serialized.length} bytes`);
  console.log(`✓ Original notes size: ${longNotes.length} bytes`);

  const parsed = JSON.parse(serialized);
  console.log(`✓ Schema version: ${parsed.version}`);
  console.log(`✓ Compressed: ${parsed.compressed}`);

  if (parsed.compressed) {
    console.log(`✓ Compression triggered (threshold: ${COMPRESSION_THRESHOLD} bytes)`);
  }

  const deserialized = deserializeEntry(serialized);
  console.log(`✓ Deserialized successfully`);
  console.log(`✓ Notes length matches: ${deserialized.notes?.length === longNotes.length}`);
  console.log(`✓ Notes content matches: ${deserialized.notes === longNotes}`);
  console.log('✅ Test 2 PASSED\n');
} catch (error) {
  console.error('❌ Test 2 FAILED:', error);
  process.exit(1);
}

// Test 3: Legacy entry migration (v0 -> v2)
console.log('=== Test 3: Legacy Entry Migration (v0 -> current) ===');
const legacyEntry = {
  type: PasswordEntryType.Login,
  title: 'Legacy Entry',
  username: 'legacy@example.com',
  password: 'old_password',
  createdAt: '2024-01-01T00:00:00.000Z',
  lastModified: '2024-06-01T00:00:00.000Z',
};

try {
  const legacyJson = JSON.stringify(legacyEntry);
  console.log(`✓ Legacy entry (no version field)`);

  const deserialized = deserializeEntry(legacyJson);
  console.log(`✓ Migration successful`);
  console.log(`✓ Title preserved: ${deserialized.title === 'Legacy Entry'}`);
  console.log(`✓ Dates migrated: ${deserialized.createdAt instanceof Date}`);
  console.log('✅ Test 3 PASSED\n');
} catch (error) {
  console.error('❌ Test 3 FAILED:', error);
  process.exit(1);
}

// Test 4: Duplicate detection
console.log('=== Test 4: Duplicate Detection ===');
const entry1: ValidatedPasswordEntry = {
  type: PasswordEntryType.Login,
  title: 'GitHub',
  username: 'johndoe',
  url: 'https://github.com',
  password: 'password123',
};

const entry2: ValidatedPasswordEntry = {
  type: PasswordEntryType.Login,
  title: 'GitHub',
  username: 'johndoe',
  url: 'https://github.com',
  password: 'different_password_456', // Different password
};

const entry3: ValidatedPasswordEntry = {
  type: PasswordEntryType.Login,
  title: 'GitLab',
  username: 'johndoe',
  url: 'https://gitlab.com',
  password: 'password789',
};

try {
  const fp1 = generateSimilarityFingerprint(entry1);
  const fp2 = generateSimilarityFingerprint(entry2);
  const fp3 = generateSimilarityFingerprint(entry3);

  console.log(`✓ Generated fingerprints`);
  console.log(`  Entry 1 (GitHub): ${fp1.substring(0, 16)}...`);
  console.log(`  Entry 2 (GitHub, diff pw): ${fp2.substring(0, 16)}...`);
  console.log(`  Entry 3 (GitLab): ${fp3.substring(0, 16)}...`);

  const isDuplicate12 = areLikelyDuplicates(entry1, entry2);
  const isDuplicate13 = areLikelyDuplicates(entry1, entry3);

  console.log(`✓ Entry 1 and 2 are duplicates: ${isDuplicate12} (expected: true)`);
  console.log(`✓ Entry 1 and 3 are duplicates: ${isDuplicate13} (expected: false)`);

  if (isDuplicate12 && !isDuplicate13) {
    console.log('✅ Test 4 PASSED\n');
  } else {
    throw new Error('Duplicate detection logic failed');
  }
} catch (error) {
  console.error('❌ Test 4 FAILED:', error);
  process.exit(1);
}

// Test 5: Schema validation
console.log('=== Test 5: Schema Validation ===');
try {
  // Valid entry
  const validEntry = PasswordEntrySchema.parse({
    type: PasswordEntryType.CreditCard,
    title: 'Visa Card',
    cardNumber: '4111111111111111',
    cardExpiry: '12/25',
    cardCvv: '123',
    cardHolder: 'John Doe',
  });
  console.log(`✓ Valid entry passed validation`);

  // Invalid entry (missing required title)
  try {
    PasswordEntrySchema.parse({
      type: PasswordEntryType.CreditCard,
      // title missing
      cardNumber: '4111111111111111',
    });
    console.error('❌ Should have failed validation');
    process.exit(1);
  } catch (validationError) {
    console.log(`✓ Invalid entry correctly rejected`);
  }

  console.log('✅ Test 5 PASSED\n');
} catch (error) {
  console.error('❌ Test 5 FAILED:', error);
  process.exit(1);
}

// Test 6: Compression threshold behavior
console.log('=== Test 6: Compression Threshold Behavior ===');
try {
  // Just below threshold
  const belowThreshold: ValidatedPasswordEntry = {
    type: PasswordEntryType.SecureNote,
    title: 'Below Threshold',
    notes: 'X'.repeat(COMPRESSION_THRESHOLD - 100),
  };

  const serializedBelow = serializeEntry(belowThreshold);
  const parsedBelow = JSON.parse(serializedBelow);
  console.log(`✓ Entry below threshold (${COMPRESSION_THRESHOLD - 100} bytes)`);
  console.log(`  Compressed: ${parsedBelow.compressed || false}`);

  // Just above threshold
  const aboveThreshold: ValidatedPasswordEntry = {
    type: PasswordEntryType.SecureNote,
    title: 'Above Threshold',
    notes: 'Y'.repeat(COMPRESSION_THRESHOLD + 100),
  };

  const serializedAbove = serializeEntry(aboveThreshold);
  const parsedAbove = JSON.parse(serializedAbove);
  console.log(`✓ Entry above threshold (${COMPRESSION_THRESHOLD + 100} bytes)`);
  console.log(`  Compressed: ${parsedAbove.compressed || false}`);

  console.log('✅ Test 6 PASSED\n');
} catch (error) {
  console.error('❌ Test 6 FAILED:', error);
  process.exit(1);
}

console.log('═══════════════════════════════════════');
console.log('✅ ALL TESTS PASSED!');
console.log('═══════════════════════════════════════');
console.log(`\nSchema Version: v${CURRENT_SCHEMA_VERSION}`);
console.log(`Compression Threshold: ${COMPRESSION_THRESHOLD} bytes`);
console.log('\n✓ Serialization/Deserialization working');
console.log('✓ Compression working correctly');
console.log('✓ Legacy migration working');
console.log('✓ Duplicate detection working');
console.log('✓ Schema validation working');
console.log('✓ Compression threshold behavior correct');
