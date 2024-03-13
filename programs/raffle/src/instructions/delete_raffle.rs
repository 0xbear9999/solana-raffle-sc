use anchor_lang::prelude::*;

use crate::{program::Raffle as RaffleProgram, state::Raffle, RaffleError};

#[derive(Accounts)]
pub struct DeleteRaffle<'info> {
    #[account(
        mut,
        close = authority,
        seeds = [
            b"RAFFLE",
            raffle.entrants.key().as_ref(),
            b"raffle"
        ],
        bump = raffle.bump,
    )]
    pub raffle: Account<'info, Raffle>,

    #[account(
        constraint = program.programdata_address()? == Some(program_data.key()) @ RaffleError::AdminOnly
    )]
    pub program: Program<'info, RaffleProgram>,

    #[account(
        constraint = program_data.upgrade_authority_address == Some(authority.key()) @ RaffleError::AdminOnly
    )]
    pub program_data: Account<'info, ProgramData>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn delete_raffle_handler(_ctx: Context<DeleteRaffle>) -> Result<()> {
    Ok(())
}
