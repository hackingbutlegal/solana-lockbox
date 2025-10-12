import './StorageHistory.css';

export interface StoredItem {
  id: string;
  timestamp: Date;
  txHash: string;
  dataPreview: string; // First 50 chars of encrypted data
  sizeBytes: number;
}

interface StorageHistoryProps {
  items: StoredItem[];
  onRetrieve: (item: StoredItem) => void;
  onCopyTxHash: (txHash: string) => void;
}

export function StorageHistory({ items, onRetrieve, onCopyTxHash }: StorageHistoryProps) {
  const getExplorerUrl = (txHash: string) => {
    return `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(2)} KiB`;
  };

  return (
    <div className="storage-history">
      <div className="storage-history-header">
        <h3>📦 Storage History</h3>
        <span className="storage-count">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="storage-history-content">
        {items.length === 0 ? (
          <div className="storage-empty">
            <div className="empty-icon">🔒</div>
            <p>No stored data yet</p>
            <p className="empty-hint">Encrypt and store data to see it here</p>
          </div>
        ) : (
          <div className="storage-list">
            {items.map((item) => (
              <div key={item.id} className="storage-item">
                <div className="storage-item-header">
                  <div className="storage-item-info">
                    <div className="storage-timestamp">
                      {formatTimestamp(item.timestamp)}
                    </div>
                    <div className="storage-size">{formatBytes(item.sizeBytes)}</div>
                  </div>
                  <button
                    className="retrieve-btn"
                    onClick={() => onRetrieve(item)}
                    title="Temporarily decrypt and display this data (auto-hides in 30s)"
                  >
                    🔓 Decrypt & View
                  </button>
                </div>

                <div className="storage-preview">
                  <code>{item.dataPreview}</code>
                </div>

                <div className="storage-tx">
                  <span className="tx-label">Transaction:</span>
                  <code className="tx-hash">
                    {item.txHash.slice(0, 8)}...{item.txHash.slice(-8)}
                  </code>
                  <button
                    className="tx-btn"
                    onClick={() => onCopyTxHash(item.txHash)}
                    title="Copy transaction hash"
                  >
                    Copy
                  </button>
                  <a
                    href={getExplorerUrl(item.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tx-btn tx-explorer"
                  >
                    Explorer
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
