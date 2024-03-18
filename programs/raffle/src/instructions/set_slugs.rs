use anchor_lang::prelude::*;

use crate::{program::Raffle, state::ProgramConfig, RaffleError};

#[derive(Accounts)]
#[instruction(slugs: Vec<String>)]
pub struct SetSlugs<'info> {
    #[account(
        mut,
        seeds = [
            b"program-config"
        ],
        realloc = ProgramConfig::LEN + (50 + 4) * slugs.len(),
        realloc::payer = authority,
        realloc::zero = false,
        bump = program_config.bump
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

pub fn set_slugs_handler(ctx: Context<SetSlugs>, slugs: Vec<String>) -> Result<()> {
    let program_config = &mut ctx.accounts.program_config;
    program_config.slugs = slugs;

    Ok(())
}
