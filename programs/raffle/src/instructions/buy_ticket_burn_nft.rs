use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        mpl_token_metadata::instructions::BurnV1CpiBuilder, MasterEditionAccount, Metadata,
        MetadataAccount, TokenRecordAccount,
    },
    token::{sync_native, Mint, SyncNative, Token, TokenAccount},
};
use solana_program::system_instruction;

use crate::{
    state::{Entrants, EntryType, PaymentType, Raffle, Raffler},
    utils::add_entrants,
    RaffleError, NATIVE_MINT,
};

#[derive(Accounts)]
pub struct BuyTicketBurnNft<'info> {
    #[account(
        mut,
        seeds = [
            b"RAFFLE",
            entrants.key().as_ref(),
            b"raffle"
        ],
        bump = raffle.bump,
        has_one = raffler,
        has_one = entrants,
        constraint = Clock::get().unwrap().unix_timestamp >= raffle.start_time @ RaffleError::NotStarted,
        constraint = Clock::get().unwrap().unix_timestamp < raffle.end_time @ RaffleError::Ended,
    )]
    pub raffle: Box<Account<'info, Raffle>>,

    #[account(
        seeds = [
            b"RAFFLE",
            raffler.authority.as_ref(),
            b"raffler"
        ],
        bump = raffler.bump
    )]
    pub raffler: Box<Account<'info, Raffler>>,

    #[account(mut)]
    pub entrants: Box<Account<'info, Entrants>>,

    #[account(
        mut,
        mint::decimals = 0,
        constraint = nft_mint.supply == 1 @ RaffleError::TokenNotNFT
    )]
    pub nft_mint: Option<Box<Account<'info, Mint>>>,

    #[account(
        init_if_needed,
        payer = entrant,
        associated_token::mint = nft_mint,
        associated_token::authority = entrant
    )]
    pub nft_source: Option<Box<Account<'info, TokenAccount>>>,

    #[account(address = NATIVE_MINT)]
    pub native_mint: Option<Box<Account<'info, Mint>>>,

    #[account(
        init_if_needed,
        payer = entrant,
        associated_token::mint = native_mint,
        associated_token::authority = raffle
    )]
    pub token_destination: Option<Box<Account<'info, TokenAccount>>>,

    #[account(
        mut,
        seeds = [
            b"metadata",
            Metadata::id().as_ref(),
            nft_mint.as_ref().expect("nft_mint expected if metadata provided").key().as_ref()
        ],
        seeds::program = Metadata::id(),
        bump,
        constraint = nft_metadata.collection.as_ref().unwrap().verified && nft_metadata.collection.as_ref().unwrap().key == match raffle.payment_type {
            PaymentType::Nft { collection } => collection,
            _ => return err!(RaffleError::InvalidCollection)
        } @ RaffleError::InvalidCollection
    )]
    pub nft_metadata: Option<Box<Account<'info, MetadataAccount>>>,

    /// CHECK: checked in CPI
    #[account(mut)]
    pub nft_edition: Option<AccountInfo<'info>>,

    #[account(mut)]
    pub nft_master_edition: Option<Box<Account<'info, MasterEditionAccount>>>,

    #[account(
        address = match raffle.payment_type {
            PaymentType::Nft { collection } => collection,
            _ => return err!(RaffleError::InvalidTokenMint)
        }
    )]
    pub nft_collection: Option<Box<Account<'info, Mint>>>,

    #[account(
        mut,
        seeds = [
            b"metadata",
            Metadata::id().as_ref(),
            nft_collection.as_ref().expect("nft_collection expected if nft_collection_metadata provided").key().as_ref()
        ],
        seeds::program = Metadata::id(),
        bump,
    )]
    pub nft_collection_metadata: Option<Box<Account<'info, MetadataAccount>>>,
    #[account(mut)]
    pub owner_token_record: Option<Box<Account<'info, TokenRecordAccount>>>,
    /// CHECK: this account is initialized in the CPI call
    #[account(mut)]
    pub destination_token_record: Option<AccountInfo<'info>>,

    pub gated_nft_mint: Option<Box<Account<'info, Mint>>>,

    #[account(
            seeds = [
            b"metadata",
            Metadata::id().as_ref(),
            gated_nft_mint.as_ref().unwrap().key().as_ref()
        ],
        seeds::program = Metadata::id(),
        bump,
        constraint = match raffle.gated_collection {
            Option::Some(val) => {
                let coll = gated_nft_metadata.collection.as_ref().expect("Gated NFT collection not included");
                val == coll.key && coll.verified
            },
            Option::None => true
        }
    )]
    pub gated_nft_metadata: Option<Box<Account<'info, MetadataAccount>>>,

    #[account(
        associated_token::mint = gated_nft_mint,
        associated_token::authority = entrant,
        constraint = gated_nft_token.amount == 1 @ RaffleError::GatedRaffle
    )]
    pub gated_nft_token: Option<Box<Account<'info, TokenAccount>>>,

    #[account(mut)]
    pub entrant: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub metadata_program: Program<'info, Metadata>,

    /// CHECK: account checked in CPI
    pub sysvar_instructions: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub auth_rules: Option<AccountInfo<'info>>,
    /// CHECK: account checked in CPI
    pub auth_rules_program: Option<AccountInfo<'info>>,
}

