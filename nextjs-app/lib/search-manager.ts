/**
 * Encrypted Search Manager with Blind Indexes
 *
 * Implements searchable encryption using blind index hashes. This allows
 * searching through password entries without decrypting them, maintaining
 * zero-knowledge security while providing fast search capabilities.
 *
 * ## Blind Index Approach
 *
 * 1. **Search Key Derivation**: Separate key derived from wallet signature
 * 2. **HMAC Hashing**: Generate HMAC-SHA256 of searchable fields
 * 3. **Token Generation**: Create search tokens (exact, prefix, trigrams)
 * 4. **Client-Side Matching**: Match query hashes against stored hashes
 * 5. **Selective Decryption**: Only decrypt matched entries
 *
 * ## Security Properties
 *
 * - **Zero-Knowledge**: Server/blockchain never sees plaintext
 * - **Forward Security**: Search key rotation supported
 * - **Typo Tolerance**: Trigram matching handles misspellings
 * - **Prefix Search**: Supports autocomplete functionality
 *
 * ## Performance
 *
 * - O(1) hash generation and lookup
 * - No decryption needed for non-matches
 * - Parallel search token generation
 * - Efficient for vaults with 1000+ entries
 *
 * @module search-manager
 */

// TODO: Re-enable when hkdf is implemented in crypto.ts
// import { hkdf } from './crypto';

/**
 * Search result with relevance scoring
 */
export interface SearchResult {
  entryId: number;
  score: number;        // Relevance score (higher = better match)
  matchedFields: string[]; // Which fields matched (title, url, username)
}

/**
 * Blind index entry stored alongside password entries
 */
export interface BlindIndexEntry {
  entryId: number;
  titleHashes: string[];     // Multiple hashes for fuzzy matching
  urlHashes: string[];       // URL and domain hashes
  usernameHashes: string[];  // Username hashes
  keywordHashes: string[];   // Additional keywords
}

/**
 * Search configuration options
 */
export interface SearchOptions {
  fields?: ('title' | 'url' | 'username' | 'keywords')[];
  fuzzy?: boolean;          // Enable fuzzy matching (default: true)
  caseSensitive?: boolean;  // Case-sensitive search (default: false)
  maxResults?: number;      // Maximum results to return (default: 50)
  minScore?: number;        // Minimum relevance score (0-100, default: 0)
}

/**
 * Encrypted Search Manager
 *
 * Manages blind index generation and encrypted search operations.
 * All operations are client-side only - no plaintext leaves the device.
 */
export class SearchManager {
  private searchKey: Uint8Array;

  /**
   * Initialize search manager
   *
   * @param walletSignature - Wallet signature for key derivation
   *
   * @example
   * ```typescript
   * const signature = await wallet.signMessage(challenge);
   * const searchManager = await SearchManager.create(signature);
   * ```
   */
  static async create(walletSignature: Uint8Array): Promise<SearchManager> {
    const searchKey = await SearchManager.deriveSearchKey(walletSignature);
    return new SearchManager(searchKey);
  }

  private constructor(searchKey: Uint8Array) {
    this.searchKey = searchKey;
  }

  /**
   * Derive search key from wallet signature
   *
   * Uses HKDF with dedicated info string to derive a separate key for
   * search operations, isolated from encryption keys.
   *
   * @param walletSignature - Wallet signature (64 bytes)
   * @returns Search key (32 bytes)
   */
  private static async deriveSearchKey(
    walletSignature: Uint8Array
  ): Promise<Uint8Array> {
    // TODO: Implement proper HKDF-based key derivation
    // For now, use SHA-256 as a temporary solution
    const info = new TextEncoder().encode('lockbox-search-key-v1');
    const combined = new Uint8Array(walletSignature.length + info.length);
    combined.set(walletSignature);
    combined.set(info, walletSignature.length);

    const hash = await crypto.subtle.digest('SHA-256', combined);
    return new Uint8Array(hash);
  }

