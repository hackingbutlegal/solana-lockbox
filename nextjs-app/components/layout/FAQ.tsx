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
    answer: "Storage rent: ~0.071 SOL for 10KB initial chunk (recoverable when account closed). Transaction fees: ~0.00001 SOL per operation. You can expand storage as needed. There are NO monthly subscriptions - you pay once for storage space. Currently on Devnet (free test network with test SOL)."
  },
  {
    question: "What's the maximum storage capacity?",
    answer: "Your vault starts with 10KB (enough for ~50 passwords). You can expand up to 1MB total (100 chunks × 10KB each), which holds approximately 250+ password entries. Each password entry is encrypted separately and can be managed independently."
  },
  {
    question: "Is my data visible on the blockchain?",
    answer: "Yes, the encrypted data is publicly visible on Solana's blockchain - but it's completely encrypted. Without your wallet, the data appears as random bytes. No one can decrypt it except you."
  },
  {
    question: "How does clipboard security work?",
    answer: "For security, when you copy a password to your clipboard, it's automatically cleared after 30 seconds. This prevents accidental exposure if you forget to clear it manually. A notification confirms when the clipboard has been auto-cleared."
  },
  {
    question: "What happens when I refresh the page?",
    answer: "Your session keys are cleared from memory. You'll need to sign a new message with your wallet to restore your session and access your encrypted passwords. This security measure ensures encryption keys never persist after you close or refresh the app."
  },
  {
    question: "Can I use this on mobile?",
    answer: "Yes! Lockbox works great on mobile with wallets like Phantom or Solflare. The interface is fully responsive and optimized for touch screens."
  },
  {
    question: "What's the session timeout?",
    answer: "Your session automatically expires after 5 minutes of inactivity OR 15 minutes absolute (whichever comes first). This protects you if you forget to disconnect your wallet. You'll need to sign a new message with your wallet to continue."
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
    answer: "Lockbox is designed for password management and storing sensitive credentials: website passwords, usernames, API keys, 2FA backup codes, secure notes, credit card numbers, crypto wallet passphrases, and any sensitive text. You can organize entries with categories, tags, and favorites."
  },
  {
    question: "Can I delete or update stored passwords?",
    answer: "Yes! You have full control over your password entries. You can create, read, update, and delete individual passwords at any time. Changes are stored on-chain and your vault maintains a complete history. You can also batch delete multiple entries at once."
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
        <p>Still have questions? Connect your wallet and try it out on Devnet!</p>
      </div>
    </div>
  );
}
