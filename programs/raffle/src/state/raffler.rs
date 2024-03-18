use anchor_lang::prelude::*;

#[account]
pub struct Raffler {
    /// The authority of the raffler (32)
    pub authority: Pubkey,
    /// slug, max 50 chars (4 + 50)
    pub slug: String,
    /// name of the project, max 50 chars (4 + 50)
    pub name: String,
    /// receives the raffle proceeds (32)
    pub treasury: Pubkey,
    /// optional custom domain, max 50 chars (1 + 4 + 50),
    pub custom_domain: Option<String>,
    /// Raffle status (1)
    pub is_active: bool,
    /// optional logo (1 + 4 + 52)
    pub logo: Option<String>,
    /// optional bg (1 + 4 + 52)
    pub bg: Option<String>,
    /// pubkey of linked staker app (1 + 32)
    pub staker: Option<Pubkey>,
    /// bump (1)
    pub bump: u8,
}

impl Raffler {
    pub const LEN: usize = 8
        + 32
        + (4 + 50)
        + (4 + 50)
        + 32
        + (1 + 4 + 50)
        + 1
        + (1 + 4 + 52)
        + (1 + 4 + 52)
        + (1 + 32)
        + 1;

    pub fn init(
        authority: Pubkey,
        slug: String,
        name: String,
        treasury: Pubkey,
        staker: Option<Pubkey>,
        logo: Option<String>,
        bg: Option<String>,
        bump: u8,
    ) -> Self {
        Self {
            authority,
            slug: slug.to_owned(),
            name: name.to_owned(),
            treasury,
            custom_domain: None,
            is_active: false,
            logo,
            bg,
            staker,
            bump,
        }
    }
}