  /**
   * Generate blind index hashes for a password entry
   *
   * Creates multiple hash variants for fuzzy and prefix matching.
   * These hashes are stored on-chain alongside the encrypted entry.
   *
   * @param entryId - Entry ID
   * @param fields - Plaintext searchable fields
   * @returns Blind index entry with all hashes
   *
   * @example
   * ```typescript
   * const blindIndex = await searchManager.generateBlindIndex(1, {
   *   title: 'GitHub Account',
   *   url: 'https://github.com',
   *   username: 'myusername',
   *   keywords: ['development', 'code']
   * });
   * // Store blindIndex on-chain with encrypted entry
   * ```
   */
  async generateBlindIndex(
    entryId: number,
    fields: {
      title?: string;
      url?: string;
      username?: string;
      keywords?: string[];
    }
  ): Promise<BlindIndexEntry> {
    const titleHashes: string[] = [];
    const urlHashes: string[] = [];
    const usernameHashes: string[] = [];
    const keywordHashes: string[] = [];

    // Generate title hashes (exact + fuzzy)
    if (fields.title) {
      const tokens = await this.generateSearchTokens(fields.title);
      for (const token of tokens) {
        titleHashes.push(await this.hashToken(token));
      }
    }

    // Generate URL hashes (full URL + domain)
    if (fields.url) {
      const urlTokens = this.extractUrlTokens(fields.url);
      for (const token of urlTokens) {
        urlHashes.push(await this.hashToken(token));
      }
    }

    // Generate username hashes
    if (fields.username) {
      const tokens = await this.generateSearchTokens(fields.username);
      for (const token of tokens) {
        usernameHashes.push(await this.hashToken(token));
      }
    }

    // Generate keyword hashes
    if (fields.keywords) {
      for (const keyword of fields.keywords) {
        const tokens = await this.generateSearchTokens(keyword);
        for (const token of tokens) {
          keywordHashes.push(await this.hashToken(token));
        }
      }
    }

    return {
      entryId,
      titleHashes,
      urlHashes,
      usernameHashes,
      keywordHashes,
    };
  }

  /**
   * Search through blind indexes
   *
   * Matches query against blind index hashes and returns ranked results.
   * Only matched entries need to be decrypted for display.
   *
   * @param query - Search query
   * @param blindIndexes - Array of blind indexes from all entries
   * @param options - Search options
   * @returns Ranked search results
   *
   * @example
   * ```typescript
   * const results = await searchManager.search('github', allBlindIndexes, {
   *   fields: ['title', 'url'],
   *   fuzzy: true,
   *   maxResults: 10
   * });
   *
   * // Decrypt only matched entries
   * for (const result of results) {
   *   const entry = await decryptEntry(result.entryId);
   *   console.log(entry.title, '- Score:', result.score);
   * }
   * ```
   */
  async search(
    query: string,
    blindIndexes: BlindIndexEntry[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      fields = ['title', 'url', 'username', 'keywords'],
      fuzzy = true,
      caseSensitive = false,
      maxResults = 50,
      minScore = 0,
    } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    // Normalize query
    const normalizedQuery = caseSensitive ? query.trim() : query.toLowerCase().trim();

    // Generate query tokens
    const queryTokens = fuzzy
      ? await this.generateSearchTokens(normalizedQuery)
      : [normalizedQuery];

    // Hash query tokens
    const queryHashes = await Promise.all(
      queryTokens.map((token) => this.hashToken(token))
    );

    // Convert to Set for faster lookups
    const queryHashSet = new Set(queryHashes);

    // Match against blind indexes
    const matches = new Map<number, { score: number; matchedFields: Set<string> }>();

    for (const blindIndex of blindIndexes) {
      let totalScore = 0;
      const matchedFields = new Set<string>();

      // Check title hashes
      if (fields.includes('title')) {
        const titleMatches = this.countMatches(blindIndex.titleHashes, queryHashSet);
        if (titleMatches > 0) {
          totalScore += titleMatches * 10; // Title matches weighted higher
          matchedFields.add('title');
        }
      }

      // Check URL hashes
      if (fields.includes('url')) {
        const urlMatches = this.countMatches(blindIndex.urlHashes, queryHashSet);
        if (urlMatches > 0) {
          totalScore += urlMatches * 5;
          matchedFields.add('url');
        }
      }

      // Check username hashes
      if (fields.includes('username')) {
        const usernameMatches = this.countMatches(blindIndex.usernameHashes, queryHashSet);
        if (usernameMatches > 0) {
          totalScore += usernameMatches * 7;
          matchedFields.add('username');
        }
      }

      // Check keyword hashes
      if (fields.includes('keywords')) {
        const keywordMatches = this.countMatches(blindIndex.keywordHashes, queryHashSet);
        if (keywordMatches > 0) {
          totalScore += keywordMatches * 3;
          matchedFields.add('keywords');
        }
      }

      // Add to matches if score > 0
      if (totalScore > 0) {
        matches.set(blindIndex.entryId, {
          score: totalScore,
          matchedFields,
        });
      }
    }

    // Convert to results array and normalize scores
    const maxScore = Math.max(...Array.from(matches.values()).map((m) => m.score), 1);
    const results: SearchResult[] = Array.from(matches.entries()).map(
      ([entryId, { score, matchedFields }]) => ({
        entryId,
        score: Math.round((score / maxScore) * 100), // Normalize to 0-100
        matchedFields: Array.from(matchedFields),
      })
    );

    // Filter by min score
    const filtered = results.filter((r) => r.score >= minScore);

    // Sort by score (descending)
    filtered.sort((a, b) => b.score - a.score);

    // Limit results
    return filtered.slice(0, maxResults);
  }

