use std::{
    cell::{Ref, RefMut},
    io::{Read, Write},
};

use anchor_lang::prelude::*;

use crate::RaffleError;

#[account]
pub struct Entrants {
    /// the current number of entrants
    pub total: u32,
    /// the max nuber of entrants
    pub max: u32,
}

impl Entrants {
    pub const BASE_SIZE: usize = 8 + 4 + 4;

    pub fn get_all_entrants(&mut self, mut entrants_data: RefMut<&mut [u8]>, address: Pubkey) {
        let mut entrants_slice = &mut entrants_data[Entrants::BASE_SIZE..];

        msg!("len before {}", entrants_slice.len());
        let mut chunked: Vec<&[u8]> = entrants_slice.chunks(32).collect();
        chunked.retain(|item| Pubkey::try_from(&**item).unwrap() == address);
        entrants_slice.write_all(&chunked.concat());

        // msg!("len after {}", entrants_slice.len());

        // if let Some(index) = chunked
        //     .iter()
        //     .position(|item| Pubkey::try_from(&**item).unwrap() == address)
        // {
        //     chunked._remove(index);
        // }

        // msg!("LENGTH AFTER {}", chunked.len())

        // if let Some(index) = entrants_slice
        //     .chunks_mut(32)
        //     .position(|i| indicies.contains(i))
        // {
        //     entrants_slice.swap_remove(index);
        // }
    }

    pub fn get_entrant(entrants_data: Ref<&mut [u8]>, index: usize) -> Pubkey {
        let start_index = Entrants::BASE_SIZE + 32 * index;
        Pubkey::try_from(&entrants_data[start_index..start_index + 32]).unwrap()
    }

    pub fn append_entrant(
        &mut self,
        mut entrants_data: RefMut<&mut [u8]>,
        entrant: Pubkey,
    ) -> Result<()> {
        msg!("total {}, max {}", self.total, self.max);
        if self.total >= self.max {
            return err!(RaffleError::SoldOut);
        }
        let current_index = Entrants::BASE_SIZE + 32 * self.total as usize;
        let entrant_slice: &mut [u8] = &mut entrants_data[current_index..current_index + 32];
        entrant_slice.copy_from_slice(&entrant.to_bytes());
        self.total += 1;

        Ok(())
    }
}
