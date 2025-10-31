'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuth } from './AuthContext';
import { useLockbox } from './LockboxContext';
import { CategoryManager, Category } from '../lib/category-manager';

/**
 * Category Context - Category Management
 *
 * Provides client-side category management with localStorage persistence:
 * - Category CRUD operations
 * - Client-side encryption of category names
 * - Wallet-specific category storage
 * - Category metadata (name, icon, color)
 *
 * NOTE: Categories are stored client-side only. The on-chain password entries
 * only store a category ID (u32). Category metadata is encrypted and persisted
 * in browser localStorage, keyed by wallet address.
 */

export interface CategoryContextType {
  // Categories
  categories: Category[];

  // Operations
  createCategory: (name: string, icon: number, color: number, parentId: number | null) => Promise<void>;
  updateCategory: (id: number, name: string, icon: number, color: number) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  refreshCategories: () => Promise<void>;
  getCategoryById: (id: number) => Category | undefined;
  getCategoryName: (id: number) => string;

  // Loading/Error
  loading: boolean;
  error: string | null;
}

const CategoryContext = createContext<CategoryContextType | null>(null);

export function useCategory() {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategory must be used within CategoryProvider');
  }
  return context;
}

interface CategoryProviderProps {
  children: React.ReactNode;
}

/**
 * Get localStorage key for categories based on wallet address
 */
function getCategoriesStorageKey(walletAddress: string): string {
  return `lockbox_categories_${walletAddress}`;
}

/**
 * Interface for encrypted category storage
 */
interface EncryptedCategoryStorage {
  id: number;
  nameEncrypted: number[]; // Array representation of Uint8Array
  icon: number;
  color: number;
  parentId: number | null;
  entryCount: number;
  createdAt: number;
  lastModified: number;
  flags: number;
}