  /**
   * Generate search tokens from a string
   *
   * Creates multiple token variants for fuzzy matching:
   * - Exact match (full string)
   * - Prefix tokens (for autocomplete)
   * - Trigrams (for typo tolerance)
   *
   * @param text - Text to tokenize
   * @returns Array of search tokens
   */
  private async generateSearchTokens(text: string): Promise<string[]> {
    const tokens = new Set<string>();
    const normalized = text.toLowerCase().trim();

    // Exact match
    tokens.add(normalized);

    // Prefix tokens (for autocomplete)
    // Generate prefixes of length 3 to full length
    for (let i = 3; i <= normalized.length; i++) {
      tokens.add(normalized.substring(0, i));
    }

    // Trigrams (for typo tolerance)
    if (normalized.length >= 3) {
      for (let i = 0; i <= normalized.length - 3; i++) {
        tokens.add(normalized.substring(i, i + 3));
      }
    }

    // Word boundaries (for multi-word search)
    const words = normalized.split(/\s+/);
    for (const word of words) {
      if (word.length >= 3) {
        tokens.add(word);
      }
    }

    return Array.from(tokens);
  }

  /**
   * Extract searchable tokens from URL
   *
   * @param url - URL string
   * @returns Array of URL tokens (domain, path segments)
   */
  private extractUrlTokens(url: string): string[] {
    const tokens: string[] = [];

    try {
      // Full URL (normalized)
      tokens.push(url.toLowerCase().trim());

      // Parse URL
      const urlObj = new URL(url);

      // Domain (with and without www)
      const hostname = urlObj.hostname.toLowerCase();
      tokens.push(hostname);
      if (hostname.startsWith('www.')) {
        tokens.push(hostname.substring(4));
      }

      // Path segments
      const pathSegments = urlObj.pathname
        .split('/')
        .filter((seg) => seg.length > 0);
      for (const segment of pathSegments) {
        if (segment.length >= 3) {
          tokens.push(segment.toLowerCase());
        }
      }

      // Second-level domain (e.g., "github" from "github.com")
      const domainParts = hostname.split('.');
      if (domainParts.length >= 2) {
        const sld = domainParts[domainParts.length - 2];
        if (sld !== 'www' && sld.length >= 3) {
          tokens.push(sld);
        }
      }
    } catch {
      // If URL parsing fails, just use the original string
      tokens.push(url.toLowerCase().trim());
    }

    return tokens;
  }

  /**
   * Hash a search token using HMAC-SHA256
   *
   * @param token - Token to hash
   * @returns Hex-encoded hash
   */
  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    // Use type assertion to work around ArrayBuffer type mismatch
    const key = await crypto.subtle.importKey(
      'raw',
      this.searchKey as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(token) as BufferSource);

