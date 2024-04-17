use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{mpl_token_metadata::instructions::TransferV1CpiBuilder, Metadata},
    token::{close_account, transfer, CloseAccount, Mint, Token, TokenAccount, Transfer},
};

use crate::{
    state::{Entrants, EntryType, PaymentType, PrizeType, ProgramConfig, Raffle, Raffler},
    utils::expand_randomness,
    RaffleError, FEES_WALLET, NATIVE_MINT,
};

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(
        seeds = [b"program-config"],
        bump
    )]
    pub program_config: Box<Account<'info, ProgramConfig>>,

    #[account(
        seeds = [
            b"RAFFLE",
            raffler.authority.as_ref(),
            b"raffler"
        ],
        bump = raffler.bump,
        has_one = authority
    )]
    pub raffler: Box<Account<'info, Raffler>>,

    #[account(
        mut,
        seeds = [
            b"RAFFLE",
            entrants.key().as_ref(),
            b"raffle"
        ],
        bump = raffle.bump,
        has_one = entrants,
        has_one = prize,
        has_one = raffler
    )]
    pub raffle: Box<Account<'info, Raffle>>,

    #[account(mut)]
    pub entrants: Box<Account<'info, Entrants>>,

    #[account( mut, address = FEES_WALLET )]
    pub fees_wallet: Option<SystemAccount<'info>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = proceeds_mint,
        associated_token::authority = fees_wallet
    )]
    pub fees_wallet_token: Option<Box<Account<'info, TokenAccount>>>,

    #[account(
        address = match raffle.payment_type {
            PaymentType::Token { token_mint, ticket_price: _ } => token_mint,
            PaymentType::Nft { collection } => {
                if matches!(raffle.entry_type, EntryType::Burn { withold_burn_proceeds: true }) {
                    NATIVE_MINT
                } else {
                    return err!(RaffleError::TokenMintUnexpected)
                }
            }
            _ => return err!(RaffleError::TokenMintUnexpected)
        } @ RaffleError::InvalidTokenMint
    )]
    pub proceeds_mint: Option<Box<Account<'info, Mint>>>,

    #[account(
        mut,
        associated_token::mint = proceeds_mint,
        associated_token::authority = raffle
    )]
    pub proceeds_source: Option<Box<Account<'info, TokenAccount>>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = proceeds_mint,
        associated_token::authority = treasury
    )]
    pub proceeds_destination: Option<Box<Account<'info, TokenAccount>>>,

    #[account(address = raffle.prize)]
    pub prize: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = prize,
        associated_token::authority = raffle
    )]
    pub prize_custody: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = prize,
        associated_token::authority = winner
    )]
    pub prize_destination: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub winner: SystemAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub authority: SystemAccount<'info>,

    #[account(mut, address = raffler.treasury)]
    pub treasury: Option<SystemAccount<'info>>,

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

impl<'info> ClaimPrize<'info> {
    fn transfer_nft(
        &self,
        prize_metadata: &AccountInfo<'info>,
        prize_master_edition: &AccountInfo<'info>,
        source_token_record: Option<AccountInfo<'info>>,
        destination_token_record: Option<AccountInfo<'info>>,
    ) -> Result<()> {
        let entrants_key = &self.entrants.key();
        let bump = self.raffle.bump;
        let metadata_program = &self.metadata_program;
        let token = &self.prize_custody.to_account_info();
        let token_owner = &self.raffle.to_account_info();
        let payer = &self.payer.to_account_info();
        let destination_token = &self.prize_destination.to_account_info();
        let destination_owner = &self.winner.to_account_info();
        let mint = &self.prize.to_account_info();
        let system_program = &self.system_program.to_account_info();
        let sysvar_instructions = &self.sysvar_instructions.to_account_info();
        let spl_token_program = &&self.token_program.to_account_info();
        let spl_ata_program = &self.associated_token_program.to_account_info();
        let auth_rules_program = self.auth_rules_program.as_ref();
        let auth_rules = self.auth_rules.as_ref();
        let token_record = source_token_record
            .as_ref()
            .map(|token_record| token_record.to_account_info());
        let destination_token_record = destination_token_record.as_ref();

        let mut cpi_transfer = TransferV1CpiBuilder::new(&metadata_program);

        cpi_transfer
            .token(token)
            .token_owner(token_owner)
            .destination_token(destination_token)
            .destination_owner(destination_owner)
            .mint(mint)
            .metadata(&prize_metadata)
            .edition(Some(&prize_master_edition))
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
            account: self.prize_custody.to_account_info(),
            destination: self.authority.to_account_info(),
            authority: self.raffle.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn transfer_proceeds_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .proceeds_source
                .as_ref()
                .expect("token_account expected")
                .to_account_info(),
            to: self
                .proceeds_destination
                .as_ref()
                .expect("destination_token expected")
                .to_account_info(),
            authority: self.raffle.to_account_info(),
        };

