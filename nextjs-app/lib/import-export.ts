/**
 * Import/Export Utility - Phase 4: Search & Intelligence
 *
 * Supports importing passwords from popular password managers and exporting
 * Lockbox vaults for backup and migration.
 *
 * ## Supported Import Formats
 *
 * - **1Password CSV**: title,url,username,password,notes,category
 * - **Bitwarden CSV**: folder,favorite,type,name,notes,fields,login_uri,login_username,login_password
 * - **LastPass CSV**: url,username,password,extra,name,grouping,fav
 * - **Generic CSV**: Configurable field mapping
 * - **Lockbox JSON**: Native format with full metadata
 *
 * ## Security Considerations
 *
 * - Imported data is immediately encrypted with user's session key
 * - No plaintext passwords stored during import process
 * - Export includes encrypted vault backup option
 * - CSV export is plaintext (user must secure the file)
 *
 * @module import-export
 */

import {
  PasswordEntry,
  PasswordEntryType,
  LoginEntry,
  SecureNoteEntry,
  CreditCardEntry,
} from '../sdk/src/types-v2';

/**
 * Supported password manager formats
 */
export enum ImportFormat {
  OnePassword = 'onepassword',
  Bitwarden = 'bitwarden',
  LastPass = 'lastpass',
  LockboxJSON = 'lockbox-json',
  GenericCSV = 'generic-csv',
}

/**
 * Import result with success/failure counts
 */
export interface ImportResult {
  success: number;
  failed: number;
  entries: PasswordEntry[];
  errors: Array<{ line: number; error: string }>;
}

/**
 * Export options
 */
export interface ExportOptions {
  format: 'csv' | 'json';
  includeArchived?: boolean;
  includeFavorites?: boolean;
  categories?: number[]; // Export specific categories only
}

/**
 * CSV field mapping configuration
 */
export interface CSVFieldMapping {
  title?: number; // Column index (0-based)
  username?: number;
  password?: number;
  url?: number;
  notes?: number;
  category?: number;
  favorite?: number;
}

/**
 * Sanitize CSV field to prevent formula injection
 *
 * SECURITY: CSV Injection Protection
 * Prevents malicious formulas from executing when CSV is opened in Excel/Sheets
 *
 * Attack vectors prevented:
 * - =cmd|'/c calc'!A1 (command execution)
 * - +1+1 (formula evaluation)
 * - @SUM(1+1) (function calls)
 * - -1+1 (negative formulas)
 * - \t=1+1 (tab-prefixed formulas)
 *
 * @param field - Raw CSV field value
 * @returns Sanitized field safe for CSV export/import
 */
function sanitizeCSVField(field: string): string {
  if (!field || field.length === 0) {
    return field;
  }

  const trimmed = field.trim();
  const firstChar = trimmed[0];

  // Check for dangerous formula characters
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];

  if (dangerousChars.includes(firstChar)) {
    // Prefix with single quote to force text interpretation
    // Excel/Sheets will treat '=1+1 as the literal string "=1+1"
    return `'${field}`;
  }

  return field;
}

/**
 * Parse CSV string into rows with formula injection protection
 */
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  const lines = csvText.split('\n');

  for (const line of lines) {
    if (line.trim().length === 0) continue;

    // Simple CSV parser (handles quoted fields)
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }

    // Add last field
    fields.push(currentField.trim());

    // SECURITY: Sanitize all fields to prevent CSV injection
    const sanitizedFields = fields.map(sanitizeCSVField);
    rows.push(sanitizedFields);
  }

  return rows;
}

/**
 * Import from 1Password CSV format
 *
 * Expected columns: title, url, username, password, notes, category
 */
export function importFromOnePassword(csvText: string): ImportResult {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    entries: [],
    errors: [],
  };

  try {
    const rows = parseCSV(csvText);

    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      if (row.length < 4) {
        result.errors.push({ line: i + 1, error: 'Insufficient columns' });
        result.failed++;
        continue;
      }

      const [title, url, username, password, notes, category] = row;

      if (!title || !password) {
        result.errors.push({ line: i + 1, error: 'Missing title or password' });
        result.failed++;
        continue;
      }

      const entry: LoginEntry = {
        type: PasswordEntryType.Login,
        title: title,
        username: username || '',
        password: password,
        url: url || undefined,
        notes: notes || undefined,
        tags: category ? [category] : undefined,
        createdAt: new Date(),
        lastModified: new Date(),
      };

      result.entries.push(entry);
      result.success++;
    }
  } catch (error) {
    result.errors.push({
      line: 0,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    });
  }

  return result;
}

