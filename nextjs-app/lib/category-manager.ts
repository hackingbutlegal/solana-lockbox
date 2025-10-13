/**
 * Category Manager
 *
 * Client-side utility for managing password categories with encryption.
 * Categories help organize password entries and are tier-gated (Basic+).
 *
 * Features:
 * - Client-side category name encryption
 * - Hierarchical category support (parent/child relationships)
 * - Color and icon customization
 * - Entry count tracking
 * - Default category templates
 *
 * Security Notes:
 * - Category names are encrypted client-side before on-chain storage
 * - Uses same session key as password encryption for consistency
 * - Category IDs (u8) are unencrypted for efficient indexing
 */

import { encryptAEAD, decryptAEAD } from './crypto';

// Wrapper functions to adapt AEAD API for simple encrypt/decrypt
async function encryptData(text: string, sessionKey: Uint8Array): Promise<Uint8Array> {
  const plaintext = new TextEncoder().encode(text);
  const { ciphertext, nonce, salt } = encryptAEAD(plaintext, sessionKey);

  // Concatenate nonce + ciphertext for storage (we'll use fixed salt from session)
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);

  return combined;
}

async function decryptData(encryptedData: Uint8Array, sessionKey: Uint8Array): Promise<string> {
  // Extract nonce and ciphertext
  const nonce = encryptedData.slice(0, 24); // NONCE_SIZE = 24
  const ciphertext = encryptedData.slice(24);

  const plaintext = decryptAEAD(ciphertext, nonce, sessionKey);
  return new TextDecoder().decode(plaintext);
}

export interface Category {
  id: number;
  name: string;           // Decrypted name (client-side only)
  nameEncrypted: Uint8Array;  // Encrypted name (stored on-chain)
  icon: number;           // Icon identifier (0-255)
  color: number;          // Color code (0-15)
  parentId: number | null; // Parent category for hierarchy
  entryCount: number;     // Number of entries in this category
  createdAt: number;      // Unix timestamp
  lastModified: number;   // Unix timestamp
  flags: number;          // Category flags (favorite, archived, etc.)
}

export interface CategoryTemplate {
  name: string;
  icon: number;
  color: number;
}

/**
 * Category Manager
 *
 * Manages password categories with client-side encryption. All category
 * names are encrypted before being stored on-chain.
 */
export class CategoryManager {
  /**
   * Default category templates
   *
   * These are pre-defined categories that users can optionally create.
   * Icons and colors are mapped to a visual theme client-side.
   */
  static readonly DEFAULT_TEMPLATES: CategoryTemplate[] = [
    { name: 'Personal', icon: 0, color: 1 },      // Blue
    { name: 'Work', icon: 1, color: 2 },          // Green
    { name: 'Financial', icon: 2, color: 3 },     // Yellow
    { name: 'Social Media', icon: 3, color: 4 },  // Purple
    { name: 'Shopping', icon: 4, color: 5 },      // Orange
    { name: 'Entertainment', icon: 5, color: 6 }, // Pink
    { name: 'Development', icon: 6, color: 7 },   // Cyan
    { name: 'Education', icon: 7, color: 8 },     // Teal
  ];

  /**
   * Color palette for categories
   *
   * Maps color codes (0-15) to hex colors for UI rendering.
   */
  static readonly COLOR_PALETTE: Record<number, string> = {
    0: '#6B7280', // Gray
    1: '#3B82F6', // Blue
    2: '#10B981', // Green
    3: '#F59E0B', // Yellow
    4: '#8B5CF6', // Purple
    5: '#F97316', // Orange
    6: '#EC4899', // Pink
    7: '#06B6D4', // Cyan
    8: '#14B8A6', // Teal
    9: '#EF4444', // Red
    10: '#84CC16', // Lime
    11: '#6366F1', // Indigo
    12: '#F43F5E', // Rose
    13: '#A855F7', // Violet
    14: '#0EA5E9', // Sky
    15: '#64748B', // Slate
  };

