'use client';

import React, { useState, useRef } from 'react';
import { PasswordEntry } from '../../sdk/src/types-v2';
import {
  ImportFormat,
  ExportOptions,
  importPasswords,
  exportToCSV,
  exportToJSON,
  detectImportFormat,
} from '../../lib/import-export';

/**
 * ImportExportPanel Component
 *
 * Provides UI for importing/exporting passwords:
 * - Multiple format support (CSV, JSON, LastPass, 1Password, Bitwarden)
 * - Auto-detection of import format
 * - Export with filtering options
 * - Preview before import
 * - Security warnings
 */

export interface ImportExportPanelProps {
  entries: PasswordEntry[];
  onImport: (entries: PasswordEntry[]) => Promise<void>;
  className?: string;
}

export function ImportExportPanel({ entries, onImport, className = '' }: ImportExportPanelProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [importFormat, setImportFormat] = useState<ImportFormat>(ImportFormat.LockboxJSON);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<PasswordEntry[] | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('json');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeArchived: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportPreview(null);
    setImportErrors([]);

    try {
      const text = await file.text();

      // Auto-detect format if not explicitly set
      const detectedFormat = detectImportFormat(text);
      if (detectedFormat) {
        setImportFormat(detectedFormat);
      }

      // Parse and preview
      const result = importPasswords(text, importFormat);

      if (result.errors.length > 0) {
        setImportErrors(result.errors.map(e => `Line ${e.line}: ${e.error}`));
      }

      if (result.entries.length > 0) {
        setImportPreview(result.entries);
      } else {
        setImportErrors(prev => [...prev, 'No valid entries found in file']);
      }
    } catch (err) {
      setImportErrors([err instanceof Error ? err.message : 'Failed to read file']);
    }
  };

  const handleImport = async () => {
    if (!importPreview) return;

    setIsImporting(true);
    try {
      await onImport(importPreview);
      // Reset after successful import
      setImportFile(null);
      setImportPreview(null);
      setImportErrors([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setImportErrors([err instanceof Error ? err.message : 'Import failed']);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = () => {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (exportFormat === 'csv') {
      content = exportToCSV(entries, exportOptions);
      filename = `lockbox-export-${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
    } else {
      content = exportToJSON(entries, exportOptions);
      filename = `lockbox-export-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    }

    // Trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`import-export-panel ${className}`}>
      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Import
        </button>
        <button
          className={`tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Export
        </button>
      </div>

      {/* Content */}
      <div className="panel-content">
        {activeTab === 'import' ? (
          <div className="import-section">
            <div className="security-warning">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                <path d="M11 7h2v6h-2z" fill="#fff" />
                <circle cx="12" cy="16" r="1" fill="#fff" />
              </svg>
              <div>
                <strong>Security Notice:</strong> Ensure you trust the source of imported files.
                All passwords will be re-encrypted with your session key.
              </div>
            </div>

            <div className="form-group">
              <label>Import Format</label>
              <select
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value as ImportFormat)}
              >
                <option value={ImportFormat.LockboxJSON}>Lockbox JSON</option>
                <option value={ImportFormat.LastPass}>LastPass CSV</option>
                <option value={ImportFormat.OnePassword}>1Password CSV</option>
                <option value={ImportFormat.Bitwarden}>Bitwarden CSV</option>
                <option value={ImportFormat.GenericCSV}>Generic CSV</option>
              </select>
            </div>

            <div className="file-upload">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileSelect}
                id="import-file"
              />
              <label htmlFor="import-file" className="file-upload-label">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {importFile ? importFile.name : 'Choose File'}
              </label>
            </div>

            {importErrors.length > 0 && (
              <div className="error-list">
                <h4>Import Errors:</h4>
                <ul>
                  {importErrors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {importPreview && (
              <div className="import-preview">
                <h4>Preview ({importPreview.length} entries)</h4>
                <div className="preview-list">
                  {importPreview.slice(0, 5).map((entry, idx) => (
                    <div key={idx} className="preview-item">
                      <strong>{entry.title}</strong>
                      {' - '}
                      <span className="preview-type">
                        {entry.type === 0 ? 'Login' : 'Other'}
                      </span>
                    </div>
                  ))}
                  {importPreview.length > 5 && (
                    <div className="preview-more">
                      ... and {importPreview.length - 5} more
                    </div>
                  )}
                </div>

                <button
                  className="btn-import"
                  onClick={handleImport}
                  disabled={isImporting}
                >
                  {isImporting ? 'Importing...' : `Import ${importPreview.length} Entries`}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="export-section">
            <div className="form-group">
              <label>Export Format</label>
              <div className="format-options">
                <label className="format-option">
                  <input
                    type="radio"
                    checked={exportFormat === 'json'}
                    onChange={() => {
                      setExportFormat('json');
                      setExportOptions({ ...exportOptions, format: 'json' });
                    }}
                  />
                  <div>
                    <strong>JSON</strong>
                    <span>Complete data with metadata</span>
                  </div>
                </label>
                <label className="format-option">
                  <input
                    type="radio"
                    checked={exportFormat === 'csv'}
                    onChange={() => {
                      setExportFormat('csv');
                      setExportOptions({ ...exportOptions, format: 'csv' });
                    }}
                  />
                  <div>
                    <strong>CSV</strong>
                    <span>Compatible with spreadsheets</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="export-options">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={exportOptions.includeArchived ?? false}
                  onChange={(e) =>
                    setExportOptions({ ...exportOptions, includeArchived: e.target.checked })
                  }
                />
                Include archived entries
              </label>
            </div>

            <div className="export-summary">
              <strong>{entries.length}</strong> entries will be exported
            </div>

            <button className="btn-export" onClick={handleExport}>
              Export Passwords
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .import-export-panel {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .tabs {
          display: flex;
          border-bottom: 2px solid #f3f4f6;
        }

        .tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          cursor: pointer;
          font-weight: 500;
          color: #6b7280;
          transition: all 0.2s;
        }

        .tab svg {
          width: 18px;
          height: 18px;
        }

        .tab:hover {
          background: #f9fafb;
        }

        .tab.active {
          color: #667eea;
          border-bottom-color: #667eea;
          background: #f9fafb;
        }

        .panel-content {
          padding: 20px;
        }

        .security-warning {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #fef3c7;
          border: 1px solid #fbbf24;
          border-radius: 6px;
          margin-bottom: 20px;
          font-size: 13px;
          color: #92400e;
        }

        .security-warning svg {
          width: 24px;
          height: 24px;
          color: #f59e0b;
          flex-shrink: 0;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #374151;
          font-size: 14px;
        }

        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }

        .file-upload {
          margin-bottom: 20px;
        }

        .file-upload input[type="file"] {
          display: none;
        }

        .file-upload-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          background: #f9fafb;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
          color: #374151;
        }

        .file-upload-label:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .file-upload-label svg {
          width: 20px;
          height: 20px;
        }

        .error-list {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .error-list h4 {
          margin: 0 0 8px 0;
          color: #991b1b;
          font-size: 13px;
          font-weight: 600;
        }

        .error-list ul {
          margin: 0;
          padding-left: 20px;
          color: #dc2626;
          font-size: 12px;
        }

        .import-preview {
          background: #f9fafb;
          border-radius: 8px;
          padding: 16px;
        }

        .import-preview h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .preview-list {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .preview-item {
          padding: 8px 0;
          font-size: 13px;
          color: #374151;
          border-bottom: 1px solid #f3f4f6;
        }

        .preview-item:last-child {
          border-bottom: none;
        }

        .preview-type {
          color: #6b7280;
          font-size: 12px;
        }

        .preview-more {
          padding-top: 8px;
          color: #6b7280;
          font-size: 12px;
          font-style: italic;
        }

        .btn-import,
        .btn-export {
          width: 100%;
          padding: 12px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-import:hover,
        .btn-export:hover {
          background: #5568d3;
        }

        .btn-import:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .format-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .format-option {
          display: flex;
          gap: 12px;
          padding: 12px;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .format-option:hover {
          border-color: #667eea;
          background: #f9fafb;
        }

        .format-option input[type="radio"] {
          margin-top: 2px;
        }

        .format-option div {
          flex: 1;
        }

        .format-option strong {
          display: block;
          color: #374151;
          margin-bottom: 4px;
        }

        .format-option span {
          display: block;
          font-size: 12px;
          color: #6b7280;
        }

        .export-options {
          margin-bottom: 20px;
        }

        .checkbox-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          cursor: pointer;
        }

        .export-summary {
          padding: 16px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 6px;
          margin-bottom: 16px;
          text-align: center;
          color: #15803d;
        }

        .export-summary strong {
          font-size: 24px;
        }
      `}</style>
    </div>
  );
}
