import * as anchor from "@coral-xyz/anchor"
import { Signer } from "@metaplex-foundation/umi"
import { Raffle, IDL } from "~/types/raffle"
import { metadata } from "~/idl/raffle.json"

const programId = new anchor.web3.PublicKey(metadata.address)

const connection = new anchor.web3.Connection(process.env.RPC_HOST!, { commitment: "processed" })
export function getProgram(signer: Signer) {
  const provider = new anchor.AnchorProvider(connection, signer as any, {})

  return new anchor.Program<Raffle>(IDL, programId, provider)
}

export const raffleProgram = new anchor.Program<Raffle>(IDL, programId, {
  connection,
})
