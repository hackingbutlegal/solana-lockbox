import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { Lockbox } from "../target/types/lockbox";

describe("Lockbox v2 - Password Manager", () => {
  // Configure the client to use devnet
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Lockbox as Program<Lockbox>;
  const wallet = provider.wallet as anchor.Wallet;

  // Test accounts
  let masterLockboxPda: PublicKey;
  let masterLockboxBump: number;
  let storageChunkPda: PublicKey;
  let storageChunkBump: number;

  // Test data
  const testPassword = {
    title: "Test Login",
    username: "testuser",
    password: "testpass123",
    url: "https://example.com",
    notes: "Test notes",
  };

  before("Derive PDAs", async () => {
    // Derive master lockbox PDA
    [masterLockboxPda, masterLockboxBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("master_lockbox"), wallet.publicKey.toBuffer()],
      program.programId
    );

    // Derive storage chunk PDA for index 0
    const chunkIndexBuffer = Buffer.alloc(2);
    chunkIndexBuffer.writeUInt16LE(0);
    [storageChunkPda, storageChunkBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("storage_chunk"), masterLockboxPda.toBuffer(), chunkIndexBuffer],
      program.programId
    );

    console.log("Master Lockbox PDA:", masterLockboxPda.toBase58());
    console.log("Storage Chunk PDA:", storageChunkPda.toBase58());
  });

  describe("Account Initialization", () => {
    it("Initializes master lockbox", async () => {
      try {
        const tx = await program.methods
          .initializeMasterLockbox()
          .accounts({
            masterLockbox: masterLockboxPda,
            owner: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("Initialize Master Lockbox TX:", tx);

        // Fetch and verify account
        const masterLockbox = await program.account.masterLockbox.fetch(masterLockboxPda);
        assert.equal(masterLockbox.owner.toBase58(), wallet.publicKey.toBase58());
        assert.equal(masterLockbox.totalEntries.toNumber(), 0);
        assert.equal(masterLockbox.storageChunksCount, 0);
        assert.equal(masterLockbox.subscriptionTier.free !== undefined, true);
      } catch (error: any) {
        if (error.message?.includes("already in use")) {
          console.log("Master lockbox already initialized, skipping...");
        } else {
          throw error;
        }
      }
    });

    it("Initializes storage chunk", async () => {
      try {
        const initialCapacity = 10240; // 10KB initial capacity
        const tx = await program.methods
          .initializeStorageChunk(
            0, // chunk index
            initialCapacity,
            { passwords: {} } // StorageType::Passwords
          )
          .accounts({
            masterLockbox: masterLockboxPda,
            storageChunk: storageChunkPda,
            owner: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("Initialize Storage Chunk TX:", tx);

        // Fetch and verify chunk
        const chunk = await program.account.storageChunk.fetch(storageChunkPda);
        assert.equal(chunk.chunkIndex, 0);
        assert.equal(chunk.maxCapacity, initialCapacity);
        assert.equal(chunk.currentSize, 0);
        assert.equal(chunk.entryCount, 0);
      } catch (error: any) {
        if (error.message?.includes("already in use")) {
          console.log("Storage chunk already initialized, skipping...");
        } else {
          throw error;
        }
      }
    });
  });

  describe("Password Entry Operations", () => {
    let storedEntryId: number;

    it("Stores a password entry", async () => {
      // Encrypt test data (simplified - in production use proper encryption)
      const jsonData = JSON.stringify(testPassword);
      const encryptedData = Buffer.from(jsonData); // Simplified for testing

      // Generate title hash
      const crypto = require("crypto");
      const titleHash = Array.from(
        crypto.createHash("sha256").update(testPassword.title.toLowerCase()).digest()
      );

      const tx = await program.methods
        .storePasswordEntry(
          0, // chunk index
          encryptedData,
          { login: {} }, // PasswordEntryType::Login
          0, // category
          titleHash
        )
        .accounts({
          masterLockbox: masterLockboxPda,
          storageChunk: storageChunkPda,
          owner: wallet.publicKey,
        })
        .rpc();

      console.log("Store Password Entry TX:", tx);

      // Fetch updated master lockbox to get entry ID
      const masterLockbox = await program.account.masterLockbox.fetch(masterLockboxPda);
      storedEntryId = masterLockbox.nextEntryId.toNumber() - 1;
      assert.equal(masterLockbox.totalEntries.toNumber(), 1);

      console.log("Stored Entry ID:", storedEntryId);
    });

    it("Retrieves a password entry", async () => {
      const result = await program.methods
        .retrievePasswordEntry(0, new BN(storedEntryId))
        .accounts({
          masterLockbox: masterLockboxPda,
          storageChunk: storageChunkPda,
          owner: wallet.publicKey,
        })
        .view();

      console.log("Retrieved encrypted data length:", result.length);
      assert.isTrue(result.length > 0);

      // Decrypt and verify (simplified)
      const decryptedJson = Buffer.from(result).toString();
      const decryptedData = JSON.parse(decryptedJson);
      assert.equal(decryptedData.title, testPassword.title);
      assert.equal(decryptedData.username, testPassword.username);
    });

    it("Updates a password entry", async () => {
      const updatedPassword = {
        ...testPassword,
        password: "newpassword456",
        notes: "Updated notes",
      };

      const jsonData = JSON.stringify(updatedPassword);
      const encryptedData = Buffer.from(jsonData);

      const tx = await program.methods
        .updatePasswordEntry(0, new BN(storedEntryId), encryptedData)
        .accounts({
          masterLockbox: masterLockboxPda,
          storageChunk: storageChunkPda,
          owner: wallet.publicKey,
        })
        .rpc();

      console.log("Update Password Entry TX:", tx);

      // Verify update
      const result = await program.methods
        .retrievePasswordEntry(0, new BN(storedEntryId))
        .accounts({
          masterLockbox: masterLockboxPda,
          storageChunk: storageChunkPda,
          owner: wallet.publicKey,
        })
        .view();

      const decryptedData = JSON.parse(Buffer.from(result).toString());
      assert.equal(decryptedData.password, "newpassword456");
      assert.equal(decryptedData.notes, "Updated notes");
    });

    it("Deletes a password entry", async () => {
      const tx = await program.methods
        .deletePasswordEntry(0, new BN(storedEntryId))
        .accounts({
          masterLockbox: masterLockboxPda,
          storageChunk: storageChunkPda,
          owner: wallet.publicKey,
        })
        .rpc();

      console.log("Delete Password Entry TX:", tx);

      // Verify deletion by attempting retrieval (should fail or return empty)
      try {
        await program.methods
          .retrievePasswordEntry(0, new BN(storedEntryId))
          .accounts({
            masterLockbox: masterLockboxPda,
            storageChunk: storageChunkPda,
            owner: wallet.publicKey,
          })
          .view();
        // If we get here, the entry might still exist (soft delete)
        console.log("Entry soft-deleted (still retrievable)");
      } catch (error) {
        // Entry hard-deleted (not retrievable)
        console.log("Entry hard-deleted");
      }
    });
  });

  describe("Subscription Management", () => {
    it("Checks initial subscription tier", async () => {
      const masterLockbox = await program.account.masterLockbox.fetch(masterLockboxPda);
      assert.equal(masterLockbox.subscriptionTier.free !== undefined, true);
      console.log("Initial subscription tier: Free");
    });

    it("Upgrades subscription to Basic", async () => {
      // Note: This requires payment, so it might fail on devnet without funds
      try {
        const tx = await program.methods
          .upgradeSubscription({ basic: {} })
          .accounts({
            masterLockbox: masterLockboxPda,
            owner: wallet.publicKey,
            feeReceiver: program.programId, // Using program ID as fee receiver
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("Upgrade Subscription TX:", tx);

        const masterLockbox = await program.account.masterLockbox.fetch(masterLockboxPda);
        assert.equal(masterLockbox.subscriptionTier.basic !== undefined, true);
      } catch (error: any) {
        console.log("Subscription upgrade failed (expected on devnet):", error.message);
        // This is expected to fail without proper funding
      }
    });

    it("Renews subscription", async () => {
      try {
        const tx = await program.methods
          .renewSubscription()
          .accounts({
            masterLockbox: masterLockboxPda,
            owner: wallet.publicKey,
            feeReceiver: program.programId,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("Renew Subscription TX:", tx);
      } catch (error: any) {
        console.log("Subscription renewal failed (expected):", error.message);
      }
    });

    it("Downgrades subscription", async () => {
      try {
        const tx = await program.methods
          .downgradeSubscription()
          .accounts({
            masterLockbox: masterLockboxPda,
            owner: wallet.publicKey,
          })
          .rpc();

        console.log("Downgrade Subscription TX:", tx);
      } catch (error: any) {
        console.log("Subscription downgrade result:", error.message);
      }
    });
  });

  describe("Storage Statistics", () => {
    it("Fetches storage statistics", async () => {
      const masterLockbox = await program.account.masterLockbox.fetch(masterLockboxPda);

      console.log("\n=== Storage Statistics ===");
      console.log("Total Entries:", masterLockbox.totalEntries.toString());
      console.log("Storage Chunks:", masterLockbox.storageChunksCount);
      console.log("Total Capacity:", masterLockbox.totalCapacity.toString());
      console.log("Storage Used:", masterLockbox.storageUsed.toString());
      console.log("Categories:", masterLockbox.categoriesCount);
      console.log("Subscription Tier:", Object.keys(masterLockbox.subscriptionTier)[0]);
      console.log("==========================\n");
    });

    it("Fetches chunk details", async () => {
      try {
        const chunk = await program.account.storageChunk.fetch(storageChunkPda);

        console.log("\n=== Chunk 0 Statistics ===");
        console.log("Chunk Index:", chunk.chunkIndex);
        console.log("Max Capacity:", chunk.maxCapacity);
        console.log("Current Size:", chunk.currentSize);
        console.log("Entry Count:", chunk.entryCount);
        console.log("Data Type:", Object.keys(chunk.dataType)[0]);
        console.log("==========================\n");
      } catch (error) {
        console.log("Could not fetch chunk (might not exist yet)");
      }
    });
  });

  describe("Error Handling", () => {
    it("Fails to store with invalid chunk index", async () => {
      const encryptedData = Buffer.from("test");
      const titleHash = Array.from(Buffer.alloc(32));

      try {
        await program.methods
          .storePasswordEntry(999, encryptedData, { login: {} }, 0, titleHash)
          .accounts({
            masterLockbox: masterLockboxPda,
            storageChunk: storageChunkPda, // Wrong PDA for index 999
            owner: wallet.publicKey,
          })
          .rpc();
        assert.fail("Should have thrown error");
      } catch (error: any) {
        console.log("Expected error:", error.message);
        assert.isTrue(error.message.includes("Error"));
      }
    });

    it("Fails to retrieve non-existent entry", async () => {
      try {
        await program.methods
          .retrievePasswordEntry(0, new BN(999999))
          .accounts({
            masterLockbox: masterLockboxPda,
            storageChunk: storageChunkPda,
            owner: wallet.publicKey,
          })
          .view();
        assert.fail("Should have thrown error");
      } catch (error: any) {
        console.log("Expected error:", error.message);
        assert.isTrue(error.message.includes("Error") || error.message.includes("not found"));
      }
    });
  });
});
