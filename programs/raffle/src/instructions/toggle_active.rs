use anchor_lang::prelude::*;

use crate::{program::Raffle, state::Raffler, RaffleError};

#[derive(Accounts)]
pub struct ToggleActive<'info> {
    #[account(
        mut,
        seeds = [
            b"RAFFLE",
            raffler.authority.as_ref(),
            b"raffler"
        ],
        bump = raffler.bump
    )]
    pub raffler: Account<'info, Raffler>,

    #[account(
        constraint = program.programdata_address()? == Some(program_data.key())
    )]
    pub program: Program<'info, Raffle>,

    #[account(
        constraint = raffler.authority == authority.key() || program_data.upgrade_authority_address == Some(authority.key()) @ RaffleError::AdminOrSystemAdmin
    )]
    pub program_data: Account<'info, ProgramData>,

    pub authority: Signer<'info>,
}

pub fn toggle_active_handler(ctx: Context<ToggleActive>, is_active: bool) -> Result<()> {
    let raffler = &mut ctx.accounts.raffler;

    raffler.is_active = is_active;
    Ok(())
}
