'use client';

import { useState } from 'react';
import './FAQ.css';

interface FAQItem {
  question: string;
  answer: string | JSX.Element;
}

const faqData: FAQItem[] = [
  {
    question: "What makes Lockbox innovative and first-of-its-kind?",
    answer: (
      <>
        <strong>Lockbox is the first password manager to combine blockchain storage with client-side encryption in a truly decentralized architecture.</strong>
        <br /><br />
        <strong>Technical Innovation:</strong>
        <ul style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '8px' }}>
          <li>Your encrypted data lives permanently on Solana's blockchain, not company servers</li>
          <li>Encryption keys are derived from your wallet signature - never stored anywhere</li>
          <li>Zero-knowledge architecture: even we can't decrypt your data</li>
          <li>Censorship-resistant: your data can't be taken down or blocked</li>
          <li>Verifiable: all code is open-source and on-chain operations are auditable</li>
        </ul>
        <strong>Unlike traditional password managers</strong> (1Password, LastPass, Bitwarden) that rely on centralized servers, Lockbox leverages blockchain's permanence and your wallet's cryptographic security. This eliminates single points of failure, company custody of keys, and reliance on corporate trust.
        <br /><br />
        Built by Web3 Studios LLC as a proof-of-concept for next-generation password management.
      </>
    )
  },
  {
    question: "Why is Lockbox better than traditional password managers?",
    answer: "Traditional password managers store your encrypted data on company servers that can be hacked, shut down, or subpoenaed. Lockbox stores your encrypted data on Solana's blockchain - a decentralized network with no single point of failure. No company controls your data, and it can't be taken offline. You own your encryption keys through your wallet, not a company. The code is open-source and auditable, so you can verify exactly how your data is protected. Built by Web3 Studios LLC."
  },
  {
    question: "What is Lockbox?",
    answer: "Lockbox is an open-source password manager with blockchain storage, built on Solana by Web3 Studios LLC. It lets you encrypt data client-side and store it on the blockchain, tied to your wallet. Only you can decrypt and view your data."
  },
  {
    question: "How does encryption work?",
    answer: "All encryption happens in your browser using XChaCha20-Poly1305 (industry-standard authenticated encryption) for password storage. Social recovery and sharing features use AES-GCM. Your wallet signature is used to derive a session key via HKDF-SHA256, which encrypts your data. The encrypted data is then stored on Solana's blockchain. Keys exist only in memory and are never stored."
  },
  {
    question: "Where are my encryption keys stored?",
    answer: "Your encryption keys are NEVER stored anywhere. They exist only in your browser's memory during your session and are derived from your wallet signature each time. When you close or refresh the page, keys are wiped from memory."
  },
  {
    question: "What happens if I lose my wallet?",
    answer: "If you lose access to your wallet, you'll lose access to your encrypted data. This is by design - only your wallet can decrypt the data. Always keep your wallet's seed phrase safe and backed up."
  },
  {
    question: "How much does it cost to use?",
    answer: "One-time storage rent: ~0.01-0.03 SOL per storage chunk (recoverable when account closed). Initial account creation: ~0.009 SOL. Transaction fees: ~0.00001 SOL per operation. There are NO monthly subscriptions - you pay once for storage space. Currently on Devnet (free test network with test SOL)."
  },
  {
    question: "What's the maximum data size?",
    answer: "You can store up to 1 KiB (1024 bytes) of data per transaction. This is perfect for passwords, private keys, 2FA backup codes, notes, or small sensitive text."
  },
  {
    question: "Is my data visible on the blockchain?",
    answer: "Yes, the encrypted data is publicly visible on Solana's blockchain - but it's completely encrypted. Without your wallet, the data appears as random bytes. No one can decrypt it except you."
  },
  {
    question: "Why does decrypted data auto-hide?",
    answer: "For security! After you decrypt and view data, it automatically hides after 30 seconds and is cleared from memory. This prevents shoulder surfing and accidental exposure if you leave your screen unlocked."
  },
  {
    question: "What happens when I refresh the page?",
    answer: "All decrypted data is immediately cleared from memory. You'll need to reconnect your wallet and click 'Decrypt & View' again to see your data. This ensures nothing sensitive persists."
  },
  {
    question: "Can I use this on mobile?",
    answer: "Yes! Lockbox works great on mobile with wallets like Phantom or Solflare. The interface is fully responsive and optimized for touch screens."
  },
  {
    question: "What's the session timeout?",
    answer: "Your session automatically expires after 15 minutes of inactivity. This protects you if you forget to disconnect your wallet. You'll need to reconnect to continue."
  },
  {
    question: "Is this ready for mainnet?",
    answer: "Lockbox is currently on Solana Devnet (test network) for testing. Before mainnet launch, it will undergo professional security audits. Never store critical data on devnet - it can be reset."
  },
  {
    question: "What wallets are supported?",
    answer: "Any Solana wallet that supports the Standard Wallet protocol, including Phantom, Solflare, Backpack, and more. Simply click 'Select Wallet' to connect."
  },
  {
    question: "How do I generate a new Solana wallet for testing?",
    answer: "1. Install Phantom wallet (phantom.app) or Solflare (solflare.com) browser extension. 2. Click 'Create New Wallet' and securely save your seed phrase (12-24 words). 3. Complete wallet setup. 4. Switch to Devnet (see next question). Never reuse wallets containing real funds for testing."
  },
  {
    question: "How do I switch my wallet to Devnet?",
    answer: (
      <>
        <strong>For Phantom:</strong> Click Settings (gear icon) → Developer Settings → Testnet Mode → Select 'Devnet'.
        <br /><br />
        <strong>For Solflare:</strong> Click Settings → Network → Select 'Devnet'.
        <br /><br />
        You'll need Devnet SOL from a faucet to test. The Lockbox program is deployed at:{' '}
        <a
          href="https://explorer.solana.com/address/7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB?cluster=devnet"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#9945FF', textDecoration: 'underline' }}
        >
          7JxsHjdReydiz36jwsWuvwwR28qqK6V454VwFJnnSkoB
        </a>
      </>
    )
  },
  {
    question: "Is this safe to use? Can I store my real passwords?",
    answer: "⚠️ WARNING: Lockbox is currently in TESTING PHASE and has NOT been professionally audited. The program may contain bugs or security vulnerabilities. DO NOT store sensitive, real-world passwords or private keys during testing. Use only test data. This is deployed on Devnet (test network) which can be reset at any time. Wait for the mainnet-audited version before storing real sensitive data."
  },
  {
    question: "Can someone access my data if they hack Solana?",
    answer: "No. Even if someone had full access to Solana's blockchain data, your encrypted data would appear as random bytes. The encryption happens client-side with keys derived from YOUR wallet signature."
  },
  {
    question: "How do I get Devnet SOL to fund my wallet?",
    answer: (
      <>
        After switching to Devnet, you need free test SOL to pay for transactions:
        <br /><br />
        <strong>Method 1 (Easiest):</strong> In Phantom or Solflare, look for the "Airdrop" or "Request Airdrop" button in the wallet interface.
        <br /><br />
        <strong>Method 2:</strong> Visit{' '}
        <a
          href="https://faucet.solana.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#9945FF', textDecoration: 'underline' }}
        >
          faucet.solana.com
        </a>
        {' '}and paste your wallet address. You'll receive 1-2 SOL instantly.
        <br /><br />
        You need about 0.01 SOL to start using Lockbox.
      </>
    )
  },
  {
    question: "What can I store in Lockbox?",
    answer: "Lockbox is perfect for: passwords, private keys, seed phrases, 2FA backup codes, API keys, sensitive notes, recovery codes, or any small text that needs encryption. Each storage can hold up to 1024 bytes."
  },
  {
    question: "Can I delete or update stored data?",
    answer: "Yes! When you store new data, it overwrites your previous data in the same lockbox. Each wallet has one lockbox that gets updated with each new storage transaction. Your transaction history remains visible on the blockchain."
  },
  {
    question: "Why use blockchain instead of cloud storage?",
    answer: "Blockchain storage offers: open-source and auditable code, censorship resistance, cryptographic verification, and transparency. Your encrypted data lives on Solana's blockchain, accessible only with your wallet. Built by Web3 Studios LLC."
  }
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleQuestion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-container">
      <div className="faq-header">
        <h2>❓ Frequently Asked Questions</h2>
        <p className="faq-subtitle">Everything you need to know about Lockbox</p>
      </div>

      <div className="faq-list">
        {faqData.map((item, index) => (
          <div
            key={index}
            className={`faq-item ${openIndex === index ? 'open' : ''}`}
          >
            <button
              className="faq-question"
              onClick={() => toggleQuestion(index)}
              aria-expanded={openIndex === index}
            >
              <span className="faq-question-text">{item.question}</span>
              <span className="faq-toggle-icon">
                {openIndex === index ? '−' : '+'}
              </span>
            </button>
            <div className="faq-answer-wrapper">
              <div className="faq-answer">
                {item.answer}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="faq-footer">
        <p>Still have questions?</p>
        <p className="faq-contact">
          Check out the{' '}
          <a
            href="https://github.com/hackingbutlegal/lockbox"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub repository
          </a>
        </p>
      </div>
    </div>
  );
}