        let cpi_program = self.token_program.to_account_info();

        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn transfer_proceeds_share_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .proceeds_source
                .as_ref()
                .expect("token_account expected")
                .to_account_info(),
            to: self
                .fees_wallet_token
                .as_ref()
                .expect("fee_token expected")
                .to_account_info(),
            authority: self.raffle.to_account_info(),
        };

        let cpi_program = self.token_program.to_account_info();

        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn transfer_prize_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.prize_custody.to_account_info(),
            to: self.prize_destination.to_account_info(),
            authority: self.raffle.to_account_info(),
        };

        let cpi_program = self.token_program.to_account_info();

        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn close_proceeds_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_accounts = CloseAccount {
            account: self.proceeds_source.as_ref().unwrap().to_account_info(),
            destination: self.authority.to_account_info(),
            authority: self.raffle.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

pub fn claim_prize_handler<'info>(
    ctx: Context<'_, '_, '_, 'info, ClaimPrize<'info>>,
    ticket_index: u32,
) -> Result<()> {
    let rafflooor = &ctx.accounts.raffler;
    let raffle = &ctx.accounts.raffle;
    let entrants_key = ctx.accounts.entrants.key();
    let remaining_accounts = &mut ctx.remaining_accounts.iter();
    let bump = raffle.bump;

    let authority_seed = &[
        &b"RAFFLE"[..],
        &entrants_key.as_ref(),
        &b"raffle"[..],
        &[bump],
    ];

    let prize_metadata = if raffle.prize_type == PrizeType::Nft {
        Some(next_account_info(remaining_accounts)?)
    } else {
        None
    };

    let prize_master_edition = if raffle.prize_type == PrizeType::Nft {
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

    require!(!raffle.claimed, RaffleError::AlreadyClaimed);

    let entrants = &ctx.accounts.entrants;

    if entrants.total == 0 {
        require_keys_eq!(
            ctx.accounts.winner.key(),
            ctx.accounts.raffler.authority,
            RaffleError::OnlyAdminCanClaim
        );
    } else {
        let randomness = match raffle.randomness {
            Some(randomness) => randomness,
            None => return err!(RaffleError::WinnerNotDrawn),
        };
        let winner_rand = expand_randomness(randomness);
        let winner_index = winner_rand % entrants.total;

        msg!("winner rand {} winner index {}", winner_rand, winner_index);

        require_eq!(ticket_index, winner_index, RaffleError::TicketNotWinner);

        let entrant_for_ticket = Entrants::get_entrant(
            ctx.accounts.entrants.to_account_info().data.borrow(),
            ticket_index as usize,
        );

        require_keys_eq!(
            ctx.accounts.winner.key(),
            entrant_for_ticket,
            RaffleError::NotWinner
        );

        if ctx.accounts.payer.key() != ctx.accounts.winner.key() {
            require_keys_eq!(
                ctx.accounts.payer.key(),
                rafflooor.authority,
                RaffleError::OnlyWinnerOrAdminCanSettle
            );
        }
    }

    let should_transfer = match raffle.payment_type {
        PaymentType::Nft { collection: _ } => {
            matches!(
                raffle.entry_type,
                EntryType::Burn {
                    withold_burn_proceeds: true
                }
            )
        }
        PaymentType::Token {
            token_mint: _,
            ticket_price: _,
        } => true,
        _ => false,
    };

    if should_transfer {
        msg!("Transferring token");

        let fee_bp = ctx.accounts.program_config.proceeds_share;
        let proceeds = ctx.accounts.proceeds_source.as_ref().unwrap().amount;

        let proceeds_128 = proceeds as u128;
        let fee_bp_128 = fee_bp as u128;
        let fee_128 = proceeds_128 * fee_bp_128 / 10_000;
        let fee_64 = u64::try_from(fee_128).unwrap();

        let treasury_proceeds = proceeds
            .checked_sub(fee_64)
            .ok_or(RaffleError::ProgramSubError)?;

        if fee_64 > 0 {
            transfer(
                ctx.accounts
                    .transfer_proceeds_share_ctx()
                    .with_signer(&[authority_seed]),
                fee_64,
            )?;
        }

        if treasury_proceeds > 0 {
            transfer(
                ctx.accounts
                    .transfer_proceeds_ctx()
                    .with_signer(&[authority_seed]),
                treasury_proceeds,
            )?;
        }

        close_account(
            ctx.accounts
                .close_proceeds_ctx()
                .with_signer(&[authority_seed]),
        )?;
    }

    let raffle = &mut ctx.accounts.raffle;

    raffle.claimed = true;

    match raffle.prize_type {
        PrizeType::Nft => {
            ctx.accounts.transfer_nft(
                prize_metadata.unwrap(),
                prize_master_edition.unwrap(),
                source_token_record,
                destination_token_record,
            )?;
        }
        PrizeType::Token { amount } => {
            transfer(
                ctx.accounts
                    .transfer_prize_ctx()
                    .with_signer(&[authority_seed]),
                amount,
            )?;
        }
    }

    close_account(
        ctx.accounts
            .close_account_ctx()
            .with_signer(&[authority_seed]),
    )
}
