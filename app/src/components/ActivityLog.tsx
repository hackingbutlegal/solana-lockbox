import React from 'react';
import './ActivityLog.css';

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'progress';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  txHash?: string;
}

interface ActivityLogProps {
  logs: LogEntry[];
  onCopyTxHash?: (txHash: string) => void;
}

export function ActivityLog({ logs, onCopyTxHash }: ActivityLogProps) {
  const getExplorerUrl = (txHash: string) => {
    return `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
  };

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'progress':
        return '⋯';
      default:
        return 'ℹ';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="activity-log">
      <div className="activity-log-header">
        <h3>Activity Log</h3>
        <span className="log-count">{logs.length} entries</span>
      </div>
      <div className="activity-log-content">
        {logs.length === 0 ? (
          <div className="log-empty">
            <p>No activity yet. Connect your wallet to get started.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`log-entry log-${log.level}`}>
              <div className="log-entry-header">
                <span className="log-icon">{getLevelIcon(log.level)}</span>
                <span className="log-time">{formatTime(log.timestamp)}</span>
              </div>
              <div className="log-message">{log.message}</div>
              {log.txHash && (
                <div className="log-tx-hash">
                  <span className="tx-hash-label">Transaction:</span>
                  <code className="tx-hash-value">{log.txHash.slice(0, 8)}...{log.txHash.slice(-8)}</code>
                  <button
                    className="tx-action-btn"
                    onClick={() => onCopyTxHash?.(log.txHash!)}
                    title="Copy transaction hash"
                  >
                    Copy
                  </button>
                  <a
                    href={getExplorerUrl(log.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tx-action-btn tx-explorer-btn"
                  >
                    View on Explorer
                  </a>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
