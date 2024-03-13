use anchor_lang::prelude::*;

use crate::{program::Raffle, state::ProgramConfig, RaffleError};

#[derive(Accounts)]
pub struct InitProgramConfig<'info> {
    #[account(
        init,
        space = ProgramConfig::LEN,
        payer = authority,
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

    pub system_program: Program<'info, System>,
}

pub fn init_program_config_handler(
    ctx: Context<InitProgramConfig>,
    raffle_fee: u64,
    proceeds_share: u16,
) -> Result<()> {
    let program_config = &mut ctx.accounts.program_config;

    **program_config = ProgramConfig::init(raffle_fee, proceeds_share, ctx.bumps.program_config);

    Ok(())
}