  /**
   * Icon mappings
   *
   * Maps icon codes (0-255) to icon names or emoji for UI rendering.
   */
  static readonly ICON_MAP: Record<number, string> = {
    0: '👤', // Personal
    1: '💼', // Work
    2: '💰', // Financial
    3: '📱', // Social Media
    4: '🛒', // Shopping
    5: '🎬', // Entertainment
    6: '💻', // Development
    7: '📚', // Education
    8: '🏠', // Home
    9: '🏥', // Health
    10: '🚗', // Travel
    11: '🎮', // Gaming
    12: '🍕', // Food
    13: '🎵', // Music
    14: '📧', // Email
    15: '🔒', // Security
    // Add more as needed up to 255
  };

  /**
   * Encrypt a category name
   *
   * Uses the same session key as password encryption for consistency.
   * Maximum encrypted size is 64 bytes (enforced on-chain).
   *
   * @param name - Category name to encrypt
   * @param sessionKey - Session encryption key
   * @returns Encrypted category name (max 64 bytes)
   * @throws Error if encrypted data exceeds 64 bytes
   *
   * @example
   * ```typescript
   * const sessionKey = await deriveSessionKey(walletSignature);
   * const encrypted = await CategoryManager.encryptName('Work', sessionKey);
   * ```
   */
  static async encryptName(
    name: string,
    sessionKey: Uint8Array
  ): Promise<Uint8Array> {
    if (!name || name.trim().length === 0) {
      throw new Error('Category name cannot be empty');
    }

    if (name.length > 50) {
      throw new Error('Category name too long (max 50 characters)');
    }

    const encrypted = await encryptData(name, sessionKey);

    // Verify encrypted size doesn't exceed on-chain limit
    if (encrypted.length > 64) {
      throw new Error(
        `Encrypted category name exceeds maximum size (${encrypted.length}/64 bytes)`
      );
    }

    return encrypted;
  }

  /**
   * Decrypt a category name
   *
   * @param encryptedName - Encrypted category name from on-chain
   * @param sessionKey - Session encryption key
   * @returns Decrypted category name
   *
   * @example
   * ```typescript
   * const sessionKey = await deriveSessionKey(walletSignature);
   * const decrypted = await CategoryManager.decryptName(encrypted, sessionKey);
   * ```
   */
  static async decryptName(
    encryptedName: Uint8Array,
    sessionKey: Uint8Array
  ): Promise<string> {
    return await decryptData(encryptedName, sessionKey);
  }

  /**
   * Create category templates
   *
   * Encrypts default category templates for bulk creation.
   * Useful for onboarding new users with pre-defined categories.
   *
   * @param sessionKey - Session encryption key
   * @returns Array of encrypted category templates
   *
   * @example
   * ```typescript
   * const sessionKey = await deriveSessionKey(walletSignature);
   * const templates = await CategoryManager.createDefaultCategories(sessionKey);
   * // Use templates to call create_category instruction for each
   * ```
   */
  static async createDefaultCategories(
    sessionKey: Uint8Array
  ): Promise<Array<{
    nameEncrypted: Uint8Array;
    icon: number;
    color: number;
    parentId: null;
  }>> {
    const encrypted: Array<{
      nameEncrypted: Uint8Array;
      icon: number;
      color: number;
      parentId: null;
    }> = [];

    for (const template of this.DEFAULT_TEMPLATES) {
      const nameEncrypted = await this.encryptName(template.name, sessionKey);
      encrypted.push({
        nameEncrypted,
        icon: template.icon,
        color: template.color,
        parentId: null,
      });
    }

    return encrypted;
  }

  /**
   * Decrypt a category object
   *
   * Decrypts a category fetched from on-chain, returning the full
   * category object with decrypted name.
   *
   * @param encryptedCategory - Category data from on-chain
   * @param sessionKey - Session encryption key
   * @returns Category with decrypted name
   */
  static async decryptCategory(
    encryptedCategory: {
      id: number;
      nameEncrypted: Uint8Array;
      icon: number;
      color: number;
      parentId: number | null;
      entryCount: number;
      createdAt: number;
      lastModified: number;
      flags: number;
    },
    sessionKey: Uint8Array
  ): Promise<Category> {
    const name = await this.decryptName(encryptedCategory.nameEncrypted, sessionKey);

    return {
      ...encryptedCategory,
      name,
    };
  }

