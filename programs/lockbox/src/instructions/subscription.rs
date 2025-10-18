use anchor_lang::prelude::*;
use crate::state::{MasterLockbox, SubscriptionTier};

/// Upgrade subscription tier
#[derive(Accounts)]
pub struct UpgradeSubscription<'info> {
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: Fee receiver account - configurable treasury wallet
    /// Can be any wallet address specified by the client SDK
    #[account(mut)]
    pub fee_receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn upgrade_subscription_handler(
    ctx: Context<UpgradeSubscription>,
    new_tier: SubscriptionTier,
) -> Result<()> {
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // Validate upgrade
    require!(
        master_lockbox.subscription_tier.can_upgrade_to(&new_tier),
        crate::errors::LockboxError::InvalidTierUpgrade
    );

    // Calculate payment amount
    let payment_amount = new_tier.monthly_cost();

    if payment_amount > 0 {
        // Transfer payment to fee receiver
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.owner.key(),
            &ctx.accounts.fee_receiver.key(),
            payment_amount,
        );

        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.fee_receiver.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        msg!("Subscription payment: {} lamports", payment_amount);
    }

    // Upgrade subscription
    master_lockbox.upgrade_subscription(new_tier, current_timestamp)?;
    master_lockbox.touch(current_timestamp);

    msg!(
        "Subscription upgraded to {:?} (expires: {})",
        new_tier,
        master_lockbox.subscription_expires
    );

    Ok(())
}

/// Renew subscription (for existing paid tiers)
#[derive(Accounts)]
pub struct RenewSubscription<'info> {
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: Fee receiver account - configurable treasury wallet
    /// Can be any wallet address specified by the client SDK
    #[account(mut)]
    pub fee_receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn renew_subscription_handler(ctx: Context<RenewSubscription>) -> Result<()> {
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // Can't renew free tier
    require!(
        master_lockbox.subscription_tier != SubscriptionTier::Free,
        crate::errors::LockboxError::InvalidTierUpgrade
    );

    // Calculate payment amount
    let payment_amount = master_lockbox.subscription_tier.monthly_cost();

    // Transfer payment to fee receiver
    let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.owner.key(),
        &ctx.accounts.fee_receiver.key(),
        payment_amount,
    );

    anchor_lang::solana_program::program::invoke(
        &transfer_ix,
        &[
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.fee_receiver.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // Extend subscription
    let duration = master_lockbox.subscription_tier.duration_seconds();

    // If already expired, start from now; otherwise extend from current expiry
    if current_timestamp >= master_lockbox.subscription_expires {
        master_lockbox.subscription_expires = current_timestamp + duration;
    } else {
        master_lockbox.subscription_expires += duration;
    }

    master_lockbox.touch(current_timestamp);

    msg!(
        "Subscription renewed for {:?} (new expiry: {})",
        master_lockbox.subscription_tier,
        master_lockbox.subscription_expires
    );

    Ok(())
}

/// Downgrade to free tier (can only happen after subscription expires)
#[derive(Accounts)]
pub struct DowngradeSubscription<'info> {
    #[account(
        mut,
        seeds = [MasterLockbox::SEEDS_PREFIX, owner.key().as_ref()],
        bump = master_lockbox.bump,
        constraint = master_lockbox.owner == owner.key() @ crate::errors::LockboxError::Unauthorized
    )]
    pub master_lockbox: Account<'info, MasterLockbox>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

pub fn downgrade_subscription_handler(ctx: Context<DowngradeSubscription>) -> Result<()> {
    let master_lockbox = &mut ctx.accounts.master_lockbox;
    let current_timestamp = Clock::get()?.unix_timestamp;

    // Can only downgrade if subscription expired
    require!(
        !master_lockbox.is_subscription_active(current_timestamp),
        crate::errors::LockboxError::CannotDowngrade
    );

    // Check if current storage exceeds free tier limit
    let free_capacity = SubscriptionTier::Free.max_capacity();
    require!(
        master_lockbox.storage_used <= free_capacity,
        crate::errors::LockboxError::InsufficientStorageCapacity
    );

    // Downgrade to free
    master_lockbox.subscription_tier = SubscriptionTier::Free;
    master_lockbox.subscription_expires = 0;
    master_lockbox.touch(current_timestamp);

    msg!("Subscription downgraded to Free tier");

    Ok(())
}
