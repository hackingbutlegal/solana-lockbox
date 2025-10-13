#!/usr/bin/env node

/**
 * Generate Anchor instruction discriminators
 *
 * Anchor generates discriminators as the first 8 bytes of:
 * SHA256("global:<instruction_name>")
 */

const crypto = require('crypto');

const instructions = [
  'initialize_master_lockbox',
  'initialize_storage_chunk',
  'store_password_entry',
  'retrieve_password_entry',
  'update_password_entry',
  'delete_password_entry',
  'upgrade_subscription',
  'renew_subscription',
  'downgrade_subscription',
];

console.log('Generating Anchor instruction discriminators...\n');

const discriminators = {};

instructions.forEach(instruction => {
  const name = `global:${instruction}`;
  const hash = crypto.createHash('sha256').update(name).digest();
  const discriminator = hash.slice(0, 8);

  discriminators[instruction] = discriminator;

  console.log(`${instruction}:`);
  console.log(`  Hex: ${discriminator.toString('hex')}`);
  console.log(`  Array: [${Array.from(discriminator).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`);
  console.log();
});

// Generate TypeScript code
console.log('\n// TypeScript code for client-v2.ts:');
console.log('const INSTRUCTION_DISCRIMINATORS = {');
instructions.forEach(instruction => {
  const camelCase = instruction.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  const disc = discriminators[instruction];
  const arr = Array.from(disc).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ');
  console.log(`  ${camelCase}: Buffer.from([${arr}]),`);
});
console.log('};');
