use anchor_lang::prelude::*;

#[account]
pub struct ProgramConfig {
    /// the amount in sol to set up a raffle (8)
    pub raffle_fee: u64,
    /// the percentage in basis points of proceeds share (2)
    pub proceeds_share: u16,
    /// a vector storing all slugs (4)
    pub slugs: Vec<String>,
    /// the bump of the program_config account (1)
    pub bump: u8,
}

impl ProgramConfig {
    pub const LEN: usize = 8 + 8 + 2 + 4 + 1;

    pub fn current_len(&self) -> usize {
        ProgramConfig::LEN + 50 * self.slugs.len()
    }

    pub fn init(raffle_fee: u64, proceeds_share: u16, bump: u8) -> Self {
        Self {
            raffle_fee,
            proceeds_share,
            slugs: vec![],
            bump,
        }
    }
}
