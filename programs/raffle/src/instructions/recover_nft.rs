use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        mpl_token_metadata::instructions::TransferV1CpiBuilder, MasterEditionAccount, Metadata,
        MetadataAccount, TokenRecordAccount,
    },
    token::{close_account, CloseAccount, Mint, Token, TokenAccount},
};

use crate::{program::Raffle, RaffleError};

#[derive(Accounts)]
pub struct RecoverNft<'info> {
    /// CHECK: this account was deleted
    #[account(
        mut,
        seeds = [
            b"RAFFLE",
            entrants.key().as_ref(),
            b"raffle"
        ],
        bump,
    )]
    pub raffle: AccountInfo<'info>,

    pub nft_mint: Account<'info, Mint>,

    /// CHECK: this account isn't read or written from
    pub entrants: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = raffle
    )]
    pub nft_source: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = nft_mint,
        associated_token::authority = destination
    )]
    pub nft_destination: Account<'info, TokenAccount>,

    #[account(mut)]
    pub nft_metadata: Box<Account<'info, MetadataAccount>>,
    pub nft_edition: Box<Account<'info, MasterEditionAccount>>,

    #[account(mut)]
    pub source_token_record: Option<Box<Account<'info, TokenRecordAccount>>>,
    /// CHECK: this account is initialized in the CPI call
    #[account(mut)]
    pub destination_token_record: Option<AccountInfo<'info>>,

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

    pub destination: SystemAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub metadata_program: Program<'info, Metadata>,
    /// CHECK: account checked in CPI
    pub sysvar_instructions: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub auth_rules: Option<AccountInfo<'info>>,
    /// CHECK: account checked in CPI
    pub auth_rules_program: Option<AccountInfo<'info>>,
}

impl<'info> RecoverNft<'info> {
    fn transfer_nft(&self, bump: u8) -> Result<()> {
        let entrants_key = &self.entrants.key();
        let metadata_program = &self.metadata_program;
        let token = &self.nft_source.to_account_info();
        let token_owner = &self.raffle.to_account_info();
        let payer = &self.authority.to_account_info();
        let destination_token = &self.nft_destination.to_account_info();
        let destination_owner = &self.authority.to_account_info();
        let mint = &self.nft_mint.to_account_info();
        let metadata = &self.nft_metadata.to_account_info();
        let edition = &self.nft_edition.to_account_info();
        let system_program = &self.system_program.to_account_info();
        let sysvar_instructions = &self.sysvar_instructions.to_account_info();
        let spl_token_program = &&self.token_program.to_account_info();
        let spl_ata_program = &self.associated_token_program.to_account_info();
        let auth_rules_program = self.auth_rules_program.as_ref();
        let auth_rules = self.auth_rules.as_ref();
        let token_record = &self
            .source_token_record
            .as_ref()
            .map(|token_record| token_record.to_account_info());
        let destination_token_record = self.destination_token_record.as_ref();

        let mut cpi_transfer = TransferV1CpiBuilder::new(&metadata_program);

        cpi_transfer
            .token(token)
            .token_owner(token_owner)
            .destination_token(destination_token)
            .destination_owner(destination_owner)
            .mint(mint)
            .metadata(metadata)
            .edition(Some(edition))
            .authority(token_owner)
            .payer(payer)
            .system_program(system_program)
            .sysvar_instructions(sysvar_instructions)
            .spl_token_program(spl_token_program)
            .spl_ata_program(spl_ata_program)
            .authorization_rules_program(auth_rules_program)
            .authorization_rules(auth_rules)
            .token_record(token_record.as_ref())
            .destination_token_record(destination_token_record)
            .amount(1);

        let authority_seed = &[
            &b"RAFFLE"[..],
            &entrants_key.as_ref(),
            &b"raffle"[..],
            &[bump],
        ];

        // performs the CPI
        cpi_transfer.invoke_signed(&[authority_seed])?;
        Ok(())
    }

    pub fn close_account_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_accounts = CloseAccount {
            account: self.nft_source.to_account_info(),
            destination: self.authority.to_account_info(),
            authority: self.raffle.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

pub fn recover_nft_handler(ctx: Context<RecoverNft>) -> Result<()> {
    let entrants_key = ctx.accounts.entrants.key();

    let bump = ctx.bumps.raffle;

    let authority_seed = &[
        &b"RAFFLE"[..],
        &entrants_key.as_ref(),
        &b"raffle"[..],
        &[bump],
    ];

    ctx.accounts.transfer_nft(bump)?;

    close_account(
        ctx.accounts
            .close_account_ctx()
            .with_signer(&[authority_seed]),
    )
}
