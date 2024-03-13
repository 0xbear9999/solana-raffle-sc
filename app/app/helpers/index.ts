import * as anchor from "@coral-xyz/anchor"
import { keccak_256 } from "js-sha3"
import { raffleProgram } from "./raffle.server"

import bs58 from "bs58"
import { stakeProgram } from "./stake.server"
import { Stake } from "~/types/stake"
import { PublicKey, Umi, publicKey } from "@metaplex-foundation/umi"
import _ from "lodash"
import { RaffleState } from "~/types/types"
import axios from "axios"

export async function getRafflerFromSlug(slug: string) {
  const rafflers = await raffleProgram.account.raffler.all([
    {
      memcmp: {
        offset: 8 + 32 + 4,
        bytes: bs58.encode(Buffer.from(slug)),
      },
    },
  ])

  const raffler = rafflers.find((s) => s.account.slug === slug)
  return raffler
}

export async function getStakerFromSlug(slug: string, program: anchor.Program<Stake> = stakeProgram) {
  const all = await program.account.staker.all()
  const stakers = await program.account.staker.all([
    {
      memcmp: {
        offset: 8 + 32 + 4,
        bytes: bs58.encode(Buffer.from(slug)),
      },
    },
  ])

  const staker = stakers.find((s) => s.account.slug === slug)
  return staker
}

export function imageCdn(src: string, w: number = 400, h: number = 400) {
  return `https://img-cdn.magiceden.dev/rs:fill:${w || ""}:${h || ""}:0:0/plain/${src}`
}

export async function getEntrantsArray(umi: Umi, entrantsPk: PublicKey) {
  const acc = await umi.rpc.getAccount(entrantsPk)
  const data = acc.exists && acc.data.slice(8 + 4 + 4)
  if (!data) {
    return []
  }
  return dataToPks(data)
}

export function dataToPks(data: Uint8Array) {
  return _.chunk(data as any, 32).map((arr) => publicKey(new Uint8Array(arr as any)))
}
// Output is only u32, so can be a number
export function expandRandomness(randomValue: number[]): number {
  const hasher = keccak_256.create()
  hasher.update(new Uint8Array(randomValue))

  return new anchor.BN(hasher.digest().slice(0, 4), "le").toNumber()
}

export function shorten(address: string) {
  if (!address) {
    return
  }
  return `${address.substring(0, 4)}...${address.substring(address.length - 4, address.length)}`
}

export function isLive(state: RaffleState) {
  return [RaffleState.inProgress, RaffleState.notStarted].includes(state)
}

export async function entrantsFromUri(uri: string) {
  const { data } = await axios.get(uri)
  return Buffer.from(Object.values(data) as number[])
}
