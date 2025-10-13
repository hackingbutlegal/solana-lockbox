use anchor_lang::prelude::*;

/// Category for organizing password entries
///
/// Categories are user-defined organizational buckets for passwords.
/// Names are encrypted client-side before storage.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Category {
    /// Unique category ID (0-255 for efficient storage)
    pub id: u8,

    /// Encrypted category name (max 64 bytes encrypted)
    #[max_len(64)]
    pub name_encrypted: Vec<u8>,

    /// Icon identifier (0-255, mapped to icon set client-side)
    pub icon: u8,

    /// Color code (0-15 for predefined color palette)
    pub color: u8,

    /// Parent category ID for hierarchical organization (None for root categories)
    pub parent_id: Option<u8>,

    /// Number of entries in this category
    pub entry_count: u32,

    /// Creation timestamp
    pub created_at: i64,

    /// Last modification timestamp
    pub last_modified: i64,

    /// Flags for category state (favorite, archived, etc.)
    pub flags: u8,
}

impl Category {
    /// Maximum category name size when encrypted (64 bytes)
    pub const MAX_NAME_SIZE: usize = 64;

    /// Maximum number of categories per user (u8 limit)
    pub const MAX_CATEGORIES: u8 = 255;

    /// Create a new category
    pub fn new(
        id: u8,
        name_encrypted: Vec<u8>,
        icon: u8,
        color: u8,
        parent_id: Option<u8>,
        created_at: i64,
    ) -> Result<Self> {
        require!(
            name_encrypted.len() <= Self::MAX_NAME_SIZE,
            crate::errors::LockboxError::InvalidDataSize
        );

        Ok(Self {
            id,
            name_encrypted,
            icon,
            color,
            parent_id,
            entry_count: 0,
            created_at,
            last_modified: created_at,
            flags: 0,
        })
    }

    /// Increment entry count
    pub fn increment_entries(&mut self) {
        self.entry_count = self.entry_count.saturating_add(1);
    }

    /// Decrement entry count
    pub fn decrement_entries(&mut self) {
        self.entry_count = self.entry_count.saturating_sub(1);
    }

    /// Update category metadata
    pub fn update(
        &mut self,
        name_encrypted: Option<Vec<u8>>,
        icon: Option<u8>,
        color: Option<u8>,
        parent_id: Option<Option<u8>>,
        timestamp: i64,
    ) -> Result<()> {
        if let Some(name) = name_encrypted {
            require!(
                name.len() <= Self::MAX_NAME_SIZE,
                crate::errors::LockboxError::InvalidDataSize
            );
            self.name_encrypted = name;
        }

        if let Some(i) = icon {
            self.icon = i;
        }

        if let Some(c) = color {
            self.color = c;
        }

        if let Some(p) = parent_id {
            self.parent_id = p;
        }

        self.last_modified = timestamp;
        Ok(())
    }
}

/// Default categories with common use cases
///
/// These are provided as suggestions but users can customize.
/// Category names must be encrypted client-side before storage.
impl Category {
    /// Get default category templates (unencrypted names for reference)
    ///
    /// IMPORTANT: These are templates only. Client must encrypt names before storing.
    pub fn default_templates() -> Vec<(&'static str, u8, u8)> {
        vec![
            ("Personal", 0, 1),      // Blue
            ("Work", 1, 2),          // Green
            ("Financial", 2, 3),     // Yellow
            ("Social Media", 3, 4),  // Purple
            ("Shopping", 4, 5),      // Orange
            ("Entertainment", 5, 6), // Pink
            ("Development", 6, 7),   // Cyan
            ("Education", 7, 8),     // Teal
        ]
    }
}

/// Category registry account - stores all categories for a user
///
/// This account holds the user's category definitions. Each user has one
/// registry that stores up to 255 categories.
#[account]
#[derive(InitSpace)]
pub struct CategoryRegistry {
    /// Owner's wallet address
    pub owner: Pubkey,

    /// Reference to master lockbox
    pub master_lockbox: Pubkey,

    /// List of categories (max 255)
    #[max_len(255)]
    pub categories: Vec<Category>,

    /// Next category ID to assign
    pub next_category_id: u8,

    /// Creation timestamp
    pub created_at: i64,

    /// PDA bump seed
    pub bump: u8,
}

impl CategoryRegistry {
    /// Seeds for PDA derivation
    pub const SEEDS_PREFIX: &'static [u8] = b"category_registry";

    /// Get category by ID
    pub fn get_category(&self, id: u8) -> Option<&Category> {
        self.categories.iter().find(|c| c.id == id)
    }

    /// Get mutable category by ID
    pub fn get_category_mut(&mut self, id: u8) -> Option<&mut Category> {
        self.categories.iter_mut().find(|c| c.id == id)
    }

    /// Add a new category
    pub fn add_category(&mut self, category: Category) -> Result<()> {
        require!(
            self.categories.len() < Category::MAX_CATEGORIES as usize,
            crate::errors::LockboxError::CategoryLimitReached
        );

        // Verify ID doesn't already exist
        require!(
            !self.categories.iter().any(|c| c.id == category.id),
            crate::errors::LockboxError::InvalidCategory
        );

        self.categories.push(category);
        self.next_category_id = self.next_category_id.saturating_add(1);

        Ok(())
    }

    /// Remove a category by ID
    pub fn remove_category(&mut self, id: u8) -> Result<()> {
        let index = self.categories
            .iter()
            .position(|c| c.id == id)
            .ok_or(crate::errors::LockboxError::InvalidCategory)?;

        let category = &self.categories[index];

        // Prevent deletion if category has entries
        require!(
            category.entry_count == 0,
            crate::errors::LockboxError::CategoryLimitReached // Reusing error, could add specific one
        );

        self.categories.remove(index);

        Ok(())
    }

    /// Update entry count for a category
    pub fn update_category_count(&mut self, id: u8, delta: i32) -> Result<()> {
        let category = self.get_category_mut(id)
            .ok_or(crate::errors::LockboxError::InvalidCategory)?;

        if delta > 0 {
            category.entry_count = category.entry_count.saturating_add(delta as u32);
        } else {
            category.entry_count = category.entry_count.saturating_sub((-delta) as u32);
        }

        Ok(())
    }
}
