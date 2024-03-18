use anchor_lang::prelude::*;

use crate::{
    program::Raffle,
    state::{ProgramConfig, Raffler},
    RaffleError,
};

#[derive(Accounts)]
pub struct DeleteRaffler<'info> {
    #[account(
        mut,
        seeds = [
            b"program-config"
        ],
        bump,
        realloc = program_config.current_len() - 50 - 4,
        realloc::payer = authority,
        realloc::zero = false,
    )]
    pub program_config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        close = authority
    )]
    pub raffler: Account<'info, Raffler>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint = program.programdata_address()? == Some(program_data.key()) @ RaffleError::AdminOnly
    )]
    pub program: Program<'info, Raffle>,

    #[account(
        constraint = program_data.upgrade_authority_address == Some(authority.key()) @ RaffleError::AdminOnly
    )]
    pub program_data: Account<'info, ProgramData>,

    pub system_program: Program<'info, System>,
}

pub fn delete_raffler_handler(ctx: Context<DeleteRaffler>) -> Result<()> {
    let raffler = &ctx.accounts.raffler;
    let slugs: Vec<String> = ctx.accounts.program_config.slugs.clone();

    let program_config = &mut ctx.accounts.program_config;

    program_config.slugs = slugs
        .into_iter()
        .filter(|slug| slug != &raffler.slug)
        .collect();

    Ok(())
}