/**
 * Import from Bitwarden CSV format
 *
 * Expected columns: folder,favorite,type,name,notes,fields,login_uri,login_username,login_password
 */
export function importFromBitwarden(csvText: string): ImportResult {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    entries: [],
    errors: [],
  };

  try {
    const rows = parseCSV(csvText);

    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      if (row.length < 9) {
        result.errors.push({ line: i + 1, error: 'Insufficient columns' });
        result.failed++;
        continue;
      }

      const [folder, favorite, type, name, notes, , login_uri, login_username, login_password] = row;

      // Only import login types for now
      if (type !== 'login') {
        continue;
      }

      if (!name || !login_password) {
        result.errors.push({ line: i + 1, error: 'Missing name or password' });
        result.failed++;
        continue;
      }

      const entry: LoginEntry = {
        type: PasswordEntryType.Login,
        title: name,
        username: login_username || '',
        password: login_password,
        url: login_uri || undefined,
        notes: notes || undefined,
        tags: folder ? [folder] : undefined,
        favorite: favorite === '1' || favorite.toLowerCase() === 'true',
        createdAt: new Date(),
        lastModified: new Date(),
      };

      result.entries.push(entry);
      result.success++;
    }
  } catch (error) {
    result.errors.push({
      line: 0,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    });
  }

  return result;
}

/**
 * Import from LastPass CSV format
 *
 * Expected columns: url,username,password,extra,name,grouping,fav
 */
export function importFromLastPass(csvText: string): ImportResult {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    entries: [],
    errors: [],
  };

  try {
    const rows = parseCSV(csvText);

    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      if (row.length < 5) {
        result.errors.push({ line: i + 1, error: 'Insufficient columns' });
        result.failed++;
        continue;
      }

      const [url, username, password, extra, name, grouping, fav] = row;

      if (!name || !password) {
        result.errors.push({ line: i + 1, error: 'Missing name or password' });
        result.failed++;
        continue;
      }

      const entry: LoginEntry = {
        type: PasswordEntryType.Login,
        title: name,
        username: username || '',
        password: password,
        url: url || undefined,
        notes: extra || undefined,
        tags: grouping ? [grouping] : undefined,
        favorite: fav === '1',
        createdAt: new Date(),
        lastModified: new Date(),
      };

      result.entries.push(entry);
      result.success++;
    }
  } catch (error) {
    result.errors.push({
      line: 0,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    });
  }

  return result;
}

/**
 * Import from generic CSV with custom field mapping
 */
export function importFromGenericCSV(csvText: string, mapping: CSVFieldMapping): ImportResult {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    entries: [],
    errors: [],
  };

  try {
    const rows = parseCSV(csvText);

    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      const title = mapping.title !== undefined ? row[mapping.title] : '';
      const username = mapping.username !== undefined ? row[mapping.username] : '';
      const password = mapping.password !== undefined ? row[mapping.password] : '';
      const url = mapping.url !== undefined ? row[mapping.url] : '';
      const notes = mapping.notes !== undefined ? row[mapping.notes] : '';
      const category = mapping.category !== undefined ? row[mapping.category] : '';
      const favorite = mapping.favorite !== undefined ? row[mapping.favorite] : '';

      if (!title || !password) {
        result.errors.push({ line: i + 1, error: 'Missing title or password' });
        result.failed++;
        continue;
      }

      const entry: LoginEntry = {
        type: PasswordEntryType.Login,
        title: title,
        username: username || '',
        password: password,
        url: url || undefined,
        notes: notes || undefined,
        tags: category ? [category] : undefined,
        favorite: favorite === '1' || favorite.toLowerCase() === 'true',
        createdAt: new Date(),
        lastModified: new Date(),
      };

      result.entries.push(entry);
      result.success++;
    }
  } catch (error) {
    result.errors.push({
      line: 0,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    });
  }

  return result;
}

/**
 * Import from Lockbox JSON format (native format)
 */
export function importFromLockboxJSON(jsonText: string): ImportResult {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    entries: [],
    errors: [],
  };

  try {
    const data = JSON.parse(jsonText);

    if (!data.entries || !Array.isArray(data.entries)) {
      result.errors.push({ line: 0, error: 'Invalid Lockbox JSON format' });
      return result;
    }

    for (let i = 0; i < data.entries.length; i++) {
      const entry = data.entries[i];

      // Restore Date objects
      if (entry.createdAt) {
        entry.createdAt = new Date(entry.createdAt);
      }
      if (entry.lastModified) {
        entry.lastModified = new Date(entry.lastModified);
      }

      result.entries.push(entry as PasswordEntry);
      result.success++;
    }
  } catch (error) {
    result.errors.push({
      line: 0,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    });
  }

  return result;
}

