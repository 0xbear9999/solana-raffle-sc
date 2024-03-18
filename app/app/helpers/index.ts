import * as anchor from "@coral-xyz/anchor"
import { keccak_256 } from "js-sha3"
import { raffleProgram } from "./raffle.server"

import bs58 from "bs58"
import { stakeProgram } from "./stake.server"
import { Stake } from "~/types/stake"
import { PublicKey, Umi, createGenericFileFromBrowserFile, publicKey } from "@metaplex-foundation/umi"
import _, { compact, mapValues } from "lodash"
import { Assets, RaffleState } from "~/types/types"
import axios from "axios"
import { getProgramAccounts } from "./index.server"

export async function getRafflerFromSlug(slug: string) {
  const rafflers = await getProgramAccounts(
    raffleProgram,
    "raffler",
    [
      {
        memcmp: {
          offset: 8 + 32 + 4,
          bytes: bs58.encode(Buffer.from(slug)),
        },
      },
    ],
    true
  )

  const raffler = rafflers.find((s) => s.account.slug === slug)
  return raffler
}

export async function getStakerFromSlug(slug: string, program: anchor.Program<Stake> = stakeProgram) {
  const stakers = await getProgramAccounts(
    stakeProgram,
    "staker",
    [
      {
        memcmp: {
          offset: 8 + 32 + 4,
          bytes: bs58.encode(Buffer.from(slug)),
        },
      },
    ],
    true
  )

  const staker = stakers.find((s) => s.account.slug === slug)
  return staker
}

export async function getStakerFromSlugProgram(slug: string, program: anchor.Program<Stake> = stakeProgram) {
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

export function displayErrorFromLog(err: any, fallback: string = "Unable to perform action") {
  const errMessage = err.logs?.find((l: string) => l.includes("Error Message:"))?.split("Error Message: ")?.[1]
  return errMessage || err.message || fallback
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function uploadFiles(umi: Umi, logoFile: File | null, bgFile: File | null): Promise<Assets> {
  const arweave = "https://arweave.net/"
  const files = await Promise.all(
    compact([bgFile, logoFile]).map((item) =>
      createGenericFileFromBrowserFile(item, {
        contentType: item.type,
        extension: item.name.split(".")[1],
      })
    )
  )

  const result = await new Promise<string[]>(async (resolve, reject) => {
    const promise = umi.uploader.upload(files)
    const result = await Promise.race([promise, sleep(30_000)])
    if (result) {
      resolve(mapValues(result, (item: string) => item.replace(arweave, "")) as [])
    } else {
      throw new Error("Timed out waiting for upload")
    }
  })

  if (bgFile && !logoFile) {
    return {
      bg: `${result[0]}?ext=${bgFile.name.split(".")[1]}`,
      logo: null,
    }
  } else if (!bgFile && logoFile) {
    return {
      logo: `${result[0]}?ext=${logoFile.name.split(".")[1]}`,
      bg: null,
    }
  } else {
    return {
      bg: `${result[0]}?ext=${bgFile?.name.split(".")[1]}`,
      logo: `${result[1]}?ext=${logoFile?.name.split(".")[1]}`,
    }
  }
}
