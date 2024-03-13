use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{mpl_token_metadata::instructions::TransferV1CpiBuilder, Metadata},
    token::{Mint, Token, TokenAccount},
};

use crate::{
    state::{Entrants, EntryType, PaymentType, Raffle, Raffler},
    RaffleError, FEES_WALLET, NATIVE_MINT,
};

#[derive(Accounts)]
pub struct InitRaffle<'info> {
    #[account(
        seeds = [
            b"RAFFLE",
            raffler.authority.as_ref(),
            b"raffler"
        ],
        bump = raffler.bump,
        has_one = authority @ RaffleError::Unauthorized
    )]
    pub raffler: Box<Account<'info, Raffler>>,

    #[account(
        init,
        seeds = [
            b"RAFFLE",
            entrants.key().as_ref(),
            b"raffle"
        ],
        bump,
        space = Raffle::LEN,
        payer = authority
    )]
    pub raffle: Box<Account<'info, Raffle>>,

    #[account(zero)]
    pub entrants: Box<Account<'info, Entrants>>,

    pub token_mint: Option<Box<Account<'info, Mint>>>,

    /// CHECK: explicit address check
    #[account(address = FEES_WALLET)]
    pub fees_wallet: Option<AccountInfo<'info>>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = token_mint,
        associated_token::authority = fees_wallet
    )]
    pub fees_wallet_token: Option<Box<Account<'info, TokenAccount>>>,

    pub entry_collection_mint: Option<Box<Account<'info, Mint>>>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = token_mint,
        associated_token::authority = raffle,
    )]
    pub token_vault: Option<Box<Account<'info, TokenAccount>>>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = token_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Option<Box<Account<'info, TokenAccount>>>,

    /// CHECK: explicit address
    #[account(address = raffler.treasury)]
    pub treasury: Option<AccountInfo<'info>>,

    #[account(
        mint::decimals = 0,
        constraint = prize.supply == 1 @ RaffleError::TokenNotNFT
    )]
    pub prize: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = prize,
        associated_token::authority = authority
    )]
    pub prize_token: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = prize,
        associated_token::authority = raffle
    )]
    pub prize_custody: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    // System accounts
    #[account(address = anchor_spl::token::ID)]
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub metadata_program: Program<'info, Metadata>,
}

impl<'info> InitRaffle<'info> {
    pub fn transfer_nft(
        &self,
        metadata: &AccountInfo<'info>,
        master_edition: &AccountInfo<'info>,
        sysvar_instructions: &AccountInfo<'info>,
        source_token_record: Option<AccountInfo<'info>>,
        destination_token_record: Option<AccountInfo<'info>>,
        auth_rules_program: Option<AccountInfo<'info>>,
        auth_rules: Option<AccountInfo<'info>>,
    ) -> Result<()> {
        let metadata_program = &self.metadata_program;
        let token = &self.prize_token.as_ref().to_account_info();
        let token_owner = &self.authority.to_account_info();
        let destination_token = &self.prize_custody.as_ref().to_account_info();
        let destination_owner = &self.raffle.to_account_info();
        let mint = &self.prize.to_account_info();
        let system_program = &self.system_program.to_account_info();
        let spl_token_program = &&self.token_program.to_account_info();
        let spl_ata_program = &self.associated_token_program.to_account_info();

        let mut cpi_transfer = TransferV1CpiBuilder::new(&metadata_program);

        cpi_transfer
            .token(token)
            .token_owner(token_owner)
            .destination_token(&destination_token)
            .destination_owner(destination_owner)
            .mint(mint)
            .metadata(metadata)
            .edition(Some(master_edition))
            .authority(token_owner)
            .payer(token_owner)
            .system_program(system_program)
            .sysvar_instructions(sysvar_instructions)
            .spl_token_program(spl_token_program)
            .spl_ata_program(spl_ata_program)
            .authorization_rules_program(auth_rules_program.as_ref())
            .authorization_rules(auth_rules.as_ref())
            .token_record(source_token_record.as_ref())
            .destination_token_record(destination_token_record.as_ref())
            .amount(1);

        // performs the CPI
        cpi_transfer.invoke()?;
        Ok(())
    }
}