impl<'info> BuyTicketBurnNft<'info> {
    fn burn_nft(&self) -> Result<()> {
        let metadata_program = &self.metadata_program.to_account_info();
        let metadata = &self.nft_metadata.as_ref().unwrap().to_account_info();
        let mint = &self.nft_mint.as_ref().unwrap().to_account_info();
        let token = &self.nft_source.as_ref().unwrap().to_account_info();
        let token_owner = &self.entrant.to_account_info();
        let master_edition = &self
            .nft_master_edition
            .as_ref()
            .map(|a| a.to_account_info());
        let edition = &self.nft_edition.as_ref().map(|a| a.to_account_info());
        let nft_collection_metadata = self
            .nft_collection_metadata
            .as_ref()
            .map(|c| c.to_account_info());
        let token_record = &self
            .owner_token_record
            .as_ref()
            .map(|token_record| token_record.to_account_info());

        let system_program = &self.system_program.to_account_info();
        let sysvar_instructions = &self.sysvar_instructions.to_account_info();
        let spl_token_program = &&self.token_program.to_account_info();

        let mut cpi_burn = BurnV1CpiBuilder::new(&metadata_program);

        cpi_burn
            .authority(token_owner)
            .collection_metadata(nft_collection_metadata.as_ref())
            .edition(edition.as_ref())
            .master_edition(master_edition.as_ref())
            .metadata(metadata)
            .mint(mint)
            .token(token)
            .token_record(token_record.as_ref())
            .system_program(system_program)
            .sysvar_instructions(sysvar_instructions)
            .spl_token_program(spl_token_program)
            .amount(1);

        cpi_burn.invoke()?;

        Ok(())
    }

    fn sync_native_purchaser_ctx(&self) -> CpiContext<'_, '_, '_, 'info, SyncNative<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            SyncNative {
                account: self.token_destination.as_ref().unwrap().to_account_info(),
            },
        )
    }
}

pub fn buy_ticket_burn_nft_handler(ctx: Context<BuyTicketBurnNft>) -> Result<()> {
    let raffle = &ctx.accounts.raffle;

    if raffle.gated_collection.is_some() {
        require!(
            ctx.accounts.gated_nft_metadata.is_some(),
            RaffleError::GatedRaffle
        )
    }

    match raffle.payment_type {
        PaymentType::Token {
            token_mint: _,
            ticket_price: _,
        } => {
            return err!(RaffleError::NftInstruction);
        }
        PaymentType::Nft { collection: _ } => match raffle.entry_type {
            EntryType::Burn {
                withold_burn_proceeds,
            } => {
                let bal_before = ctx.accounts.entrant.lamports();
                ctx.accounts.burn_nft()?;
                let bal_after = ctx.accounts.entrant.lamports();

                if withold_burn_proceeds {
                    let proceeds = bal_after
                        .checked_sub(bal_before)
                        .ok_or(RaffleError::ProgramSubError)?;

                    let token_destination = ctx
                        .accounts
                        .token_destination
                        .as_ref()
                        .expect("token_destination account expected");

                    anchor_lang::solana_program::program::invoke(
                        &system_instruction::transfer(
                            &ctx.accounts.entrant.key(),
                            &token_destination.key(),
                            proceeds,
                        ),
                        &[
                            ctx.accounts.entrant.to_account_info(),
                            token_destination.to_account_info(),
                            ctx.accounts.system_program.to_account_info(),
                        ],
                    )?;

                    let entrants_key = ctx.accounts.entrants.key();
                    let bump = ctx.accounts.raffle.bump;

                    let authority_seed = &[
                        &b"RAFFLE"[..],
                        &entrants_key.as_ref(),
                        &b"raffle"[..],
                        &[bump],
                    ];

                    sync_native(
                        ctx.accounts
                            .sync_native_purchaser_ctx()
                            .with_signer(&[authority_seed]),
                    )?;
                }
            }
            _ => return err!(RaffleError::InvalidInstruction),
        },
    }

    add_entrants(
        &mut ctx.accounts.entrants,
        ctx.accounts.entrant.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        1,
    )?;

    Ok(())
}
