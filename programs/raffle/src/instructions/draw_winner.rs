use anchor_lang::prelude::*;
use solana_randomness_service::{program::SolanaRandomnessService, TransactionOptions};

use switchboard_solana::{get_ixn_discriminator, prelude::*};

use crate::{
    state::{Entrants, Raffle},
    RaffleError, ID,
};

#[derive(Accounts)]
pub struct DrawWinner<'info> {
    /// The Solana Randomness Service program.
    pub randomness_service: Program<'info, SolanaRandomnessService>,

    /// The account that will be created on-chain to hold the randomness request.
    /// Used by the off-chain oracle to pickup the request and fulfill it.
    /// CHECK: todo
    #[account(
        mut,
        signer,
        owner = system_program.key(),
        constraint = randomness_request.data_len() == 0 && randomness_request.lamports() == 0,
    )]
    pub randomness_request: AccountInfo<'info>,

    /// The TokenAccount that will store the funds for the randomness request.
    /// CHECK: todo
    #[account(
        mut,
        owner = system_program.key(),
        constraint = randomness_escrow.data_len() == 0 && randomness_escrow.lamports() == 0,
    )]
    pub randomness_escrow: AccountInfo<'info>,

    /// The randomness service's state account. Responsible for storing the
    /// reward escrow and the cost per random byte.
    #[account(
        seeds = [b"STATE"],
        bump = randomness_state.bump,
        seeds::program = randomness_service.key(),
    )]
    pub randomness_state: Box<Account<'info, solana_randomness_service::State>>,

    /// The token mint to use for paying for randomness requests.
    #[account(address = NativeMint::ID)]
    pub randomness_mint: Account<'info, Mint>,

    #[account(
        mut,
        has_one = entrants,
        seeds = [
            b"RAFFLE",
            entrants.key().as_ref(),
            b"raffle"
        ],
        bump = raffle.bump
    )]
    pub raffle: Account<'info, Raffle>,

    pub entrants: Account<'info, Entrants>,

    /// The account that will pay for the randomness request.
    #[account(mut)]
    pub payer: Signer<'info>,

    /// The Solana System program. Used to allocate space on-chain for the randomness_request account.
    pub system_program: Program<'info, System>,

    /// The Solana Token program. Used to transfer funds to the randomness escrow.
    pub token_program: Program<'info, Token>,
    /// The Solana Associated Token program. Used to create the TokenAccount for the randomness escrow.
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn draw_winner_handler(
    ctx: Context<DrawWinner>,
    uri: String,
    priority_fee: Option<u64>,
) -> anchor_lang::prelude::Result<()> {
    let priority_fee = priority_fee.unwrap_or(100);
    let current_time = Clock::get().unwrap().unix_timestamp;
    let raffle = &ctx.accounts.raffle;
    let entrants = &ctx.accounts.entrants;
    require_gt!(uri.len(), 0, RaffleError::UriRequired);
    require!(
        current_time >= raffle.end_time || entrants.total >= entrants.max,
        RaffleError::RaffleNotEnded
    );
    require!(raffle.randomness.is_none(), RaffleError::WinnerAlreadyDrawn,);

    solana_randomness_service::cpi::simple_randomness_v1(
        CpiContext::new(
            ctx.accounts.randomness_service.to_account_info(),
            solana_randomness_service::cpi::accounts::SimpleRandomnessV1Request {
                request: ctx.accounts.randomness_request.to_account_info(),
                escrow: ctx.accounts.randomness_escrow.to_account_info(),
                state: ctx.accounts.randomness_state.to_account_info(),
                mint: ctx.accounts.randomness_mint.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
            },
        ),
        32,
        solana_randomness_service::Callback {
            program_id: ID,
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.randomness_state.key(), true).into(),
                AccountMeta::new_readonly(ctx.accounts.randomness_request.key(), false).into(),
                AccountMeta::new(ctx.accounts.raffle.key(), false).into(),
            ],
            ix_data: get_ixn_discriminator("consume_randomness").to_vec(), // TODO: hardcode this discriminator [190,217,49,162,99,26,73,234]
        },
        Some(TransactionOptions {
            compute_units: Some(1_000_000),
            compute_unit_price: Some(priority_fee),
        }),
    )?;

    let raffle = &mut ctx.accounts.raffle;
    raffle.uri = uri;

    Ok(())
}
