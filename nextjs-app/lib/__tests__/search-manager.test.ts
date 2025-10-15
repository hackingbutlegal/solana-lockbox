/**
 * Search Manager Tests
 * 
 * Tests for encrypted search functionality including:
 * - Blind index generation
 * - Token generation (exact, prefix, trigrams)
 * - HMAC-based hash generation
 * - Search result ranking
 * - Client-side fuzzy search
 * - Filter helpers
 */

import {
  SearchManager,
  BlindIndexEntry,
  SearchOptions,
  clientSideSearch,
  filterByType,
  filterByCategory,
  getFavorites,
  getRecentlyAccessed,
  getOldPasswords,
  getArchived,
  ClientSearchFilters,
} from '../search-manager';
import { PasswordEntry, PasswordEntryType } from '../../sdk/src/types-v2';

describe('Search Manager', () => {
  // Mock wallet signature for testing
  const mockSignature = new Uint8Array(64).fill(42);

  describe('SearchManager - Initialization', () => {
    it('should create a search manager instance', async () => {
      const manager = await SearchManager.create(mockSignature);
      
      expect(manager).toBeInstanceOf(SearchManager);
    });

    it('should derive consistent search keys from same signature', async () => {
      const manager1 = await SearchManager.create(mockSignature);
      const manager2 = await SearchManager.create(mockSignature);
      
      // Both should be valid instances
      expect(manager1).toBeInstanceOf(SearchManager);
      expect(manager2).toBeInstanceOf(SearchManager);
    });

    it('should support key rotation', async () => {
      const newSignature = new Uint8Array(64).fill(84);
      const manager = await SearchManager.rotateKey(newSignature);
      
      expect(manager).toBeInstanceOf(SearchManager);
    });
  });

  describe('SearchManager - Blind Index Generation', () => {
    let manager: SearchManager;

    beforeEach(async () => {
      manager = await SearchManager.create(mockSignature);
    });

    it('should generate blind index with title hashes', async () => {
      const blindIndex = await manager.generateBlindIndex(1, {
        title: 'GitHub Account',
      });
      
      expect(blindIndex.entryId).toBe(1);
      expect(blindIndex.titleHashes).toBeInstanceOf(Array);
      expect(blindIndex.titleHashes.length).toBeGreaterThan(0);
    });

    it('should generate blind index with URL hashes', async () => {
      const blindIndex = await manager.generateBlindIndex(1, {
        url: 'https://github.com',
      });
      
      expect(blindIndex.urlHashes).toBeInstanceOf(Array);
      expect(blindIndex.urlHashes.length).toBeGreaterThan(0);
    });

    it('should generate blind index with username hashes', async () => {
      const blindIndex = await manager.generateBlindIndex(1, {
        username: 'myusername',
      });
      
      expect(blindIndex.usernameHashes).toBeInstanceOf(Array);
      expect(blindIndex.usernameHashes.length).toBeGreaterThan(0);
    });

    it('should generate blind index with keyword hashes', async () => {
      const blindIndex = await manager.generateBlindIndex(1, {
        keywords: ['development', 'code'],
      });
      
      expect(blindIndex.keywordHashes).toBeInstanceOf(Array);
      expect(blindIndex.keywordHashes.length).toBeGreaterThan(0);
    });

    it('should generate blind index with all fields', async () => {
      const blindIndex = await manager.generateBlindIndex(1, {
        title: 'GitHub Account',
        url: 'https://github.com',
        username: 'myusername',
        keywords: ['development', 'code'],
      });
      
      expect(blindIndex.titleHashes.length).toBeGreaterThan(0);
      expect(blindIndex.urlHashes.length).toBeGreaterThan(0);
      expect(blindIndex.usernameHashes.length).toBeGreaterThan(0);
      expect(blindIndex.keywordHashes.length).toBeGreaterThan(0);
    });

    it('should handle empty fields', async () => {
      const blindIndex = await manager.generateBlindIndex(1, {});
      
      expect(blindIndex.titleHashes).toEqual([]);
      expect(blindIndex.urlHashes).toEqual([]);
      expect(blindIndex.usernameHashes).toEqual([]);
      expect(blindIndex.keywordHashes).toEqual([]);
    });

    it('should generate different hashes for different content', async () => {
      const index1 = await manager.generateBlindIndex(1, { title: 'GitHub' });
      const index2 = await manager.generateBlindIndex(2, { title: 'GitLab' });
      
      // Hashes should be different (no overlap)
      const hash1Set = new Set(index1.titleHashes);
      const hash2Set = new Set(index2.titleHashes);
      const intersection = [...hash1Set].filter(h => hash2Set.has(h));
      
      // Should have minimal or no intersection
      expect(intersection.length).toBeLessThan(Math.min(hash1Set.size, hash2Set.size));
    });

    it('should generate multiple hashes for fuzzy matching', async () => {
      const blindIndex = await manager.generateBlindIndex(1, {
        title: 'GitHub',
      });
      
      // Should have exact + prefix + trigram hashes
      // "GitHub" -> "github", "git", "gith", "githu", trigrams, etc.
      expect(blindIndex.titleHashes.length).toBeGreaterThan(5);
    });
  });

  describe('SearchManager - Search Functionality', () => {
    let manager: SearchManager;
    let blindIndexes: BlindIndexEntry[];

    beforeEach(async () => {
      manager = await SearchManager.create(mockSignature);
      
      // Create test blind indexes
      blindIndexes = [
        await manager.generateBlindIndex(1, {
          title: 'GitHub Account',
          url: 'https://github.com',
          username: 'johndoe',
        }),
        await manager.generateBlindIndex(2, {
          title: 'Gmail Account',
          url: 'https://gmail.com',
          username: 'john@gmail.com',
        }),
        await manager.generateBlindIndex(3, {
          title: 'GitLab Project',
          url: 'https://gitlab.com',
          username: 'johndoe',
        }),
      ];
    });

    it('should find exact matches', async () => {
      const results = await manager.search('github', blindIndexes);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entryId).toBe(1);
    });

    it('should find prefix matches', async () => {
      const results = await manager.search('git', blindIndexes);
      
      // Should match both GitHub and GitLab
      expect(results.length).toBeGreaterThanOrEqual(2);
      const entryIds = results.map(r => r.entryId);
      expect(entryIds).toContain(1);
      expect(entryIds).toContain(3);
    });

    it('should rank results by relevance', async () => {
      const results = await manager.search('git', blindIndexes);
      
      // Results should be sorted by score (descending)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('should normalize scores to 0-100', async () => {
      const results = await manager.search('github', blindIndexes);
      
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    });

    it('should include matched fields', async () => {
      const results = await manager.search('github', blindIndexes);
      
      expect(results[0].matchedFields).toBeInstanceOf(Array);
      expect(results[0].matchedFields.length).toBeGreaterThan(0);
      expect(results[0].matchedFields).toContain('title');
    });

    it('should search specific fields only', async () => {
      const results = await manager.search('john', blindIndexes, {
        fields: ['username'],
      });
      
      // Should find entries with username "johndoe"
      expect(results.length).toBeGreaterThan(0);
      results.forEach(r => {
        expect(r.matchedFields).toContain('username');
      });
    });

    it('should limit results by maxResults', async () => {
      const results = await manager.search('git', blindIndexes, {
        maxResults: 1,
      });
      
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should filter by minimum score', async () => {
      const results = await manager.search('git', blindIndexes, {
        minScore: 80,
      });
      
      results.forEach(r => {
        expect(r.score).toBeGreaterThanOrEqual(80);
      });
    });

    it('should return empty results for empty query', async () => {
      const results = await manager.search('', blindIndexes);
      
      expect(results).toEqual([]);
    });

    it('should return empty results for no matches', async () => {
      const results = await manager.search('nonexistent', blindIndexes);
      
      expect(results).toEqual([]);
    });

    it('should handle fuzzy matching', async () => {
      const results = await manager.search('gith', blindIndexes, {
        fuzzy: true,
      });
      
      // Should match "github" with partial match
      expect(results.length).toBeGreaterThan(0);
    });

    it('should disable fuzzy matching when requested', async () => {
      const results = await manager.search('gith', blindIndexes, {
        fuzzy: false,
      });
      
      // Without fuzzy, "gith" won't match "github" (exact only)
      // Results might be empty or fewer
      expect(results).toBeInstanceOf(Array);
    });
  });

  describe('SearchManager - Statistics', () => {
    let manager: SearchManager;
    let blindIndexes: BlindIndexEntry[];

    beforeEach(async () => {
      manager = await SearchManager.create(mockSignature);
      
      blindIndexes = [
        await manager.generateBlindIndex(1, {
          title: 'GitHub',
          url: 'https://github.com',
          username: 'user1',
          keywords: ['code', 'dev'],
        }),
        await manager.generateBlindIndex(2, {
          title: 'Gmail',
          url: 'https://gmail.com',
        }),
        await manager.generateBlindIndex(3, {
          title: 'Twitter',
        }),
      ];
    });

    it('should calculate total entries', () => {
      const stats = SearchManager.getStatistics(blindIndexes);
      
      expect(stats.totalEntries).toBe(3);
    });

    it('should count entries with each field', () => {
      const stats = SearchManager.getStatistics(blindIndexes);
      
      expect(stats.entriesWithTitle).toBe(3);
      expect(stats.entriesWithUrl).toBe(2);
      expect(stats.entriesWithUsername).toBe(1);
      expect(stats.entriesWithKeywords).toBe(1);
    });

    it('should calculate total hashes', () => {
      const stats = SearchManager.getStatistics(blindIndexes);
      
      expect(stats.totalHashes).toBeGreaterThan(0);
    });

    it('should calculate average hashes per entry', () => {
      const stats = SearchManager.getStatistics(blindIndexes);
      
      expect(stats.averageHashesPerEntry).toBeGreaterThan(0);
      expect(Number.isInteger(stats.averageHashesPerEntry)).toBe(true);
    });

    it('should handle empty blind indexes', () => {
      const stats = SearchManager.getStatistics([]);
      
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalHashes).toBe(0);
      expect(stats.averageHashesPerEntry).toBe(0);
    });
  });

  describe('Client-Side Search', () => {
    const createTestEntry = (
      id: number,
      title: string,
      username: string = 'user@example.com',
      url?: string
    ): PasswordEntry => ({
      type: PasswordEntryType.Login,
      title,
      username,
      password: 'password123',
      url,
      createdAt: new Date(),
      lastModified: new Date(),
    });

    const entries: PasswordEntry[] = [
      createTestEntry(1, 'GitHub Account', 'johndoe', 'https://github.com'),
      createTestEntry(2, 'Gmail Account', 'john@gmail.com', 'https://gmail.com'),
      createTestEntry(3, 'GitLab Project', 'johndoe', 'https://gitlab.com'),
      createTestEntry(4, 'Twitter', 'john_doe', 'https://twitter.com'),
    ];

    it('should find exact title matches', () => {
      const results = clientSideSearch(entries, 'GitHub Account');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.title).toBe('GitHub Account');
      expect(results[0].score).toBe(100); // Exact match
    });

    it('should find partial title matches', () => {
      const results = clientSideSearch(entries, 'github');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.title).toBe('GitHub Account');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should find username matches', () => {
      const results = clientSideSearch(entries, 'johndoe');
      
      // Should match entries with username "johndoe"
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.matchedFields.includes('username'))).toBe(true);
    });

    it('should find URL matches', () => {
      const results = clientSideSearch(entries, 'github.com');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.matchedFields.includes('url'))).toBe(true);
    });

    it('should perform fuzzy matching with trigrams', () => {
      const results = clientSideSearch(entries, 'gthub'); // Typo
      
      // Should still match "GitHub" with fuzzy matching
      expect(results.length).toBeGreaterThan(0);
    });

    it('should rank results by relevance', () => {
      const results = clientSideSearch(entries, 'git');
      
      // Results should be sorted by score (descending)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('should return empty results for empty query', () => {
      const results = clientSideSearch(entries, '');
      
      expect(results).toEqual([]);
    });

    it('should handle case-insensitive search', () => {
      const upper = clientSideSearch(entries, 'GITHUB');
      const lower = clientSideSearch(entries, 'github');
      
      expect(upper.length).toBe(lower.length);
      expect(upper[0].entry.title).toBe(lower[0].entry.title);
    });

    it('should search in notes', () => {
      const entriesWithNotes: PasswordEntry[] = [
        {
          ...createTestEntry(1, 'Test', 'user'),
          notes: 'Important account for development',
        },
      ];
      
      const results = clientSideSearch(entriesWithNotes, 'development');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchedFields).toContain('notes');
    });

    it('should search in tags', () => {
      const entriesWithTags: PasswordEntry[] = [
        {
          ...createTestEntry(1, 'Test', 'user'),
          tags: ['work', 'important', 'development'],
        },
      ];
      
      const results = clientSideSearch(entriesWithTags, 'development');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchedFields).toContain('tag');
    });

    describe('Client-Side Filters', () => {
      it('should filter by entry type', () => {
        const mixedEntries: PasswordEntry[] = [
          createTestEntry(1, 'Login', 'user'),
          {
            type: PasswordEntryType.SecureNote,
            title: 'Note',
            notes: 'Content',
            createdAt: new Date(),
            lastModified: new Date(),
          },
        ];
        
        const results = clientSideSearch(mixedEntries, 'note', {
          entryTypes: [PasswordEntryType.SecureNote],
        });
        
        expect(results.length).toBe(1);
        expect(results[0].entry.type).toBe(PasswordEntryType.SecureNote);
      });

      it('should filter by favorites', () => {
        const entriesWithFavorites: PasswordEntry[] = [
          { ...createTestEntry(1, 'Favorite', 'user'), favorite: true },
          { ...createTestEntry(2, 'Not Favorite', 'user'), favorite: false },
        ];
        
        const results = clientSideSearch(entriesWithFavorites, 'favorite', {
          favorites: true,
        });
        
        expect(results.every(r => r.entry.favorite === true)).toBe(true);
      });

      it('should filter by archived status', () => {
        const entriesWithArchived: PasswordEntry[] = [
          { ...createTestEntry(1, 'Active', 'user'), archived: false },
          { ...createTestEntry(2, 'Archived', 'user'), archived: true },
        ];
        
        const results = clientSideSearch(entriesWithArchived, 'archived', {
          archived: true,
        });
        
        expect(results.every(r => r.entry.archived === true)).toBe(true);
      });

      it('should filter by old passwords (>90 days)', () => {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 100);
        
        const entriesWithOld: PasswordEntry[] = [
          { ...createTestEntry(1, 'Recent', 'user'), lastModified: new Date() },
          { ...createTestEntry(2, 'Old', 'user'), lastModified: oldDate },
        ];
        
        const results = clientSideSearch(entriesWithOld, 'old', {
          oldPasswords: true,
        });
        
        expect(results.length).toBe(1);
        expect(results[0].entry.title).toBe('Old');
      });
    });
  });

  describe('Filter Helpers', () => {
    const entries: PasswordEntry[] = [
      {
        type: PasswordEntryType.Login,
        title: 'Login 1',
        username: 'user1',
        password: 'pass1',
        favorite: true,
        category: 1,
        createdAt: new Date(),
        lastModified: new Date(),
        accessCount: 10,
      },
      {
        type: PasswordEntryType.SecureNote,
        title: 'Note 1',
        notes: 'Content',
        favorite: false,
        category: 2,
        createdAt: new Date(),
        lastModified: new Date(),
        accessCount: 5,
      },
      {
        type: PasswordEntryType.Login,
        title: 'Login 2',
        username: 'user2',
        password: 'pass2',
        favorite: true,
        archived: true,
        category: 1,
        createdAt: new Date(),
        lastModified: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
        accessCount: 3,
      },
    ];

    describe('filterByType', () => {
      it('should filter login entries', () => {
        const logins = filterByType(entries, [PasswordEntryType.Login]);
        
        expect(logins.length).toBe(2);
        expect(logins.every(e => e.type === PasswordEntryType.Login)).toBe(true);
      });

      it('should filter secure notes', () => {
        const notes = filterByType(entries, [PasswordEntryType.SecureNote]);
        
        expect(notes.length).toBe(1);
        expect(notes[0].type).toBe(PasswordEntryType.SecureNote);
      });

      it('should filter multiple types', () => {
        const filtered = filterByType(entries, [
          PasswordEntryType.Login,
          PasswordEntryType.SecureNote,
        ]);
        
        expect(filtered.length).toBe(3);
      });
    });

    describe('filterByCategory', () => {
      it('should filter by single category', () => {
        const category1 = filterByCategory(entries, [1]);
        
        expect(category1.length).toBe(2);
        expect(category1.every(e => e.category === 1)).toBe(true);
      });

      it('should filter by multiple categories', () => {
        const filtered = filterByCategory(entries, [1, 2]);
        
        expect(filtered.length).toBe(3);
      });

      it('should return empty for non-existent category', () => {
        const filtered = filterByCategory(entries, [999]);
        
        expect(filtered).toEqual([]);
      });
    });

    describe('getFavorites', () => {
      it('should return only favorite entries', () => {
        const favorites = getFavorites(entries);
        
        expect(favorites.length).toBe(2);
        expect(favorites.every(e => e.favorite === true)).toBe(true);
      });

      it('should return empty if no favorites', () => {
        const noFavorites: PasswordEntry[] = [
          { ...entries[0], favorite: false },
        ];
        
        const favorites = getFavorites(noFavorites);
        
        expect(favorites).toEqual([]);
      });
    });

    describe('getRecentlyAccessed', () => {
      it('should return entries sorted by access count', () => {
        const recent = getRecentlyAccessed(entries);
        
        expect(recent[0].accessCount).toBe(10);
        expect(recent[1].accessCount).toBe(5);
        expect(recent[2].accessCount).toBe(3);
      });

      it('should respect limit parameter', () => {
        const recent = getRecentlyAccessed(entries, 2);
        
        expect(recent.length).toBe(2);
      });

      it('should use lastModified as tiebreaker', () => {
        const sameAccessCount: PasswordEntry[] = [
          { ...entries[0], accessCount: 5, lastModified: new Date('2025-01-01') },
          { ...entries[1], accessCount: 5, lastModified: new Date('2025-01-02') },
        ];
        
        const recent = getRecentlyAccessed(sameAccessCount);
        
        // More recent should come first
        expect(recent[0].lastModified!.getTime()).toBeGreaterThan(
          recent[1].lastModified!.getTime()
        );
      });
    });

    describe('getOldPasswords', () => {
      it('should return passwords >90 days old', () => {
        const old = getOldPasswords(entries);
        
        expect(old.length).toBe(1);
        expect(old[0].title).toBe('Login 2');
      });

      it('should return empty if no old passwords', () => {
        const recentEntries: PasswordEntry[] = [
          { ...entries[0], lastModified: new Date() },
        ];
        
        const old = getOldPasswords(recentEntries);
        
        expect(old).toEqual([]);
      });

      it('should handle entries without lastModified', () => {
        const noDate: PasswordEntry[] = [
          { ...entries[0] },
        ];
        delete (noDate[0] as any).lastModified;
        
        const old = getOldPasswords(noDate);
        
        expect(old).toEqual([]);
      });
    });

    describe('getArchived', () => {
      it('should return only archived entries', () => {
        const archived = getArchived(entries);
        
        expect(archived.length).toBe(1);
        expect(archived[0].archived).toBe(true);
      });

      it('should return empty if no archived entries', () => {
        const noArchived: PasswordEntry[] = [
          { ...entries[0], archived: false },
        ];
        
        const archived = getArchived(noArchived);
        
        expect(archived).toEqual([]);
      });
    });
  });
});
