import * as anchor from "@coral-xyz/anchor"
import { Signer } from "@metaplex-foundation/umi"
import { Stake, IDL } from "~/types/stake"
import { metadata } from "~/idl/stake.json"

const programId = new anchor.web3.PublicKey(metadata.address)

const connection = new anchor.web3.Connection(process.env.RPC_HOST!, { commitment: "processed" })

export const stakeProgram = new anchor.Program<Stake>(IDL, programId, {
  connection,
})
