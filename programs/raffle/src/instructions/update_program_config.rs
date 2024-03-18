use anchor_lang::prelude::*;

use crate::{program::Raffle, state::ProgramConfig, RaffleError};

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(
        mut,
        seeds = [b"program-config"],
        bump
    )]
    pub program_config: Account<'info, ProgramConfig>,

    #[account(
        constraint = program.programdata_address()? == Some(program_data.key()) @ RaffleError::AdminOnly
    )]
    pub program: Program<'info, Raffle>,

    #[account(
        constraint = program_data.upgrade_authority_address == Some(authority.key()) @ RaffleError::AdminOnly
    )]
    pub program_data: Account<'info, ProgramData>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn update_program_config_handler(
    ctx: Context<UpdateProgramConfig>,
    raffle_fee: Option<u64>,
    proceeds_share: Option<u16>,
) -> Result<()> {
    let program_config = &mut ctx.accounts.program_config;

    if raffle_fee.is_some() {
        program_config.raffle_fee = raffle_fee.unwrap();
    }

    if proceeds_share.is_some() {
        program_config.proceeds_share = proceeds_share.unwrap();
    }

    Ok(())
}
