/**
 * Import/Export Utility Tests
 * 
 * Tests for password import/export functionality including:
 * - Format detection
 * - Import from various password managers
 * - Export to CSV and JSON
 * - CSV injection protection
 * - Error handling
 */

import {
  detectImportFormat,
  importPasswords,
  exportToCSV,
  exportToJSON,
  ImportFormat,
} from '../import-export';
import { PasswordEntryType } from '../../sdk/src/types-v2';

describe('Import/Export Utilities', () => {
  describe('Format Detection', () => {
    it('should detect Lockbox JSON format', () => {
      const json = JSON.stringify({
        version: '2.0',
        entries: [],
      });
      
      const format = detectImportFormat(json);
      expect(format).toBe(ImportFormat.LockboxJSON);
    });

    it('should detect Bitwarden CSV format', () => {
      const csv = 'folder,favorite,type,name,notes,fields,login_uri,login_username,login_password';
      
      const format = detectImportFormat(csv);
      expect(format).toBe(ImportFormat.Bitwarden);
    });

    it('should detect LastPass CSV format', () => {
      const csv = 'url,username,password,extra,name,grouping,fav';
      
      const format = detectImportFormat(csv);
      expect(format).toBe(ImportFormat.LastPass);
    });

    it('should detect 1Password CSV format', () => {
      const csv = 'title,username,password,url,notes,category';
      
      const format = detectImportFormat(csv);
      expect(format).toBe(ImportFormat.OnePassword);
    });

    it('should return null for invalid format', () => {
      const invalid = 'this is not a valid format';
      
      const format = detectImportFormat(invalid);
      expect(format).toBeNull();
    });
  });

  describe('CSV Injection Protection', () => {
    it('should sanitize formula injection with = prefix', () => {
      const entries = [{
        type: PasswordEntryType.Login,
        title: '=1+1',
        username: 'user',
        password: 'pass',
        createdAt: new Date(),
        lastModified: new Date(),
      }];
      
      const csv = exportToCSV(entries, { format: 'csv' });
      
      // Should prefix = with single quote
      expect(csv).toContain("'=1+1");
    });

    it('should sanitize formula injection with + prefix', () => {
      const entries = [{
        type: PasswordEntryType.Login,
        title: 'Normal',
        username: '+1+1',
        password: 'pass',
        createdAt: new Date(),
        lastModified: new Date(),
      }];
      
      const csv = exportToCSV(entries, { format: 'csv' });
      
      expect(csv).toContain("'+1+1");
    });

    it('should sanitize formula injection with - prefix', () => {
      const entries = [{
        type: PasswordEntryType.Login,
        title: 'Normal',
        username: 'user',
        password: '-1+1',
        createdAt: new Date(),
        lastModified: new Date(),
      }];
      
      const csv = exportToCSV(entries, { format: 'csv' });
      
      expect(csv).toContain("'-1+1");
    });

    it('should sanitize formula injection with @ prefix', () => {
      const entries = [{
        type: PasswordEntryType.Login,
        title: '@SUM(1+1)',
        username: 'user',
        password: 'pass',
        createdAt: new Date(),
        lastModified: new Date(),
      }];
      
      const csv = exportToCSV(entries, { format: 'csv' });
      
      expect(csv).toContain("'@SUM(1+1)");
    });

    it('should sanitize tab-prefixed formulas', () => {
      const entries = [{
        type: PasswordEntryType.Login,
        title: '\t=1+1',
        username: 'user',
        password: 'pass',
        createdAt: new Date(),
        lastModified: new Date(),
      }];
      
      const csv = exportToCSV(entries, { format: 'csv' });
      
      expect(csv).toContain("'\t=1+1");
    });

    it('should not sanitize normal fields', () => {
      const entries = [{
        type: PasswordEntryType.Login,
        title: 'Normal Title',
        username: 'normal@example.com',
        password: 'NormalPassword123',
        createdAt: new Date(),
        lastModified: new Date(),
      }];
      
      const csv = exportToCSV(entries, { format: 'csv' });
      
      // Should not add single quote prefix
      expect(csv).not.toContain("'Normal Title");
      expect(csv).toContain('Normal Title');
    });
  });

  describe('Import from 1Password', () => {
    it('should import valid 1Password CSV', () => {
      const csv = `title,url,username,password,notes,category
GitHub,https://github.com,user@example.com,MyPassword123,My notes,Development`;
      
      const result = importPasswords(csv, ImportFormat.OnePassword);
      
      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.entries.length).toBe(1);
      expect(result.entries[0].title).toBe('GitHub');
      expect(result.entries[0].username).toBe('user@example.com');
      expect(result.entries[0].password).toBe('MyPassword123');
    });

    it('should handle missing optional fields', () => {
      const csv = `title,url,username,password,notes,category
Simple,,user,pass,,`;
      
      const result = importPasswords(csv, ImportFormat.OnePassword);
      
      expect(result.success).toBe(1);
      expect(result.entries[0].url).toBeUndefined();
      expect(result.entries[0].notes).toBeUndefined();
    });

    it('should fail for entries missing required fields', () => {
      const csv = `title,url,username,password,notes,category
,,,pass,,`;
      
      const result = importPasswords(csv, ImportFormat.OnePassword);
      
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
    });
  });

  describe('Import from Bitwarden', () => {
    it('should import valid Bitwarden CSV', () => {
      const csv = `folder,favorite,type,name,notes,fields,login_uri,login_username,login_password
Work,1,login,GitHub,My notes,,https://github.com,user@example.com,MyPassword123`;
      
      const result = importPasswords(csv, ImportFormat.Bitwarden);
      
      expect(result.success).toBe(1);
      expect(result.entries[0].title).toBe('GitHub');
      expect(result.entries[0].favorite).toBe(true);
    });

    it('should skip non-login types', () => {
      const csv = `folder,favorite,type,name,notes,fields,login_uri,login_username,login_password
,0,note,My Note,Note content,,,`;
      
      const result = importPasswords(csv, ImportFormat.Bitwarden);
      
      expect(result.success).toBe(0);
      expect(result.entries.length).toBe(0);
    });
  });

  describe('Import from LastPass', () => {
    it('should import valid LastPass CSV', () => {
      const csv = `url,username,password,extra,name,grouping,fav
https://github.com,user@example.com,MyPassword123,My notes,GitHub,Development,1`;
      
      const result = importPasswords(csv, ImportFormat.LastPass);
      
      expect(result.success).toBe(1);
      expect(result.entries[0].title).toBe('GitHub');
      expect(result.entries[0].favorite).toBe(true);
    });
  });

  describe('Import from Lockbox JSON', () => {
    it('should import valid Lockbox JSON', () => {
      const data = {
        version: '2.0',
        entries: [{
          type: PasswordEntryType.Login,
          title: 'GitHub',
          username: 'user@example.com',
          password: 'MyPassword123',
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        }],
      };
      
      const result = importPasswords(JSON.stringify(data), ImportFormat.LockboxJSON);
      
      expect(result.success).toBe(1);
      expect(result.entries[0].title).toBe('GitHub');
    });

    it('should restore Date objects from JSON', () => {
      const now = new Date();
      const data = {
        version: '2.0',
        entries: [{
          type: PasswordEntryType.Login,
          title: 'Test',
          username: 'user',
          password: 'pass',
          createdAt: now.toISOString(),
          lastModified: now.toISOString(),
        }],
      };
      
      const result = importPasswords(JSON.stringify(data), ImportFormat.LockboxJSON);
      
      expect(result.entries[0].createdAt).toBeInstanceOf(Date);
      expect(result.entries[0].lastModified).toBeInstanceOf(Date);
    });
  });

  describe('Export to CSV', () => {
    it('should export entries to CSV format', () => {
      const entries = [{
        type: PasswordEntryType.Login,
        title: 'GitHub',
        username: 'user@example.com',
        password: 'MyPassword123',
        url: 'https://github.com',
        notes: 'My notes',
        createdAt: new Date(),
        lastModified: new Date(),
      }];
      
      const csv = exportToCSV(entries, { format: 'csv' });
      
      expect(csv).toContain('Title,Username,Password');
      expect(csv).toContain('GitHub');
      expect(csv).toContain('user@example.com');
      expect(csv).toContain('MyPassword123');
    });

    it('should quote fields with special characters', () => {
      const entries = [{
        type: PasswordEntryType.Login,
        title: 'Title, with comma',
        username: 'user',
        password: 'pass',
        createdAt: new Date(),
        lastModified: new Date(),
      }];
      
      const csv = exportToCSV(entries, { format: 'csv' });
      
      expect(csv).toContain('"Title, with comma"');
    });

    it('should escape quotes in fields', () => {
      const entries = [{
        type: PasswordEntryType.Login,
        title: 'Title "quoted"',
        username: 'user',
        password: 'pass',
        createdAt: new Date(),
        lastModified: new Date(),
      }];
      
      const csv = exportToCSV(entries, { format: 'csv' });
      
      expect(csv).toContain('""quoted""');
    });

    it('should only export login entries', () => {
      const entries = [{
        type: PasswordEntryType.SecureNote,
        title: 'Note',
        notes: 'Content',
        createdAt: new Date(),
        lastModified: new Date(),
      }];
      
      const csv = exportToCSV(entries, { format: 'csv' });
      
      // Should only have header, no data rows
      const lines = csv.split('\n');
      expect(lines.length).toBe(1); // Just header
    });
  });

  describe('Export to JSON', () => {
    it('should export entries to JSON format', () => {
      const entries = [{
        type: PasswordEntryType.Login,
        title: 'GitHub',
        username: 'user@example.com',
        password: 'MyPassword123',
        createdAt: new Date(),
        lastModified: new Date(),
      }];
      
      const json = exportToJSON(entries, { format: 'json' });
      const parsed = JSON.parse(json);
      
      expect(parsed.version).toBe('2.0');
      expect(parsed.entries.length).toBe(1);
      expect(parsed.entries[0].title).toBe('GitHub');
    });

    it('should include export metadata', () => {
      const entries = [{
        type: PasswordEntryType.Login,
        title: 'Test',
        username: 'user',
        password: 'pass',
        createdAt: new Date(),
        lastModified: new Date(),
      }];
      
      const json = exportToJSON(entries, { format: 'json' });
      const parsed = JSON.parse(json);
      
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.totalEntries).toBe(1);
    });

    it('should export all entry types', () => {
      const entries = [
        {
          type: PasswordEntryType.Login,
          title: 'Login',
          username: 'user',
          password: 'pass',
          createdAt: new Date(),
          lastModified: new Date(),
        },
        {
          type: PasswordEntryType.SecureNote,
          title: 'Note',
          notes: 'Content',
          createdAt: new Date(),
          lastModified: new Date(),
        },
      ];
      
      const json = exportToJSON(entries, { format: 'json' });
      const parsed = JSON.parse(json);
      
      expect(parsed.entries.length).toBe(2);
    });
  });

  describe('Export Filtering', () => {
    it('should exclude archived entries when specified', () => {
      const entries = [
        {
          type: PasswordEntryType.Login,
          title: 'Active',
          username: 'user',
          password: 'pass',
          archived: false,
          createdAt: new Date(),
          lastModified: new Date(),
        },
        {
          type: PasswordEntryType.Login,
          title: 'Archived',
          username: 'user',
          password: 'pass',
          archived: true,
          createdAt: new Date(),
          lastModified: new Date(),
        },
      ];
      
      const csv = exportToCSV(entries, { format: 'csv', includeArchived: false });
      
      expect(csv).toContain('Active');
      expect(csv).not.toContain('Archived');
    });

    it('should filter by favorites', () => {
      const entries = [
        {
          type: PasswordEntryType.Login,
          title: 'Favorite',
          username: 'user',
          password: 'pass',
          favorite: true,
          createdAt: new Date(),
          lastModified: new Date(),
        },
        {
          type: PasswordEntryType.Login,
          title: 'NotFavorite',
          username: 'user',
          password: 'pass',
          favorite: false,
          createdAt: new Date(),
          lastModified: new Date(),
        },
      ];
      
      const csv = exportToCSV(entries, { format: 'csv', includeFavorites: true });
      
      expect(csv).toContain('Favorite');
      expect(csv).not.toContain('NotFavorite');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed CSV gracefully', () => {
      const csv = 'title,url,username,password\nBroken CSV with"unclosed quote';
      
      const result = importPasswords(csv, ImportFormat.OnePassword);
      
      // Should not throw, might have errors
      expect(result).toBeDefined();
    });

    it('should track line-by-line errors', () => {
      const csv = `title,url,username,password
Valid,https://example.com,user,pass
,,missing,fields`;
      
      const result = importPasswords(csv, ImportFormat.OnePassword);
      
      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].line).toBe(3);
    });

    it('should handle invalid JSON gracefully', () => {
      const invalid = '{not valid json]';
      
      const result = importPasswords(invalid, ImportFormat.LockboxJSON);
      
      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