/**
 * Auto-detect import format from file content
 */
export function detectImportFormat(content: string): ImportFormat | null {
  // Try JSON first
  try {
    const data = JSON.parse(content);
    if (data.entries && Array.isArray(data.entries)) {
      return ImportFormat.LockboxJSON;
    }
  } catch {
    // Not JSON, continue
  }

  // Check CSV headers
  const firstLine = content.split('\n')[0].toLowerCase();

  if (firstLine.includes('login_uri') && firstLine.includes('login_username')) {
    return ImportFormat.Bitwarden;
  }

  if (firstLine.includes('url') && firstLine.includes('extra') && firstLine.includes('grouping')) {
    return ImportFormat.LastPass;
  }

  if (firstLine.includes('title') && firstLine.includes('username') && firstLine.includes('password')) {
    return ImportFormat.OnePassword;
  }

  // Default to generic CSV if it looks like CSV
  if (firstLine.includes(',')) {
    return ImportFormat.GenericCSV;
  }

  return null;
}

/**
 * Import passwords from file content
 */
export function importPasswords(
  content: string,
  format: ImportFormat,
  mapping?: CSVFieldMapping
): ImportResult {
  switch (format) {
    case ImportFormat.OnePassword:
      return importFromOnePassword(content);
    case ImportFormat.Bitwarden:
      return importFromBitwarden(content);
    case ImportFormat.LastPass:
      return importFromLastPass(content);
    case ImportFormat.LockboxJSON:
      return importFromLockboxJSON(content);
    case ImportFormat.GenericCSV:
      if (!mapping) {
        throw new Error('Generic CSV requires field mapping');
      }
      return importFromGenericCSV(content, mapping);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Export passwords to CSV format
 */
export function exportToCSV(entries: PasswordEntry[], options: ExportOptions = { format: 'csv' }): string {
  const rows: string[][] = [];

  // Header
  rows.push(['Title', 'Username', 'Password', 'URL', 'Notes', 'Type', 'Category', 'Favorite', 'Tags']);

  for (const entry of entries) {
    // Apply filters
    if (options.includeArchived === false && entry.archived) {
      continue;
    }
    if (options.includeFavorites !== undefined && entry.favorite !== options.includeFavorites) {
      continue;
    }
    if (options.categories && entry.category && !options.categories.includes(entry.category)) {
      continue;
    }

    // Only export login entries to CSV (other types need different formats)
    if (entry.type !== PasswordEntryType.Login) {
      continue;
    }

    const loginEntry = entry as LoginEntry;

    // SECURITY: Sanitize fields before export to prevent CSV injection
    const sanitizedRow = [
      `"${sanitizeCSVField(loginEntry.title).replace(/"/g, '""')}"`,
      `"${sanitizeCSVField(loginEntry.username).replace(/"/g, '""')}"`,
      `"${sanitizeCSVField(loginEntry.password).replace(/"/g, '""')}"`,
      `"${sanitizeCSVField(loginEntry.url || '').replace(/"/g, '""')}"`,
      `"${sanitizeCSVField(loginEntry.notes || '').replace(/"/g, '""')}"`,
      'login',
      `${loginEntry.category || ''}`,
      `${loginEntry.favorite ? '1' : '0'}`,
      `"${sanitizeCSVField((loginEntry.tags || []).join(', ')).replace(/"/g, '""')}"`,
    ];

    rows.push(sanitizedRow);
  }

  return rows.map((row) => row.join(',')).join('\n');
}

/**
 * Export passwords to Lockbox JSON format (with full metadata)
 */
export function exportToJSON(entries: PasswordEntry[], options: ExportOptions = { format: 'json' }): string {
  const filteredEntries: PasswordEntry[] = [];

  for (const entry of entries) {
    // Apply filters
    if (options.includeArchived === false && entry.archived) {
      continue;
    }
    if (options.includeFavorites !== undefined && entry.favorite !== options.includeFavorites) {
      continue;
    }
    if (options.categories && entry.category && !options.categories.includes(entry.category)) {
      continue;
    }

    filteredEntries.push(entry);
  }

  const exportData = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    totalEntries: filteredEntries.length,
    entries: filteredEntries,
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export passwords based on format
 */
export function exportPasswords(entries: PasswordEntry[], options: ExportOptions): string {
  if (options.format === 'csv') {
    return exportToCSV(entries, options);
  } else {
    return exportToJSON(entries, options);
  }
}

/**
 * Download exported data as file
 */
export function downloadExport(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