pub fn init_raffle_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, InitRaffle<'info>>,
    num_tickets: Option<u32>,
    entry_type: EntryType,
    ticket_price: Option<u64>,
    start_time: Option<i64>,
    duration: i64,
    is_gated: bool,
    max_entrant_pct: Option<u16>,
) -> Result<()> {
    let remaining_accounts = &mut ctx.remaining_accounts.iter();
    require_gte!(60 * 60 * 24 * 30, duration, RaffleError::RaffleTooLong);
    // require_gte!(duration, 60 * 5, RaffleError::RaffleTooShort);

    if num_tickets.is_some() {
        require_gte!(u32::MAX, num_tickets.unwrap(), RaffleError::TooManyTickets);
    }

    let current_time = Clock::get().unwrap().unix_timestamp;

    if start_time.is_some() {
        require_gte!(
            start_time.unwrap(),
            current_time,
            RaffleError::InvalidStartTime
        )
    }

    if ctx.accounts.entry_collection_mint.is_some() {
        require!(
            ctx.accounts.entry_collection_mint.is_some(),
            RaffleError::ExpectedEntryCollectionMint
        );
        require!(ticket_price.is_none(), RaffleError::UnexpectedTicketPrice);
    } else {
        require!(ticket_price.is_some(), RaffleError::TicketPriceRequired);
    }

    if matches!(
        entry_type,
        EntryType::Burn {
            withold_burn_proceeds: true
        }
    ) {
        require!(
            ctx.accounts.token_vault.is_some(),
            RaffleError::WitholdBurnTokenVaultNeeded
        )
    }

    let prize_metadata = next_account_info(remaining_accounts)?;
    let prize_master_edition = next_account_info(remaining_accounts)?;

    let sysvar_instructions = next_account_info(remaining_accounts)?;

    let gated_collection = if is_gated {
        Some(next_account_info(remaining_accounts)?)
    } else {
        None
    };

    let source_token_record = match next_account_info(remaining_accounts) {
        Ok(val) => Some(val.to_account_info()),
        Err(_) => None,
    };

    let destination_token_record = match next_account_info(remaining_accounts) {
        Ok(val) => Some(val.to_account_info()),
        Err(_) => None,
    };

    let auth_rules_program = match next_account_info(remaining_accounts) {
        Ok(val) => Some(val.to_account_info()),
        Err(_) => None,
    };

    let auth_rules = match next_account_info(remaining_accounts) {
        Ok(val) => Some(val.to_account_info()),
        Err(_) => None,
    };

    let raffle = &mut ctx.accounts.raffle;

    let start_time: i64 = start_time.unwrap_or(current_time);
    let end_time: i64 = start_time + duration;

    let payment_type = if ctx.accounts.entry_collection_mint.is_some() {
        PaymentType::Nft {
            collection: ctx.accounts.entry_collection_mint.as_ref().unwrap().key(),
        }
    } else {
        let token_mint = ctx.accounts.token_mint.as_ref().unwrap();
        require!(
            ctx.accounts.treasury_token_account.is_some(),
            RaffleError::TreasuryTokenAccountNeeded
        );
        if matches!(
            entry_type,
            EntryType::Burn {
                withold_burn_proceeds: _
            }
        ) {
            require_keys_neq!(token_mint.key(), NATIVE_MINT, RaffleError::CannotBurnSOL);
        }
        PaymentType::Token {
            token_mint: token_mint.key(),
            ticket_price: ticket_price.unwrap(),
        }
    };

    ***raffle = Raffle::init(
        ctx.accounts.raffler.key(),
        ctx.accounts.prize.key(),
        entry_type,
        payment_type,
        ctx.accounts.entrants.key(),
        gated_collection.as_ref().map(|c| c.key()),
        start_time,
        end_time,
        max_entrant_pct.unwrap_or(10000),
        ctx.bumps.raffle,
    );

    let entrants = &mut ctx.accounts.entrants;
    entrants.total = 0;
    entrants.max = num_tickets.unwrap_or(u32::MAX);

    ctx.accounts.transfer_nft(
        prize_metadata,
        prize_master_edition,
        sysvar_instructions,
        source_token_record,
        destination_token_record,
        auth_rules_program,
        auth_rules,
    )
}
