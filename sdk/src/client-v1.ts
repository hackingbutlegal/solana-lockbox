/**
 * Lockbox v1.0 Client (Legacy)
 *
 * Provides a simple 1KB encrypted storage interface.
 * This is the legacy version maintained for backward compatibility.
 *
 * @deprecated Use LockboxV2Client for new projects
 */

import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import * as nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';
import { PROGRAM_ID_V1, MAX_ENCRYPTED_SIZE } from './constants';
import IDL from './idl/lockbox.json';

/**
 * Encrypted data structure returned from the program
 */
export interface EncryptedData {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  salt: Uint8Array;
}

/**
 * Options for creating a LockboxClient
 */
export interface LockboxClientOptions {
  connection: Connection;
  wallet: any; // Wallet adapter
  programId?: PublicKey;
  feeReceiver?: PublicKey;
}

/**
 * Main client for interacting with the Lockbox v1 program
 */
export class LockboxClient {
  readonly program: Program;
  readonly connection: Connection;
  readonly wallet: any;
  readonly feeReceiver: PublicKey;

  constructor(options: LockboxClientOptions) {
    this.connection = options.connection;
    this.wallet = options.wallet;
    this.feeReceiver = options.feeReceiver || PROGRAM_ID_V1;

    const provider = new AnchorProvider(
      this.connection,
      this.wallet,
      { commitment: 'confirmed' }
    );

    this.program = new Program(
      IDL as any,
      provider
    );
  }

  /**
   * Derive the PDA address for a user's lockbox
   */
  static getLockboxAddress(userPubkey: PublicKey, programId: PublicKey = PROGRAM_ID_V1): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('lockbox'), userPubkey.toBuffer()],
      programId
    );
  }

  /**
   * Get the lockbox PDA for the current wallet
   */
  getLockboxAddress(): [PublicKey, number] {
    return LockboxClient.getLockboxAddress(this.wallet.publicKey, this.program.programId);
  }

  /**
   * Derive an encryption key from a wallet signature using HKDF
   */
  private deriveKey(signature: Uint8Array, salt: Uint8Array): Uint8Array {
    // Simple HKDF-like derivation using nacl.hash
    const material = new Uint8Array(signature.length + salt.length);
    material.set(signature);
    material.set(salt, signature.length);
    const hash = nacl.hash(material);
    return hash.slice(0, 32); // Use first 32 bytes as key
  }

  /**
   * Encrypt plaintext data
   */
  private encrypt(plaintext: string, key: Uint8Array): { ciphertext: Uint8Array; nonce: Uint8Array } {
    const nonce = nacl.randomBytes(24);
    const messageUint8 = util.decodeUTF8(plaintext);
    const ciphertext = nacl.secretbox(messageUint8, nonce, key);

    return { ciphertext, nonce };
  }

  /**
   * Decrypt ciphertext data
   */
  private decrypt(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): string | null {
    const decrypted = nacl.secretbox.open(ciphertext, nonce, key);
    if (!decrypted) {
      return null;
    }
    return util.encodeUTF8(decrypted);
  }

  /**
   * Request a signature from the wallet for key derivation
   */
  private async requestSignature(): Promise<Uint8Array> {
    const message = util.decodeUTF8('Sign this message to derive your Lockbox encryption key');
    const signature = await this.wallet.signMessage(message);
    return signature;
  }

  /**
   * Store encrypted data on-chain
   *
   * @param plaintext - The data to encrypt and store
   * @returns Transaction signature
   */
  async store(plaintext: string): Promise<string> {
    // Validate plaintext size
    const plaintextBytes = util.decodeUTF8(plaintext);
    if (plaintextBytes.length > MAX_ENCRYPTED_SIZE - 16) { // Account for Poly1305 tag
      throw new Error(`Plaintext too large. Max size: ${MAX_ENCRYPTED_SIZE - 16} bytes`);
    }

    // Get wallet signature for key derivation
    const signature = await this.requestSignature();

    // Generate random salt
    const salt = nacl.randomBytes(32);

    // Derive encryption key
    const key = this.deriveKey(signature, salt);

    // Encrypt the data
    const { ciphertext, nonce } = this.encrypt(plaintext, key);

    // Get lockbox PDA
    const [lockboxPda] = this.getLockboxAddress();

    // Send transaction
    const tx = await this.program.methods
      .storeEncrypted(
        Buffer.from(ciphertext),
        Array.from(nonce),
        Array.from(salt)
      )
      .accounts({
        lockbox: lockboxPda,
        user: this.wallet.publicKey,
        feeReceiver: this.feeReceiver,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Retrieve and decrypt data from on-chain storage
   *
   * @returns Decrypted plaintext data
   */
  async retrieve(): Promise<string> {
    // Get lockbox PDA
    const [lockboxPda] = this.getLockboxAddress();

    // Fetch lockbox account
    const lockboxAccount: any = await (this.program.account as any).lockbox.fetch(lockboxPda);

    // Get wallet signature for key derivation
    const signature = await this.requestSignature();

    // Derive decryption key using stored salt
    const key = this.deriveKey(signature, new Uint8Array(lockboxAccount.salt));

    // Decrypt the data
    const plaintext = this.decrypt(
      new Uint8Array(lockboxAccount.ciphertext),
      new Uint8Array(lockboxAccount.nonce),
      key
    );

    if (!plaintext) {
      throw new Error('Decryption failed. Invalid key or corrupted data.');
    }

    return plaintext;
  }

  /**
   * Check if a lockbox exists for the current wallet
   */
  async exists(): Promise<boolean> {
    try {
      const [lockboxPda] = this.getLockboxAddress();
      await (this.program.account as any).lockbox.fetch(lockboxPda);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get lockbox account data (encrypted)
   */
  async getAccount(): Promise<any> {
    const [lockboxPda] = this.getLockboxAddress();
    return await (this.program.account as any).lockbox.fetch(lockboxPda);
  }

  /**
   * Get the required account size for a lockbox
   */
  static getAccountSize(): number {
    return 8 + // discriminator
      32 + // owner pubkey
      4 + MAX_ENCRYPTED_SIZE + // vec length + data
      24 + // nonce
      32 + // salt
      8 + // last_action_slot
      1; // bump
  }

  /**
   * Calculate rent exemption amount for a lockbox account
   */
  async getRentExemption(): Promise<number> {
    return await this.connection.getMinimumBalanceForRentExemption(
      LockboxClient.getAccountSize()
    );
  }
}

export default LockboxClient;
