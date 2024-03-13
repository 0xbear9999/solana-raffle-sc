use anchor_lang::{prelude::*, solana_program::pubkey};

declare_id!("RAFFLv4sQoBPqLLqQvSHLRSFNnnoNekAbXfSegbQygF");

mod instructions;
mod state;
mod utils;

use self::state::EntryType;
use instructions::*;

pub const NATIVE_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");
pub const FEES_WALLET: Pubkey = pubkey!("D7sZPRf5WRC6BpLsu6k3gwcwxZGxbTrFMyDvrMxkVeJP");
pub const STAKE_PROGRAM: Pubkey = pubkey!("STAKEQkGBjkhCXabzB5cUbWgSSvbVJFEm2oEnyWzdKE");

#[program]
pub mod raffle {

    use super::*;

    pub fn init_program_config(
        ctx: Context<InitProgramConfig>,
        raffle_fee: u64,
        proceeds_share: u16,
    ) -> Result<()> {
        init_program_config_handler(ctx, raffle_fee, proceeds_share)
    }

    pub fn init(ctx: Context<Init>, name: String, slug: String) -> Result<()> {
        init_handler(ctx, name, slug)
    }

    pub fn init_raffle<'info>(
        ctx: Context<'_, '_, '_, 'info, InitRaffle<'info>>,
        num_tickets: Option<u32>,
        entry_type: EntryType,
        ticket_price: Option<u64>,
        start_time: Option<i64>,
        duration: i64,
        is_gated: bool,
        max_entrants_pct: Option<u16>,
    ) -> Result<()> {
        init_raffle_handler(
            ctx,
            num_tickets,
            entry_type,
            ticket_price,
            start_time,
            duration,
            is_gated,
            max_entrants_pct,
        )
    }

    pub fn delete_raffle(ctx: Context<DeleteRaffle>) -> Result<()> {
        delete_raffle_handler(ctx)
    }

    pub fn buy_tickets_token(ctx: Context<BuyTicketsToken>, amount: u32) -> Result<()> {
        buy_tickets_token_handler(ctx, amount)
    }
    pub fn buy_ticket_send_nft(ctx: Context<BuyTicketSendNft>) -> Result<()> {
        buy_ticket_send_nft_handler(ctx)
    }

    pub fn buy_ticket_burn_nft(ctx: Context<BuyTicketBurnNft>) -> Result<()> {
        buy_ticket_burn_nft_handler(ctx)
    }

    pub fn draw_winner(ctx: Context<DrawWinner>, uri: String) -> Result<()> {
        draw_winner_handler(ctx, uri)
    }

    pub fn consume_randomness(ctx: Context<ConsumeRandomness>, result: Vec<u8>) -> Result<()> {
        consume_randomness_handler(ctx, result)
    }

    pub fn claim_prize<'info>(
        ctx: Context<'_, '_, '_, 'info, ClaimPrize<'info>>,
        ticket_index: u32,
    ) -> Result<()> {
        claim_prize_handler(ctx, ticket_index)
    }

    pub fn set_slugs(ctx: Context<SetSlugs>, slugs: Vec<String>) -> Result<()> {
        set_slugs_handler(ctx, slugs)
    }

    pub fn collect_nft(ctx: Context<CollectNft>) -> Result<()> {
        collect_nft_handler(ctx)
    }

    pub fn recover_nft(ctx: Context<RecoverNft>) -> Result<()> {
        recover_nft_handler(ctx)
    }

    pub fn set_entrants_uri(ctx: Context<SetEntrantsUri>, uri: String) -> Result<()> {
        set_entrants_uri_handler(ctx, uri)
    }
}

#[error_code]
pub enum RaffleError {
    #[msg("The signer is not permitted to perform this action")]
    Unauthorized,
    #[msg("The provided token is not an NFT")]
    TokenNotNFT,
    #[msg("The max duration for a raffle is 30 days")]
    RaffleTooLong,
    #[msg("The min duration for a raffle is 5 minutes")]
    RaffleTooShort,
    #[msg("Start date must be in the future, or leave blank for now")]
    InvalidStartTime,
    #[msg("The max tickets for a raffle is 65,535")]
    TooManyTickets,
    #[msg("No tickets left for this raffle!")]
    SoldOut,
    #[msg("Raffle has not started yet")]
    NotStarted,
    #[msg("Raffle has ended")]
    Ended,
    #[msg("Error adding numbers")]
    ProgramAddError,
    #[msg("Error subtracting numbers")]
    ProgramSubError,
    #[msg("Error multiplying numbers")]
    ProgramMulError,
    #[msg("Invalid token mint provided for this raffle")]
    InvalidTokenMint,
    #[msg("Unexpected token_mint account")]
    TokenMintUnexpected,
    #[msg("Unexpected NFT mint account")]
    NftUnexpected,
    #[msg("Unexpected token mint account")]
    TokenUnexpected,
    #[msg("This is an admin only function")]
    AdminOnly,
    #[msg("Invalid account data")]
    InvalidAccountData,
    #[msg("Slug can only be a maximum of 50 chars")]
    SlugTooLong,
    #[msg("Slug is required")]
    SlugRequired,
    #[msg("Project name can only be a maximum of 50 chars")]
    NameTooLong,
    #[msg("Project name is required")]
    NameRequired,
    #[msg("Slug can only contain valid URL slug chars")]
    InvalidSlug,
    #[msg("Slug already exists")]
    SlugExists,
    #[msg("Winner already drawn")]
    WinnerAlreadyDrawn,
    #[msg("Winner not drawn")]
    WinnerNotDrawn,
    #[msg("Only the raffle admin can claim prize from raffle with no entries")]
    OnlyAdminCanClaim,
    #[msg("Only the winner can claim")]
    NotWinner,
    #[msg("This ticket is not the winning ticket")]
    TicketNotWinner,
    #[msg("This prize has already been claimed")]
    AlreadyClaimed,
    #[msg("Invalid collection. Only MCC can be used")]
    InvalidCollection,
    #[msg("Only the winner or raffle admin can settle the raffle")]
    OnlyWinnerOrAdminCanSettle,
    #[msg("Treasury token accout must be provided")]
    TreasuryTokenAccountNeeded,
    #[msg("This instruction can only be used with NFT payment type raffles")]
    NftInstruction,
    #[msg("This instruction can only be used with token payment type raffles")]
    TokenInstruction,
    #[msg("This raffle has not ended yet")]
    RaffleNotEnded,
    #[msg("This raffle has not been drawn yet")]
    NotDrawn,
    #[msg("Entrant doesn't hold a required NFT to enter this raffle")]
    GatedRaffle,
    #[msg("Ticket price required for token raffle")]
    TicketPriceRequired,
    #[msg("Unexpected entry collection mint for token raffle")]
    UnexpectedEntryCollectionMint,
    #[msg("Expected entry collection mint for NFT raffle")]
    ExpectedEntryCollectionMint,
    #[msg("Unexpected ticket price for NFT raffle")]
    UnexpectedTicketPrice,
    #[msg("This instruction cannot be used for this raffle")]
    InvalidInstruction,
    #[msg("Cannot withold burn proceeds for a token raffle")]
    BurnProceedsToken,
    #[msg("Cannot withold burn proceeds is not set to burn")]
    BurnProceedsNotBurn,
    #[msg("token_vault required if witholding burn proceeds")]
    WitholdBurnTokenVaultNeeded,
    #[msg("cannot set up a burn raffle with SOL")]
    CannotBurnSOL,
    #[msg("URI to offchain log is required when concluding a raffle")]
    UriRequired,
}
