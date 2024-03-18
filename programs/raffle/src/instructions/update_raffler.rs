use anchor_lang::prelude::*;

use crate::{state::Raffler, RaffleError, STAKE_PROGRAM};

#[derive(Accounts)]
pub struct UpdateRaffler<'info> {
    #[account(
        mut,
        seeds = [
            b"RAFFLE",
            raffler.authority.as_ref(),
            b"raffler"
        ],
        bump = raffler.bump,
        has_one = authority
    )]
    pub raffler: Account<'info, Raffler>,

    pub authority: Signer<'info>,

    pub treasury: Option<SystemAccount<'info>>,

    /// CHECK: checked in instruction
    #[account(
        owner = STAKE_PROGRAM
    )]
    pub staker: Option<AccountInfo<'info>>,
}

pub fn update_raffler_hander(
    ctx: Context<UpdateRaffler>,
    name: Option<String>,
    logo: Option<String>,
    bg: Option<String>,
    unlink_staker: bool,
) -> Result<()> {
    let raffler = &mut ctx.accounts.raffler;

    if logo.is_some() {
        require_gte!(52, logo.as_ref().unwrap().len(), RaffleError::LogoTooLong);
    }

    if bg.is_some() {
        require_gte!(52, bg.as_ref().unwrap().len(), RaffleError::BgTooLong);
    }

    if name.is_some() {
        let name = name.unwrap();
        require_gt!(name.len(), 0, RaffleError::NameRequired);
        require_gte!(50, name.len(), RaffleError::NameTooLong);
        raffler.name = name
    }

    if ctx.accounts.treasury.is_some() {
        raffler.treasury = ctx.accounts.treasury.as_ref().unwrap().key();
    }

    if ctx.accounts.staker.is_some() {
        require!(!unlink_staker, RaffleError::UnexpectedStakerAccount);
        raffler.staker = Some(ctx.accounts.staker.as_ref().unwrap().key());
    }

    if unlink_staker {
        require!(
            ctx.accounts.staker.is_none(),
            RaffleError::UnexpectedStakerAccount
        );
        raffler.staker = None
    }

    raffler.logo = logo;
    raffler.bg = bg;

    Ok(())
}
