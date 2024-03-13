import * as anchor from "@coral-xyz/anchor"
import { Keypair, KeypairSigner, generateSigner, sol } from "@metaplex-foundation/umi"
import { Raffle } from "../target/types/raffle"
import { umi } from "./helpers/umi"
import { toWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters"
import { findProgramConfigPda, findProgramDataAddress } from "./helpers/pdas"
import { RandomnessService } from "@switchboard-xyz/solana-randomness-service"

const RAFFLE_FEE = 0.01 * anchor.web3.LAMPORTS_PER_SOL
const PROCEEDS_PERCENTAGE = 500

const provider = anchor.AnchorProvider.env()
export let randomnessService: RandomnessService
anchor.setProvider(provider)

before(async () => {
  randomnessService = await RandomnessService.fromProvider(provider)
  await adminProgram.methods
    .initProgramConfig(new anchor.BN(RAFFLE_FEE.toString()), PROCEEDS_PERCENTAGE)
    .accounts({
      programConfig: findProgramConfigPda(),
      program: adminProgram.programId,
      programData: findProgramDataAddress(),
    })
    .rpc()
})

export const adminProgram = anchor.workspace.Raffle as anchor.Program<Raffle>

export function programPaidBy(payer: Keypair): anchor.Program<Raffle> {
  const newProvider = new anchor.AnchorProvider(
    adminProgram.provider.connection,
    new anchor.Wallet(toWeb3JsKeypair(payer)),
    {}
  )

  return new anchor.Program(adminProgram.idl, adminProgram.programId, newProvider)
}

export async function createNewUser(): Promise<KeypairSigner> {
  const kp = generateSigner(umi)

  await umi.rpc.airdrop(kp.publicKey, sol(1000))
  return kp
}
