import * as anchor from "@coral-xyz/anchor"
import { keccak_256 } from "js-sha3"
import { raffleProgram } from "./raffle.server"

import bs58 from "bs58"
import { stakeProgram } from "./stake.server"
import { Stake } from "~/types/stake"
import {
  PublicKey,
  Transaction,
  TransactionBuilder,
  Umi,
  createGenericFileFromBrowserFile,
  publicKey,
} from "@metaplex-foundation/umi"
import _, { compact, mapValues } from "lodash"
import { Assets, RaffleState } from "~/types/types"
import axios from "axios"
import { getProgramAccounts } from "./index.server"
import { Connection } from "@solana/web3.js"
import { MAX_TX_SIZE, PRIORITY_AND_COMPUTE_IXS_SIZE, PRIORITY_FEE_IX_SIZE, PriorityFees } from "~/constants"
import { base58 } from "@metaplex-foundation/umi/serializers"
import { getPriorityFeesForTx } from "./helius"
import { setComputeUnitLimit, setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox"

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
    try {
      const promise = umi.uploader.upload(files)
      const result = await Promise.race([promise, sleep(30_000)])
      if (result) {
        resolve(mapValues(result, (item: string) => item.replace(arweave, "")) as [])
      } else {
        reject("Timed out waiting for upload")
      }
    } catch (err) {
      reject(err)
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

export function unsafeSplitByTransactionSizeWithPriorityFees(
  umi: Umi,
  tx: TransactionBuilder,
  computeUnits: boolean
): TransactionBuilder[] {
  return tx.items.reduce(
    (builders, item) => {
      const lastBuilder = builders.pop() as TransactionBuilder
      const lastBuilderWithItem = lastBuilder.add(item)
      if (
        lastBuilderWithItem.getTransactionSize(umi) <=
        MAX_TX_SIZE - (computeUnits ? PRIORITY_AND_COMPUTE_IXS_SIZE : PRIORITY_FEE_IX_SIZE)
      ) {
        builders.push(lastBuilderWithItem)
      } else {
        builders.push(lastBuilder)
        builders.push(lastBuilder.empty().add(item))
      }
      return builders
    },
    [tx.empty()]
  )
}

export async function packTx(umi: Umi, tx: TransactionBuilder, feeLevel: PriorityFees, computeUnits?: number) {
  let chunks = unsafeSplitByTransactionSizeWithPriorityFees(umi, tx, !!computeUnits)

  const [encoded] = base58.deserialize(umi.transactions.serialize(await chunks[0].buildWithLatestBlockhash(umi)))
  const txFee = feeLevel && (await getPriorityFeesForTx(encoded, feeLevel))

  if (computeUnits) {
    chunks = chunks.map((ch) => ch.prepend(setComputeUnitLimit(umi, { units: computeUnits })))
  }

  if (txFee) {
    chunks = chunks.map((ch) => ch.prepend(setComputeUnitPrice(umi, { microLamports: txFee })))
  }
  return { chunks, txFee }
}

export async function sendAllTxsWithRetries(
  umi: Umi,
  connection: Connection,
  signed: Transaction[],
  preIxs = 0,
  delay = 500
) {
  let successes = 0
  let errors = 0

  const lastValidBlockHeight = (await umi.rpc.getLatestBlockhash()).lastValidBlockHeight
  let blockheight = await connection.getBlockHeight("confirmed")
  let blockhash = await umi.rpc.getLatestBlockhash()

  await Promise.all(
    signed.map(async (tx) => {
      const sig = await umi.rpc.sendTransaction(tx, { skipPreflight: true })
      let resolved = false
      const confPromise = umi.rpc.confirmTransaction(sig, {
        strategy: {
          type: "blockhash",
          ...blockhash,
        },
        commitment: "confirmed",
      })

      while (blockheight < lastValidBlockHeight && !resolved) {
        try {
          console.log("Sending tx")
          await umi.rpc.sendTransaction(tx, { skipPreflight: true })
          await sleep(delay)
        } catch (err: any) {
          if (err.message.includes("This transaction has already been processed")) {
            resolved = true
          } else {
            console.error(displayErrorFromLog(err, err.message || "Error sending tx"))
          }
        }
        blockheight = await connection.getBlockHeight()
      }

      const conf = await confPromise

      if (conf.value.err) {
        errors += tx.message.instructions.length - preIxs
      } else {
        successes += tx.message.instructions.length - preIxs
      }
    })
  )

  return {
    successes,
    errors,
  }
}
