const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
const buf = Buffer.from(data.account.data[0], 'base64');

console.log('=== Master Lockbox State ===');
console.log('Account exists:', data.account ? 'YES' : 'NO');
console.log('Data length:', buf.length, 'bytes');
console.log('Balance:', data.account.lamports / 1e9, 'SOL');

// Parse the account data
let offset = 8; // Skip discriminator

// Owner (32 bytes)
offset += 32;

// total_entries (u64)
const totalEntries = buf.readBigUInt64LE(offset);
offset += 8;
console.log('Total entries:', totalEntries.toString());

// storage_chunks_count (u16)
const storageChunksCount = buf.readUInt16LE(offset);
offset += 2;
console.log('Storage chunks count:', storageChunksCount);

// subscription_tier (u8)
const subscriptionTier = buf.readUInt8(offset);
offset += 1;
console.log('Subscription tier:', subscriptionTier);

// Skip timestamps (i64 x 2)
offset += 16;

// total_capacity (u64)
const totalCapacity = buf.readBigUInt64LE(offset);
offset += 8;
console.log('Total capacity:', totalCapacity.toString(), 'bytes');

// storage_used (u64)
const storageUsed = buf.readBigUInt64LE(offset);
offset += 8;
console.log('Storage used:', storageUsed.toString(), 'bytes');

// storage_chunks vec (u32 length prefix)
const vecLength = buf.readUInt32LE(offset);
offset += 4;
console.log('Storage chunks vec length:', vecLength);

console.log('');
console.log('=== Analysis ===');
if (storageChunksCount === 0 && vecLength === 0) {
  console.log('✓ Master lockbox is CLEAN - no chunks registered');
  console.log('✓ Ready to create first storage chunk');
  console.log('✓ You can now try to store a password!');
} else if (storageChunksCount !== vecLength) {
  console.log('✗ INCONSISTENT STATE: count=' + storageChunksCount + ' but vec length=' + vecLength);
  console.log('✗ This needs to be fixed before storing passwords');
} else {
  console.log('✓ Master lockbox has', vecLength, 'chunk(s) properly registered');
  console.log('✓ You can store passwords now');
}
