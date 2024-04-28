use anchor_lang::prelude::*;
use solana_program::sysvar;

use crate::{
    state::{Raffle, Raffler},
    utils::recent_blockhashes,
    RaffleError,
};

#[derive(Accounts)]
pub struct ForceSettle<'info> {
    #[account(
        seeds = [
            b"RAFFLE",
            raffler.authority.as_ref(),
            b"raffler"
        ],
        bump = raffler.bump,
        has_one = authority
    )]
    raffler: Account<'info, Raffler>,

    #[account(
        mut,
        has_one = raffler
    )]
    raffle: Account<'info, Raffle>,

    /// CHECK: sysvar address check is hardcoded
    #[account(address = sysvar::recent_blockhashes::ID)]
    pub recent_blockhashes: UncheckedAccount<'info>,

    authority: Signer<'info>,
}

pub fn force_settle_handler(ctx: Context<ForceSettle>, uri: Option<String>) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;

    require!(raffle.randomness.is_none(), RaffleError::WinnerAlreadyDrawn);

    if raffle.uri.len() == 0 {
        require!(uri.is_some(), RaffleError::UriRequired);
    }

    let randomness = recent_blockhashes::last_blockhash_accessor(&ctx.accounts.recent_blockhashes)?;

    if uri.is_some() {
        raffle.uri = uri.unwrap();
    }

    raffle.randomness = Some(randomness);

    Ok(())
}
