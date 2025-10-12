import React, { useState } from 'react';
import './FAQ.css';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "What is Lockbox?",
    answer: "Lockbox is a secure, decentralized storage solution built on Solana. It lets you encrypt data client-side and store it on the blockchain, tied to your wallet. Only you can decrypt and view your data."
  },
  {
    question: "How does encryption work?",
    answer: "All encryption happens in your browser using XChaCha20-Poly1305 (military-grade encryption). Your wallet signature is used to derive a session key, which encrypts your data. The encrypted data is then stored on Solana's blockchain."
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
    answer: "Storage costs 0.001 SOL per transaction (~$0.0002 USD at current prices). The first time you store data, there's an additional one-time cost of ~0.009 SOL to create your account. This is currently on Devnet (free test network)."
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
    question: "Can someone access my data if they hack Solana?",
    answer: "No. Even if someone had full access to Solana's blockchain data, your encrypted data would appear as random bytes. The encryption happens client-side with keys derived from YOUR wallet signature."
  },
  {
    question: "How do I get Devnet SOL?",
    answer: "Click your wallet's built-in faucet option, or visit https://faucet.solana.com to get free Devnet SOL for testing. You'll need about 0.01 SOL to start using Lockbox."
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
    answer: "Blockchain offers: true decentralization (no company controls your data), censorship resistance, cryptographic verification, and transparency. You don't trust a company - you trust math and your wallet."
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
          {' '}or reach out to{' '}
          <a
            href="https://x.com/0xgraffito"
            target="_blank"
            rel="noopener noreferrer"
          >
            @0xgraffito
          </a>
        </p>
      </div>
    </div>
  );
}
