use anchor_lang::prelude::*;

use solana_randomness_service::{SimpleRandomnessV1Account, ID as SolanaRandomnessServiceID};

use crate::{state::Raffle, RaffleError};

#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    #[account(
        signer,
        seeds = [b"STATE"],
        seeds::program = SolanaRandomnessServiceID,
        bump = randomness_state.bump,
    )]
    pub randomness_state: Box<Account<'info, solana_randomness_service::State>>,

    pub request: Box<Account<'info, SimpleRandomnessV1Account>>,

    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
}

pub fn consume_randomness_handler(ctx: Context<ConsumeRandomness>, result: Vec<u8>) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;

    require!(raffle.randomness.is_none(), RaffleError::WinnerAlreadyDrawn);

    // we are trusting switchboard to give us the correct number of bytes.
    raffle.randomness = Some(result.try_into().unwrap_or_else(|v: Vec<u8>| {
        panic!("Expected a Vec of length {} but it was {}", 32, v.len())
    }));

    Ok(())
}
