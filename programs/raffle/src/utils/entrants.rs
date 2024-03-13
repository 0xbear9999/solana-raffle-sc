use anchor_lang::prelude::*;
use solana_program::system_instruction;

use crate::{state::Entrants, RaffleError};

pub fn add_entrants<'info>(
    entrants: &mut Account<'info, Entrants>,
    entrant_account_info: AccountInfo<'info>,
    system_program_account_info: AccountInfo<'info>,
    amount: u32,
) -> Result<()> {
    let entrants_account_info: AccountInfo<'info> = entrants.to_account_info();
    let required_size = 8 + 4 + 4 + (entrants.total + amount) * 32;
    let required_lamports = Rent::get().unwrap().minimum_balance(required_size as usize);
    let current_lamports = entrants_account_info.lamports();
    let entrant_key = entrant_account_info.key();

    msg!(
        "required_size {}, required_lamports {} current_lamports {}",
        required_size,
        required_lamports,
        current_lamports
    );

    if required_lamports > current_lamports {
        let lamports = required_lamports
            .checked_sub(current_lamports)
            .ok_or(RaffleError::ProgramSubError)?;

        anchor_lang::solana_program::program::invoke(
            &system_instruction::transfer(
                &entrant_account_info.key(),
                &entrants_account_info.key(),
                lamports,
            ),
            &[
                entrant_account_info,
                entrants_account_info.clone(),
                system_program_account_info,
            ],
        )?;

        entrants
            .to_account_info()
            .realloc(required_size as usize, false)?;
    }

    for _ in 0..amount {
        entrants.append_entrant(entrants_account_info.data.borrow_mut(), entrant_key)?;
    }

    msg!("Total entrants: {}", entrants.total);

    Ok(())
}
