use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{Metadata, MetadataAccount},
    token::{
        burn, close_account, sync_native, transfer, Burn, CloseAccount, Mint, SyncNative, Token,
        TokenAccount, Transfer,
    },
};
use solana_program::system_instruction;

use crate::{
    state::{Entrants, EntryType, PaymentType, Raffle, Raffler},
    utils::add_entrants,
    RaffleError, NATIVE_MINT,
};

#[derive(Accounts)]
pub struct BuyTicketsToken<'info> {
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
        address = match raffle.payment_type {
            PaymentType::Token { token_mint, ticket_price: _ } => token_mint,
            _ => return err!(RaffleError::TokenMintUnexpected)
        } @ RaffleError::InvalidTokenMint
    )]
    pub token_mint: Option<Box<Account<'info, Mint>>>,

    #[account(
        init_if_needed,
        payer = entrant,
        associated_token::mint = token_mint,
        associated_token::authority = entrant
    )]
    pub token_source: Option<Box<Account<'info, TokenAccount>>>,

    #[account(
        init_if_needed,
        payer = entrant,
        associated_token::mint = token_mint,
        associated_token::authority = raffle
    )]
    pub token_destination: Option<Box<Account<'info, TokenAccount>>>,

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
}

impl<'info> BuyTicketsToken<'info> {
    pub fn burn_token_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        let cpi_accounts = Burn {
            mint: self
                .token_mint
                .as_ref()
                .expect("expected token_mint account")
                .to_account_info(),
            from: self
                .token_source
                .as_ref()
                .expect("expected token_source account")
                .to_account_info(),
            authority: self.entrant.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn transfer_token_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .token_source
                .as_ref()
                .expect("token_source account expected")
                .to_account_info(),
            to: self
                .token_destination
                .as_ref()
                .expect("token_destination account expected")
                .to_account_info(),
            authority: self.entrant.to_account_info(),
        };

        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    fn sync_native_purchaser_ctx(&self) -> CpiContext<'_, '_, '_, 'info, SyncNative<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            SyncNative {
                account: self.token_source.as_ref().unwrap().to_account_info(),
            },
        )
    }

    pub fn close_account_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_accounts = CloseAccount {
            account: self.token_source.as_ref().unwrap().to_account_info(),
            destination: self.entrant.to_account_info(),
            authority: self.entrant.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

pub fn buy_tickets_token_handler(ctx: Context<BuyTicketsToken>, amount: u32) -> Result<()> {
    let raffle = &ctx.accounts.raffle;

    if raffle.gated_collection.is_some() {
        require!(
            ctx.accounts.gated_nft_metadata.is_some(),
            RaffleError::GatedRaffle
        )
    }

    require!(raffle.uri.len() == 0, RaffleError::RaffleEnded);
    require!(raffle.randomness.is_none(), RaffleError::RaffleEnded);
    require!(!raffle.claimed, RaffleError::RaffleEnded);

    let amount_u64 = amount as u64;

    match raffle.payment_type {
        PaymentType::Token {
            token_mint,
            ticket_price,
        } => {
            let cost = ticket_price
                .checked_mul(amount_u64)
                .ok_or(RaffleError::ProgramMulError)?;

            let token_mint_acc = &ctx.accounts.token_mint.as_ref().unwrap();
            let token_source = &ctx.accounts.token_source.as_ref().unwrap();

            require_keys_eq!(
                token_mint,
                token_mint_acc.key(),
                RaffleError::InvalidTokenMint
            );

            if token_mint == NATIVE_MINT {
                let minimum_balance_for_rent_exemption: u64 =
                    Rent::get()?.minimum_balance(anchor_spl::token::TokenAccount::LEN);
                let minimum_balance_plus_total_transfer_amount: u64 =
                    minimum_balance_for_rent_exemption
                        .checked_add(cost)
                        .ok_or(RaffleError::ProgramMulError)?;

                msg!("minimum_balance_for_rent_exemption {}, minimum_balance_plus_total_transfer_amount {}", minimum_balance_for_rent_exemption, minimum_balance_plus_total_transfer_amount);

                if token_source.amount < minimum_balance_plus_total_transfer_amount {
                    let lamports_difference = minimum_balance_plus_total_transfer_amount
                        .checked_sub(token_source.amount)
                        .ok_or(RaffleError::ProgramSubError)?;

                    anchor_lang::solana_program::program::invoke(
                        &system_instruction::transfer(
                            &ctx.accounts.entrant.key(),
                            &token_source.key(),
                            lamports_difference,
                        ),
                        &[
                            ctx.accounts.entrant.to_account_info(),
                            token_source.to_account_info(),
                            ctx.accounts.system_program.to_account_info(),
                        ],
                    )?;

                    sync_native(
                        ctx.accounts.sync_native_purchaser_ctx(), // .with_signer(&[&marketplace.marketplace_seeds()]),
                    )?;

                    transfer(ctx.accounts.transfer_token_ctx(), cost)?;
                } else {
                    transfer(ctx.accounts.transfer_token_ctx(), cost)?;
                }
            } else {
                if matches!(
                    raffle.entry_type,
                    EntryType::Burn {
                        withold_burn_proceeds: _
                    }
                ) {
                    burn(ctx.accounts.burn_token_ctx(), cost)?;
                } else {
                    transfer(ctx.accounts.transfer_token_ctx(), cost)?;
                }
            }

            if token_source.amount == 0 {
                close_account(ctx.accounts.close_account_ctx())?;
            }
        }
        PaymentType::Nft { collection: _ } => return err!(RaffleError::TokenInstruction),
        _ => {}
    }

    add_entrants(
        &mut ctx.accounts.entrants,
        ctx.accounts.entrant.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
        amount,
    )?;

    Ok(())
}
