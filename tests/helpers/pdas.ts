import { umi } from "./umi"
import idl from "../../target/idl/raffle.json"
import { PublicKey, publicKey } from "@metaplex-foundation/umi"
import { string, publicKey as publicKeySerializer } from "@metaplex-foundation/umi-serializers"
import { findAssociatedTokenPda } from "@metaplex-foundation/mpl-toolbox"
import { findTokenRecordPda } from "@metaplex-foundation/mpl-token-metadata"
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import { NATIVE_MINT } from "@switchboard-xyz/solana-randomness-service"

const programId = publicKey(idl.metadata.address)

export function getTokenAccount(mint: PublicKey, owner: PublicKey) {
  return findAssociatedTokenPda(umi, { mint, owner })[0]
}

export function findProgramConfigPda() {
  return umi.eddsa.findPda(programId, [string({ size: "variable" }).serialize("program-config")])[0]
}

export function findProgramDataAddress() {
  return umi.eddsa.findPda(publicKey("BPFLoaderUpgradeab1e11111111111111111111111"), [
    publicKeySerializer().serialize(programId),
  ])[0]
}

export function findRafflerPda(authority: PublicKey) {
  return umi.eddsa.findPda(programId, [
    string({ size: "variable" }).serialize("RAFFLE"),
    publicKeySerializer().serialize(authority),
    string({ size: "variable" }).serialize("raffler"),
  ])[0]
}

export function findRafflePda(entrants: PublicKey) {
  return umi.eddsa.findPda(programId, [
    string({ size: "variable" }).serialize("RAFFLE"),
    publicKeySerializer().serialize(entrants),
    string({ size: "variable" }).serialize("raffle"),
  ])[0]
}

export function findProceedsAuthPda(raffle: PublicKey) {
  return umi.eddsa.findPda(programId, [
    string({ size: "variable" }).serialize("RAFFLE"),
    publicKeySerializer().serialize(raffle),
    string({ size: "variable" }).serialize("proceeds-auth"),
  ])[0]
}

export function getTokenRecordPda(mint: PublicKey, owner: PublicKey) {
  return findTokenRecordPda(umi, {
    mint,
    token: getTokenAccount(mint, owner),
  })[0]
}

export const nativeMint = fromWeb3JsPublicKey(NATIVE_MINT)
