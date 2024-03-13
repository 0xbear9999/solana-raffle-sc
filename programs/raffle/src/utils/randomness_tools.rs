use anchor_lang::solana_program::keccak;

pub fn expand_randomness(randomness: [u8; 32]) -> u32 {
    let mut hasher = keccak::Hasher::default();
    hasher.hash(&randomness);

    u32::from_le_bytes(
        hasher.result().to_bytes()[0..4]
            .try_into()
            .expect("slice with incorrect length"),
    )
}