  /**
   * Decrypt multiple categories
   *
   * Batch decrypts an array of categories from on-chain.
   *
   * @param encryptedCategories - Array of encrypted categories
   * @param sessionKey - Session encryption key
   * @returns Array of decrypted categories
   */
  static async decryptCategories(
    encryptedCategories: Array<{
      id: number;
      nameEncrypted: Uint8Array;
      icon: number;
      color: number;
      parentId: number | null;
      entryCount: number;
      createdAt: number;
      lastModified: number;
      flags: number;
    }>,
    sessionKey: Uint8Array
  ): Promise<Category[]> {
    return await Promise.all(
      encryptedCategories.map((cat) => this.decryptCategory(cat, sessionKey))
    );
  }

  /**
   * Build category hierarchy
   *
   * Organizes flat category list into hierarchical tree structure
   * based on parent-child relationships.
   *
   * @param categories - Flat array of categories
   * @returns Root categories with nested children
   *
   * @example
   * ```typescript
   * const categories = await fetchAllCategories();
   * const hierarchy = CategoryManager.buildHierarchy(categories);
   * // hierarchy = [
   * //   { id: 1, name: 'Work', children: [
   * //     { id: 4, name: 'Projects', children: [] },
   * //     { id: 5, name: 'Clients', children: [] }
   * //   ]},
   * //   { id: 2, name: 'Personal', children: [] }
   * // ]
   * ```
   */
  static buildHierarchy(
    categories: Category[]
  ): Array<Category & { children: Category[] }> {
    const categoryMap = new Map<number, Category & { children: Category[] }>();
    const roots: Array<Category & { children: Category[] }> = [];

    // First pass: Create map with children arrays
    for (const category of categories) {
      categoryMap.set(category.id, { ...category, children: [] });
    }

    // Second pass: Build hierarchy
    for (const category of categories) {
      const node = categoryMap.get(category.id)!;

      if (category.parentId === null) {
        // Root category
        roots.push(node);
      } else {
        // Child category
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent doesn't exist, treat as root
          roots.push(node);
        }
      }
    }

    return roots;
  }

  /**
   * Validate category name
   *
   * Checks if a category name meets requirements before encryption.
   *
   * @param name - Category name to validate
   * @returns Validation result with error message if invalid
   */
  static validateName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Category name cannot be empty' };
    }

    if (name.length > 50) {
      return { valid: false, error: 'Category name too long (max 50 characters)' };
    }

    // Check for invalid characters
    const invalidChars = /[<>{}]/;
    if (invalidChars.test(name)) {
      return { valid: false, error: 'Category name contains invalid characters' };
    }

    return { valid: true };
  }

  /**
   * Get category color
   *
   * Returns hex color for a category based on its color code.
   *
   * @param colorCode - Color code (0-15)
   * @returns Hex color string
   */
  static getColor(colorCode: number): string {
    return this.COLOR_PALETTE[colorCode] || this.COLOR_PALETTE[0];
  }

  /**
   * Get category icon
   *
   * Returns icon/emoji for a category based on its icon code.
   *
   * @param iconCode - Icon code (0-255)
   * @returns Icon string (emoji or name)
   */
  static getIcon(iconCode: number): string {
    return this.ICON_MAP[iconCode] || '📁'; // Default folder icon
  }

  /**
   * Sort categories
   *
   * Sorts categories by various criteria.
   *
   * @param categories - Categories to sort
   * @param sortBy - Sort criteria
   * @returns Sorted categories
   */
  static sortCategories(
    categories: Category[],
    sortBy: 'name' | 'entryCount' | 'createdAt' | 'lastModified' = 'name'
  ): Category[] {
    const sorted = [...categories];

    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'entryCount':
        sorted.sort((a, b) => b.entryCount - a.entryCount);
        break;
      case 'createdAt':
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'lastModified':
        sorted.sort((a, b) => b.lastModified - a.lastModified);
        break;
    }

    return sorted;
  }

  /**
   * Filter categories
   *
   * Filters categories based on search query.
   *
   * @param categories - Categories to filter
   * @param query - Search query
   * @returns Filtered categories
   */
  static filterCategories(
    categories: Category[],
    query: string
  ): Category[] {
    if (!query || query.trim().length === 0) {
      return categories;
    }

    const lowerQuery = query.toLowerCase().trim();

    return categories.filter((cat) =>
      cat.name.toLowerCase().includes(lowerQuery)
    );
  }
}