    // Convert to hex string
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Count matching hashes between two sets
   *
   * @param hashes - Hashes to check
   * @param queryHashSet - Set of query hashes
   * @returns Number of matches
   */
  private countMatches(hashes: string[], queryHashSet: Set<string>): number {
    let count = 0;
    for (const hash of hashes) {
      if (queryHashSet.has(hash)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Update search key (for key rotation)
   *
   * When rotating keys, all blind indexes must be regenerated.
   *
   * @param newWalletSignature - New wallet signature
   * @returns New search manager instance
   */
  static async rotateKey(
    newWalletSignature: Uint8Array
  ): Promise<SearchManager> {
    return await SearchManager.create(newWalletSignature);
  }

  /**
   * Export search statistics
   *
   * Provides insights into search index usage and coverage.
   *
   * @param blindIndexes - All blind indexes
   * @returns Search statistics
   */
  static getStatistics(blindIndexes: BlindIndexEntry[]): {
    totalEntries: number;
    averageHashesPerEntry: number;
    totalHashes: number;
    entriesWithTitle: number;
    entriesWithUrl: number;
    entriesWithUsername: number;
    entriesWithKeywords: number;
  } {
    let totalHashes = 0;
    let entriesWithTitle = 0;
    let entriesWithUrl = 0;
    let entriesWithUsername = 0;
    let entriesWithKeywords = 0;

    for (const index of blindIndexes) {
      totalHashes +=
        index.titleHashes.length +
        index.urlHashes.length +
        index.usernameHashes.length +
        index.keywordHashes.length;

      if (index.titleHashes.length > 0) entriesWithTitle++;
      if (index.urlHashes.length > 0) entriesWithUrl++;
      if (index.usernameHashes.length > 0) entriesWithUsername++;
      if (index.keywordHashes.length > 0) entriesWithKeywords++;
    }

    return {
      totalEntries: blindIndexes.length,
      averageHashesPerEntry:
        blindIndexes.length > 0 ? Math.round(totalHashes / blindIndexes.length) : 0,
      totalHashes,
      entriesWithTitle,
      entriesWithUrl,
      entriesWithUsername,
      entriesWithKeywords,
    };
  }
}

/**
 * Client-Side Search Helpers
 *
 * These functions provide immediate client-side search functionality
 * while blind index search is being integrated with on-chain storage.
 *
 * Phase 4: Search & Intelligence
 */

import type { PasswordEntry, PasswordEntryType } from '../sdk/src/types-v2';
import { isLoginEntry } from '../sdk/src/types-v2';

/**
 * Client-side search filter options
 */
export interface ClientSearchFilters {
  entryTypes?: PasswordEntryType[];
  categories?: number[];
  favorites?: boolean;
  archived?: boolean;
  weakPasswords?: boolean;
  oldPasswords?: boolean;
}

/**
 * Client-side search result
 */
export interface ClientSearchResult {
  entry: PasswordEntry;
  score: number;
  matchedFields: string[];
}

/**
 * Calculate trigram similarity for fuzzy matching
 */
function calculateTrigramSimilarity(str1: string, str2: string): number {
  const generateTrigrams = (text: string): Set<string> => {
    const trigrams = new Set<string>();
    const normalized = text.toLowerCase().trim();
    if (normalized.length < 3) {
      trigrams.add(normalized);
      return trigrams;
    }
    for (let i = 0; i <= normalized.length - 3; i++) {
      trigrams.add(normalized.substring(i, i + 3));
    }
    return trigrams;
  };

  const trigrams1 = generateTrigrams(str1);
  const trigrams2 = generateTrigrams(str2);

  if (trigrams1.size === 0 && trigrams2.size === 0) return 1.0;
  if (trigrams1.size === 0 || trigrams2.size === 0) return 0.0;

  let matches = 0;
  for (const trigram of trigrams1) {
    if (trigrams2.has(trigram)) matches++;
  }

  const union = trigrams1.size + trigrams2.size - matches;
  return matches / union;
}

/**
 * Client-side search through decrypted password entries
 *
 * Performs fuzzy search with relevance scoring. Use this for immediate
 * search functionality while blind index integration is in progress.
 *
 * @param entries - Decrypted password entries
 * @param query - Search query
 * @param filters - Optional filters
 * @returns Ranked search results
 */
export function clientSideSearch(
  entries: PasswordEntry[],
  query: string,
  filters: ClientSearchFilters = {}
): ClientSearchResult[] {
  const queryLower = query.toLowerCase().trim();
  const results: ClientSearchResult[] = [];

  if (queryLower.length === 0) {
    return [];
  }

  for (const entry of entries) {
    // Apply filters
    if (filters.entryTypes && !filters.entryTypes.includes(entry.type)) {
      continue;
    }
    if (filters.categories && entry.category && !filters.categories.includes(entry.category)) {
      continue;
    }
    if (filters.favorites !== undefined && entry.favorite !== filters.favorites) {
      continue;
    }
    if (filters.archived !== undefined && entry.archived !== filters.archived) {
      continue;
    }
    if (filters.oldPasswords === true && entry.lastModified) {
      const daysSinceModified = (Date.now() - entry.lastModified.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceModified <= 90) continue;
    }

    // Calculate relevance score
    let score = 0;
    const matchedFields: string[] = [];

    // Title matching
    const titleLower = entry.title.toLowerCase();
    if (titleLower === queryLower) {
      score += 100;
      matchedFields.push('title (exact)');
    } else if (titleLower.includes(queryLower)) {
      score += 60;
      matchedFields.push('title');
    } else {
      const similarity = calculateTrigramSimilarity(entry.title, query);
      if (similarity > 0.5) {
        score += Math.floor(30 + similarity * 30);
        matchedFields.push('title (fuzzy)');
      }
    }

    // Login-specific fields
    if (isLoginEntry(entry)) {
      // Username
      if (entry.username.toLowerCase().includes(queryLower)) {
        score += 40;
        matchedFields.push('username');
      }

      // URL
      if (entry.url && entry.url.toLowerCase().includes(queryLower)) {
        score += 40;
        matchedFields.push('url');
      }
    }

    // Notes
    if (entry.notes && entry.notes.toLowerCase().includes(queryLower)) {
      score += 20;
      matchedFields.push('notes');
    }

    // Tags
    if (entry.tags) {
      for (const tag of entry.tags) {
        if (tag.toLowerCase().includes(queryLower)) {
          score += 30;
          matchedFields.push('tag');
          break;
        }
      }
    }

    if (score > 0) {
      results.push({ entry, score, matchedFields });
    }
  }

  // Sort by score (descending)
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Filter entries by type
 */
export function filterByType(entries: PasswordEntry[], types: PasswordEntryType[]): PasswordEntry[] {
  return entries.filter((entry) => types.includes(entry.type));
}

/**
 * Filter entries by category
 */
export function filterByCategory(entries: PasswordEntry[], categoryIds: number[]): PasswordEntry[] {
  return entries.filter((entry) => entry.category && categoryIds.includes(entry.category));
}

/**
 * Get favorite entries
 */
export function getFavorites(entries: PasswordEntry[]): PasswordEntry[] {
  return entries.filter((entry) => entry.favorite === true);
}

/**
 * Get recently accessed entries (sorted by access count and last modified)
 */
export function getRecentlyAccessed(entries: PasswordEntry[], limit: number = 10): PasswordEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const accessDiff = (b.accessCount || 0) - (a.accessCount || 0);
    if (accessDiff !== 0) return accessDiff;

    const aTime = a.lastModified?.getTime() || 0;
    const bTime = b.lastModified?.getTime() || 0;
    return bTime - aTime;
  });

  return sorted.slice(0, limit);
}

/**
 * Get old passwords (>90 days since last modified)
 */
export function getOldPasswords(entries: PasswordEntry[]): PasswordEntry[] {
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => {
    if (!entry.lastModified) return false;
    return entry.lastModified.getTime() < ninetyDaysAgo;
  });
}

/**
 * Get archived entries
 */
export function getArchived(entries: PasswordEntry[]): PasswordEntry[] {
  return entries.filter((entry) => entry.archived === true);
}