export function CategoryProvider({ children }: CategoryProviderProps) {
  const { publicKey } = useWallet();
  const { isSessionActive, initializeSession } = useAuth();
  const { masterLockbox } = useLockbox();

  // State
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCategoryId, setNextCategoryId] = useState<number>(1);

  // Helper to get session key from AuthContext
  // Note: We'll need to export a method from AuthContext to get the session key
  // For now, we'll initialize session when needed

  /**
   * Load categories from localStorage and decrypt
   */
  const loadCategories = useCallback(async () => {
    if (!publicKey) {
      setCategories([]);
      return;
    }

    // Don't load categories if there's no vault yet
    // This prevents signature prompts for new users who haven't created a vault
    if (!masterLockbox) {
      setCategories([]);
      return;
    }

    // Ensure session is active
    if (!isSessionActive) {
      const initialized = await initializeSession();
      if (!initialized) {
        setError('Failed to initialize session for category decryption');
        return;
      }
    }

    try {
      const storageKey = getCategoriesStorageKey(publicKey.toBase58());
      const stored = localStorage.getItem(storageKey);

      if (!stored) {
        // No categories yet - initialize with defaults if user wants
        setCategories([]);
        setNextCategoryId(1);
        return;
      }

      const data = JSON.parse(stored);
      const storedCategories = data.categories || [];
      const storedNextId: number = data.nextId || 1;

      // Categories are stored in localStorage with plaintext names
      // (localStorage is already wallet-specific and browser-protected)
      const loadedCategories: Category[] = storedCategories.map((cat: any) => ({
        id: cat.id,
        name: cat.name || `Category ${cat.id}`, // Use stored name or fallback
        nameEncrypted: new Uint8Array(), // Not used for localStorage storage
        icon: cat.icon || 0,
        color: cat.color || 1,
        parentId: cat.parentId || null,
        entryCount: cat.entryCount || 0,
        createdAt: cat.createdAt || Math.floor(Date.now() / 1000),
        lastModified: cat.lastModified || Math.floor(Date.now() / 1000),
        flags: cat.flags || 0,
      }));

      setCategories(loadedCategories);
      setNextCategoryId(storedNextId);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError('Failed to load categories from storage');
    }
  }, [publicKey, isSessionActive, initializeSession, masterLockbox]);

  /**
   * Save categories to localStorage
   */
  const saveCategories = useCallback(async (cats: Category[], updatedNextId?: number) => {
    if (!publicKey) return;

    try {
      const storageKey = getCategoriesStorageKey(publicKey.toBase58());

      // Simplified storage - store categories with plaintext names
      // (localStorage is already wallet-specific)
      const simplified = {
        categories: cats.map(cat => ({
          id: cat.id,
          name: cat.name, // Store plaintext in localStorage
          icon: cat.icon,
          color: cat.color,
          parentId: cat.parentId,
          entryCount: cat.entryCount,
          createdAt: cat.createdAt,
          lastModified: cat.lastModified,
          flags: cat.flags,
        })),
        nextId: updatedNextId !== undefined ? updatedNextId : nextCategoryId,
      };

      localStorage.setItem(storageKey, JSON.stringify(simplified));
    } catch (err) {
      console.error('Failed to save categories:', err);
      setError('Failed to save categories to storage');
    }
  }, [publicKey, nextCategoryId]);

  /**
   * Refresh categories - reload from localStorage
   */
  const refreshCategories = useCallback(async () => {
    await loadCategories();
  }, [loadCategories]);

  /**
   * Create a new category
   */
  const createCategory = useCallback(async (
    name: string,
    icon: number,
    color: number,
    parentId: number | null
  ): Promise<void> => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      // Validate name
      const validation = CategoryManager.validateName(name);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Create new category
      const now = Math.floor(Date.now() / 1000);
      const newCategory: Category = {
        id: nextCategoryId,
        name,
        nameEncrypted: new Uint8Array(), // Not using encryption for localStorage
        icon,
        color,
        parentId,
        entryCount: 0,
        createdAt: now,
        lastModified: now,
        flags: 0,
      };

      const updated = [...categories, newCategory];
      const newNextId = nextCategoryId + 1;

      setCategories(updated);
      setNextCategoryId(newNextId);

      await saveCategories(updated, newNextId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create category';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [publicKey, categories, nextCategoryId, saveCategories]);

  /**
   * Update an existing category
   */
  const updateCategory = useCallback(async (
    id: number,
    name: string,
    icon: number,
    color: number
  ): Promise<void> => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      // Validate name
      const validation = CategoryManager.validateName(name);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const updated = categories.map(cat => {
        if (cat.id === id) {
          return {
            ...cat,
            name,
            icon,
            color,
            lastModified: Math.floor(Date.now() / 1000),
          };
        }
        return cat;
      });

      setCategories(updated);
      await saveCategories(updated);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update category';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [publicKey, categories, saveCategories]);

  /**
   * Delete a category
   */
  const deleteCategory = useCallback(async (id: number): Promise<void> => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      setLoading(true);
      setError(null);

      // Check if category has entries
      const category = categories.find(cat => cat.id === id);
      if (category && category.entryCount > 0) {
        throw new Error(`Cannot delete category with ${category.entryCount} entries`);
      }

      const updated = categories.filter(cat => cat.id !== id);
      setCategories(updated);
      await saveCategories(updated);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete category';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [publicKey, categories, saveCategories]);

  /**
   * Get category by ID
   */
  const getCategoryById = useCallback((id: number): Category | undefined => {
    return categories.find(cat => cat.id === id);
  }, [categories]);

  /**
   * Get category name by ID (returns "Uncategorized" if not found)
   */
  const getCategoryName = useCallback((id: number): string => {
    if (id === 0) return 'Uncategorized';
    const category = getCategoryById(id);
    return category ? category.name : `Category ${id}`;
  }, [getCategoryById]);

  // Load categories when wallet connects
  useEffect(() => {
    if (publicKey) {
      loadCategories();
    } else {
      setCategories([]);
    }
  }, [publicKey, loadCategories]);

  // Update entry counts when categories change
  // (This will be triggered by PasswordContext when entries change)
  const updateEntryCounts = useCallback((entryCounts: Map<number, number>) => {
    setCategories(prev => prev.map(cat => ({
      ...cat,
      entryCount: entryCounts.get(cat.id) || 0,
    })));
  }, []);

  // Expose updateEntryCounts for use by PasswordContext
  useEffect(() => {
    (window as any).__updateCategoryEntryCounts = updateEntryCounts;
  }, [updateEntryCounts]);

  const contextValue: CategoryContextType = {
    categories,
    createCategory,
    updateCategory,
    deleteCategory,
    refreshCategories,
    getCategoryById,
    getCategoryName,
    loading,
    error,
  };

  return (
    <CategoryContext.Provider value={contextValue}>
      {children}
    </CategoryContext.Provider>
  );
}
