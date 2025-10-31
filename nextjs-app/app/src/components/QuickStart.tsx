import './QuickStart.css';

export function QuickStart() {
  return (
    <div className="quickstart-container">
      <div className="quickstart-header">
        <h2>🚀 Quick Start Guide</h2>
        <p className="quickstart-subtitle">Get up and running with Lockbox in 5 minutes</p>
      </div>

      <div className="quickstart-steps">
        <div className="step">
          <div className="step-number">1</div>
          <div className="step-content">
            <h3>Install a Solana Wallet</h3>
            <p>If you don&apos;t have one already, install a Solana wallet browser extension:</p>
            <ul>
              <li>
                <strong>Phantom</strong>: <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer">phantom.app</a> (Recommended for beginners)
              </li>
              <li>
                <strong>Solflare</strong>: <a href="https://solflare.com/" target="_blank" rel="noopener noreferrer">solflare.com</a>
              </li>
              <li>
                <strong>Backpack</strong>: <a href="https://backpack.app/" target="_blank" rel="noopener noreferrer">backpack.app</a>
              </li>
            </ul>
            <p className="step-tip">💡 Follow the wallet&apos;s setup instructions to create a new wallet or import an existing one.</p>
          </div>
        </div>

        <div className="step">
          <div className="step-number">2</div>
          <div className="step-content">
            <h3>Switch to Devnet</h3>
            <p>Lockbox currently runs on Solana&apos;s Devnet (test network). Here&apos;s how to switch:</p>

            <div className="wallet-instructions">
              <details>
                <summary><strong>Phantom Wallet</strong></summary>
                <ol>
                  <li>Click the Phantom icon in your browser</li>
                  <li>Click the ⚙️ Settings icon (bottom right)</li>
                  <li>Select &quot;Developer Settings&quot;</li>
                  <li>Toggle &quot;Testnet Mode&quot; to ON</li>
                  <li>Select &quot;Devnet&quot; from the network dropdown</li>
                </ol>
              </details>

              <details>
                <summary><strong>Solflare Wallet</strong></summary>
                <ol>
                  <li>Click the Solflare icon in your browser</li>
                  <li>Click the network selector at the top (shows &quot;Mainnet&quot; by default)</li>
                  <li>Select &quot;Devnet&quot; from the dropdown</li>
                </ol>
              </details>

              <details>
                <summary><strong>Backpack Wallet</strong></summary>
                <ol>
                  <li>Click the Backpack icon in your browser</li>
                  <li>Click the ⚙️ Settings icon</li>
                  <li>Select &quot;Preferences&quot;</li>
                  <li>Under &quot;Solana&quot;, change the network to &quot;Devnet&quot;</li>
                </ol>
              </details>
            </div>

            <p className="step-warning">⚠️ <strong>Important:</strong> Devnet is for testing only. Never store critical data on Devnet - it can be reset at any time.</p>
          </div>
        </div>

        <div className="step">
          <div className="step-number">3</div>
          <div className="step-content">
            <h3>Get Devnet SOL</h3>
            <p>You need some Devnet SOL (test tokens) to use Lockbox. You&apos;ll need about 0.01 SOL to get started.</p>

            <p><strong>Option 1: Wallet Built-in Faucet</strong></p>
            <ul>
              <li><strong>Phantom</strong>: Click &quot;Receive&quot; → &quot;Get Devnet SOL&quot; button</li>
              <li><strong>Solflare</strong>: Look for &quot;Airdrop&quot; or &quot;Faucet&quot; option in wallet</li>
            </ul>

            <p><strong>Option 2: Web Faucet</strong></p>
            <ol>
              <li>Copy your wallet address (click to copy in your wallet)</li>
              <li>Visit: <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer">faucet.solana.com</a></li>
              <li>Paste your wallet address</li>
              <li>Click &quot;Confirm Airdrop&quot;</li>
              <li>Wait 10-30 seconds for the SOL to arrive</li>
            </ol>

            <p className="step-tip">💡 Devnet SOL is free and has no real value. You can request more anytime if you run out.</p>
          </div>
        </div>

        <div className="step">
          <div className="step-number">4</div>
          <div className="step-content">
            <h3>Connect Your Wallet</h3>
            <p>Return to the <strong>App</strong> tab and click the <strong>&quot;Select Wallet&quot;</strong> button in the header.</p>
            <ol>
              <li>Choose your wallet from the list</li>
              <li>Approve the connection request in your wallet</li>
              <li>You should see your wallet address displayed</li>
            </ol>
            <p className="step-tip">💡 Lockbox never has access to your private keys or funds - it only requests message signatures for encryption.</p>
          </div>
        </div>

        <div className="step">
          <div className="step-number">5</div>
          <div className="step-content">
            <h3>Store Your First Secret</h3>
            <p>Now you&apos;re ready to encrypt and store data!</p>
            <ol>
              <li>Enter some text in the &quot;Data to Store&quot; box (e.g., &quot;Hello Lockbox!&quot;)</li>
              <li>Click <strong>&quot;🔒 Encrypt &amp; Store&quot;</strong></li>
              <li>Sign the message in your wallet when prompted</li>
              <li>Wait for the transaction to confirm (usually 1-2 seconds)</li>
              <li>Check the Activity Log for confirmation</li>
            </ol>
            <p className="step-tip">💡 The first storage costs ~0.01 SOL (one-time account creation). Subsequent stores cost only 0.001 SOL each.</p>
          </div>
        </div>

        <div className="step">
          <div className="step-number">6</div>
          <div className="step-content">
            <h3>Decrypt and View</h3>
            <p>To retrieve and decrypt your stored data:</p>
            <ol>
              <li>Click <strong>&quot;🔓 Decrypt &amp; View Latest&quot;</strong></li>
              <li>Sign the decryption request in your wallet</li>
              <li>Your decrypted data will appear below</li>
              <li>Use the <strong>&quot;Copy&quot;</strong> button to copy the data to your clipboard</li>
            </ol>
            <p className="step-warning">⚠️ Decrypted data auto-hides after 30 seconds for security. It&apos;s also cleared when you refresh the page.</p>
          </div>
        </div>
      </div>

      <div className="quickstart-footer">
        <h3>✨ You&apos;re all set!</h3>
        <p>You now know how to securely store and retrieve encrypted data with Lockbox.</p>
        <p>Check out the <strong>FAQ</strong> tab for more details on security, features, and best practices.</p>
      </div>

      <div className="quickstart-tips">
        <h3>💡 Pro Tips</h3>
        <ul>
          <li>⚠️ <strong>Demo Only</strong>: This is for testing purposes. DO NOT store real passwords, private keys, or sensitive data</li>
          <li>Each new store operation overwrites your previous data - you&apos;ll get a warning</li>
          <li>Your session expires after 30 minutes of inactivity for security (resets with each action)</li>
          <li>Transactions are logged in the Activity Log with links to Solana Explorer</li>
          <li>Maximum storage: 1 KiB (about 1000 characters)</li>
        </ul>
      </div>
    </div>
  );
}
