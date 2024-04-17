use anchor_lang::prelude::*;

use crate::state::{entrants, Entrants, Raffle, Raffler};

#[derive(Accounts)]
pub struct WithdrawRent<'info> {
    #[account(
        mut,
        seeds = [
            b"RAFFLE",
            entrants.key().as_ref(),
            b"raffle"
        ],
        bump = raffle.bump,
        has_one = raffler,
        has_one = entrants,
        constraint = raffle.randomness.is_some()
    )]
    pub raffle: Box<Account<'info, Raffle>>,

    #[account(
        seeds = [
            b"RAFFLE",
            raffler.authority.as_ref(),
            b"raffler"
        ],
        bump = raffler.bump
    )]
    pub raffler: Box<Account<'info, Raffler>>,

    #[account(mut)]
    pub entrants: Box<Account<'info, Entrants>>,

    claimer: Signer<'info>,
}

pub fn withdraw_rent_handler(ctx: Context<WithdrawRent>) -> Result<()> {
    let entrants = &mut ctx.accounts.entrants;

    let entrants_account_info = entrants.to_account_info();

    entrants.get_all_entrants(
        entrants_account_info.data.borrow_mut(),
        ctx.accounts.claimer.key(),
    );

    Ok(())
}
