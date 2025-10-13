use anchor_lang::prelude::*;
use crate::state::{MasterLockbox, CategoryRegistry, Category};

/// Initialize category registry for a user
#[derive(Accounts)]
pub struct InitializeCategoryRegistry<'info> {
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(
        init,
        payer = owner,
        space = 8 + CategoryRegistry::INIT_SPACE,
        seeds = [CategoryRegistry::SEEDS_PREFIX, master_lockbox.key().as_ref()],
        bump
    )]
    pub category_registry: Account<'info, CategoryRegistry>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_category_registry_handler(ctx: Context<InitializeCategoryRegistry>) -> Result<()> {
    let category_registry = &mut ctx.accounts.category_registry;
    let master_lockbox = &ctx.accounts.master_lockbox;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // Verify subscription tier supports categories (Basic and above)
    require!(
        master_lockbox.subscription_tier.supports_categories(),
        crate::errors::LockboxError::SubscriptionExpired // Could add FeatureNotAvailable error
    );

    category_registry.owner = master_lockbox.owner;
    category_registry.master_lockbox = master_lockbox.key();
    category_registry.categories = Vec::new();
    category_registry.next_category_id = 0;
    category_registry.created_at = current_timestamp;
    category_registry.bump = ctx.bumps.category_registry;

    msg!("Category registry initialized");

    Ok(())
}

/// Create a new category
#[derive(Accounts)]
pub struct CreateCategory<'info> {
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(
        mut,
        seeds = [CategoryRegistry::SEEDS_PREFIX, master_lockbox.key().as_ref()],
        bump = category_registry.bump,
        constraint = category_registry.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub category_registry: Account<'info, CategoryRegistry>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn create_category_handler(
    ctx: Context<CreateCategory>,
    name_encrypted: Vec<u8>,
    icon: u8,
    color: u8,
    parent_id: Option<u8>,
) -> Result<()> {
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let category_registry = &mut ctx.accounts.category_registry;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // SECURITY: Rate limiting
    require!(
        master_lockbox.check_rate_limit(current_timestamp, 1),
        crate::errors::LockboxError::RateLimitExceeded
    );

    // Verify subscription tier supports categories
    require!(
        master_lockbox.subscription_tier.supports_categories(),
        crate::errors::LockboxError::SubscriptionExpired
    );

    // Verify subscription is active
    require!(
        master_lockbox.is_subscription_active(current_timestamp),
        crate::errors::LockboxError::SubscriptionExpired
    );

    // Validate parent category exists if specified
    if let Some(parent) = parent_id {
        require!(
            category_registry.get_category(parent).is_some(),
            crate::errors::LockboxError::InvalidCategory
        );
    }

    // Create new category
    let category_id = category_registry.next_category_id;
    let category = Category::new(
        category_id,
        name_encrypted,
        icon,
        color,
        parent_id,
        current_timestamp,
    )?;

    // Add to registry
    category_registry.add_category(category)?;

    // Update master lockbox
    master_lockbox.categories_count += 1;
    master_lockbox.touch(current_timestamp);

    msg!("Category {} created", category_id);

    Ok(())
}

/// Update an existing category
#[derive(Accounts)]
pub struct UpdateCategory<'info> {
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(
        mut,
        seeds = [CategoryRegistry::SEEDS_PREFIX, master_lockbox.key().as_ref()],
        bump = category_registry.bump,
        constraint = category_registry.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub category_registry: Account<'info, CategoryRegistry>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn update_category_handler(
    ctx: Context<UpdateCategory>,
    category_id: u8,
    name_encrypted: Option<Vec<u8>>,
    icon: Option<u8>,
    color: Option<u8>,
    parent_id: Option<Option<u8>>,
) -> Result<()> {
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let category_registry = &mut ctx.accounts.category_registry;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // SECURITY: Rate limiting
    require!(
        master_lockbox.check_rate_limit(current_timestamp, 1),
        crate::errors::LockboxError::RateLimitExceeded
    );

    // Verify subscription is active
    require!(
        master_lockbox.is_subscription_active(current_timestamp),
        crate::errors::LockboxError::SubscriptionExpired
    );

    // Validate new parent category exists if being updated
    if let Some(Some(new_parent)) = parent_id {
        require!(
            category_registry.get_category(new_parent).is_some(),
            crate::errors::LockboxError::InvalidCategory
        );

        // Prevent circular parent relationships
        require!(
            new_parent != category_id,
            crate::errors::LockboxError::InvalidCategory
        );
    }

    // Get and update category
    let category = category_registry
        .get_category_mut(category_id)
        .ok_or(crate::errors::LockboxError::InvalidCategory)?;

    category.update(name_encrypted, icon, color, parent_id, current_timestamp)?;

    // Update master lockbox timestamp
    master_lockbox.touch(current_timestamp);

    msg!("Category {} updated", category_id);

    Ok(())
}

/// Delete a category
#[derive(Accounts)]
pub struct DeleteCategory<'info> {
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(
        mut,
        seeds = [CategoryRegistry::SEEDS_PREFIX, master_lockbox.key().as_ref()],
        bump = category_registry.bump,
        constraint = category_registry.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub category_registry: Account<'info, CategoryRegistry>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn delete_category_handler(
    ctx: Context<DeleteCategory>,
    category_id: u8,
) -> Result<()> {
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let category_registry = &mut ctx.accounts.category_registry;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // SECURITY: Rate limiting
    require!(
        master_lockbox.check_rate_limit(current_timestamp, 1),
        crate::errors::LockboxError::RateLimitExceeded
    );

    // Verify subscription is active
    require!(
        master_lockbox.is_subscription_active(current_timestamp),
        crate::errors::LockboxError::SubscriptionExpired
    );

    // Remove category (will fail if category has entries)
    category_registry.remove_category(category_id)?;

    // Update master lockbox
    master_lockbox.categories_count = master_lockbox.categories_count.saturating_sub(1);
    master_lockbox.touch(current_timestamp);

    msg!("Category {} deleted", category_id);

    Ok(())
}
