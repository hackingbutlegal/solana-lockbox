const { PublicKey } = require('@solana/web3.js');

const userPubkey = new PublicKey('3H8e4VnGjxKGFKxk2QMmjuu1B7dnDLysGN8hvcDCKxZh');
const programId = new PublicKey('5nr7xe1U3k6U6zPEmW3FCbPyXCa7jr7JpudaLKuVNyvZ');

const [pda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from('lockbox'), userPubkey.toBuffer()],
  programId
);

console.log('Your Lockbox PDA:', pda.toBase58());
console.log('Bump:', bump);
