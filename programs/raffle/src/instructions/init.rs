use anchor_lang::prelude::*;

use crate::{
    state::{ProgramConfig, Raffler},
    RaffleError, STAKE_PROGRAM,
};

use proc_macro_regex::regex;

regex!(regex_slug "^(?:[_a-z0-9]+)*$");

#[derive(Accounts)]
pub struct Init<'info> {
    #[account(
        mut,
        seeds = [
            b"program-config"
        ],
        bump = program_config.bump,
        realloc = program_config.current_len() + 50 + 4,
        realloc::payer = authority,
        realloc::zero = false,
    )]
    pub program_config: Account<'info, ProgramConfig>,

    #[account(
        init,
        space = Raffler::LEN,
        payer = authority,
        seeds = [
            b"RAFFLE",
            authority.key().as_ref(),
            b"raffler"
        ],
        bump
    )]
    pub raffler: Account<'info, Raffler>,

    /// CHECK: checked in instruction
    #[account(
        owner = STAKE_PROGRAM
    )]
    pub staker: Option<AccountInfo<'info>>,

    pub treasury: Option<SystemAccount<'info>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn init_handler(
    ctx: Context<Init>,
    name: String,
    slug: String,
    logo: Option<String>,
    bg: Option<String>,
) -> Result<()> {
    require_gte!(50, slug.len(), RaffleError::SlugTooLong);
    require_gt!(slug.len(), 0, RaffleError::SlugRequired);
    require_gte!(50, name.len(), RaffleError::NameTooLong);
    require_gt!(name.len(), 0, RaffleError::NameRequired);

    if logo.is_some() {
        require_gte!(52, logo.as_ref().unwrap().len(), RaffleError::LogoTooLong);
    }

    if bg.is_some() {
        require_gte!(52, bg.as_ref().unwrap().len(), RaffleError::BgTooLong);
    }

    require!(regex_slug(&slug), RaffleError::InvalidSlug);

    let program_config = &mut ctx.accounts.program_config;

    let existing_slugs = &program_config.slugs;
    require!(!existing_slugs.contains(&slug), RaffleError::SlugExists);

    program_config.slugs.push(slug.clone());

    let raffler = &mut ctx.accounts.raffler;

    let treasury = if ctx.accounts.treasury.is_some() {
        ctx.accounts.treasury.as_ref().unwrap().key()
    } else {
        ctx.accounts.authority.key()
    };

    **raffler = Raffler::init(
        ctx.accounts.authority.key(),
        slug,
        name,
        treasury,
        ctx.accounts.staker.as_ref().map(|acc| acc.key()),
        logo,
        bg,
        ctx.bumps.raffler,
    );

    Ok(())
}
