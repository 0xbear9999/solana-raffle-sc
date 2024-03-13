use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum EntryType {
    Spend,
    Burn { withold_burn_proceeds: bool },
    Stake { minimum_period: i64 },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum PaymentType {
    Token {
        token_mint: Pubkey,
        ticket_price: u64,
    },
    Nft {
        collection: Pubkey,
    },
}

#[account]
pub struct Raffle {
    /// raffler account that owns this raffle (32)
    pub raffler: Pubkey,
    /// the account the holds the entrants array (32)
    pub entrants: Pubkey,
    /// mint address of the prize (32)
    pub prize: Pubkey,
    /// randomness from VRF (1 + 32)
    pub randomness: Option<[u8; 32]>,
    /// type of entry - Token or NFT (1 + 32 + 8)
    pub entry_type: EntryType,
    /// how do entrants pay for entries (1 + 8)
    pub payment_type: PaymentType,
    /// gate to only holders of a specific collection (1 + 32)
    pub gated_collection: Option<Pubkey>,
    /// timestamp of raffle start (8)
    pub start_time: i64,
    /// timestamp of raffle end (8)
    pub end_time: i64,
    /// has the prize been claimed? (1)
    pub claimed: bool,
    /// basis points of the maximum amount of tickets a single user can buy (2)
    pub max_entrant_pct: u16,
    /// uri link to offchain distribution log (4 + 63)
    pub uri: String,
    /// bump for the raffle PDA (1)
    pub bump: u8,
}

impl Raffle {
    pub const LEN: usize = 8
        + 32
        + 32
        + 32
        + (1 + 32)
        + (1 + 32 + 8)
        + (1 + 8)
        + (1 + 32)
        + 8
        + 8
        + 1
        + 2
        + (4 + 63)
        + 1;

    pub fn init(
        raffler: Pubkey,
        prize: Pubkey,
        entry_type: EntryType,
        payment_type: PaymentType,
        entrants: Pubkey,
        gated_collection: Option<Pubkey>,
        start_time: i64,
        end_time: i64,
        max_entrant_pct: u16,
        bump: u8,
    ) -> Self {
        Self {
            raffler,
            prize,
            entry_type,
            payment_type,
            randomness: None,
            entrants,
            gated_collection,
            start_time,
            end_time,
            claimed: false,
            max_entrant_pct,
            uri: String::new(),
            bump,
        }
    }
}
