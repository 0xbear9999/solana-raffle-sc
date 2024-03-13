use anchor_lang::prelude::*;

use crate::state::{Raffle, Raffler};

#[derive(Accounts)]
pub struct SetEntrantsUri<'info> {
    #[account(
        seeds = [
            b"RAFFLE",
            authority.key().as_ref(),
            b"raffler"
        ],
        bump = raffler.bump,
        has_one = authority
    )]
    pub raffler: Account<'info, Raffler>,

    #[account(
        mut,
        seeds = [
            b"RAFFLE",
            raffle.entrants.as_ref(),
            b"raffle"
        ],
        bump = raffle.bump,
        has_one = raffler
    )]
    pub raffle: Account<'info, Raffle>,
    pub authority: Signer<'info>,
}

pub fn set_entrants_uri_handler(ctx: Context<SetEntrantsUri>, uri: String) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;

    raffle.uri = uri;
    Ok(())
}
