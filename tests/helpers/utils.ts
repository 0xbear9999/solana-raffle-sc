import sha3 from "js-sha3"
import * as anchor from "@coral-xyz/anchor"
import { PublicKey, Umi, publicKey } from "@metaplex-foundation/umi"
import assert from "assert"
import { createNft } from "./create-nft"
import { umi } from "./umi"
import { RafflooorProgram } from "../../target/types/rafflooor_program"
import { safeFetchToken } from "@metaplex-foundation/mpl-toolbox"
import { getTokenAccount } from "./pdas"
import { createSignerFromKeypair } from "@metaplex-foundation/umi"
import _ from "lodash"
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import { Raffle } from "../../target/types/raffle"

export const TX_FEE = 5000n
export const MAX_REALLOC_SIZE = 10240
export const PNFT_SIZE = 11957280n

export const FEES_WALLET = publicKey("D7sZPRf5WRC6BpLsu6k3gwcwxZGxbTrFMyDvrMxkVeJP")

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function assertErrorLogContains(
  err: {
    logs: string[]
  },
  text: string
) {
  assert.ok(err.logs.find((log) => log.includes(text)))
}

export async function expectFail(func: Function, onError: Function) {
  try {
    await func()
    assert.fail("Expected function to throw")
  } catch (err) {
    if (err.code === "ERR_ASSERTION") {
      throw err
    } else {
      onError(err)
    }
  }
}

export async function mintNfts(collection: PublicKey, num: number, isPnft: boolean, owner?: PublicKey) {
  return await Promise.all(Array.from(new Array(num).keys()).map((async) => createNft(umi, isPnft, collection, owner)))
}

export function assertErrorCode(err: any, code) {
  assert.equal(err?.error?.errorCode?.code, code, `Expected code ${code}`)
}

export function assertEqualishLamports(num1: bigint, num2: bigint, msg?: string) {
  assert.ok(Math.abs(Number(num1) - Number(num2)) < 100, msg)
}

export async function getTokenAmount(tokenMint: PublicKey, owner: PublicKey): Promise<bigint> {
  return (await safeFetchToken(umi, getTokenAccount(tokenMint, owner)))?.amount || 0n
}

export const DANDIES_COLLECTION_SIGNER = createSignerFromKeypair(
  umi,
  umi.eddsa.createKeypairFromSecretKey(
    new Uint8Array([
      28, 127, 4, 68, 83, 107, 119, 245, 87, 122, 132, 15, 19, 6, 68, 155, 200, 25, 56, 122, 45, 245, 46, 220, 105, 164,
      31, 232, 54, 172, 57, 31, 6, 198, 239, 111, 3, 115, 20, 233, 175, 73, 62, 115, 210, 231, 239, 42, 216, 101, 152,
      194, 60, 58, 210, 53, 153, 124, 189, 188, 176, 8, 77, 71,
    ])
  )
)

// Output is only u32, so can be a number
export function expandRandomness(randomValue: number[]): number {
  const hasher = sha3.keccak_256.create()
  hasher.update(new Uint8Array(randomValue))

  return new anchor.BN(hasher.digest().slice(0, 4), "le").toNumber()
}

export async function getEntrantsArray(entrantsPk: PublicKey) {
  const acc = await umi.rpc.getAccount(entrantsPk)
  const data = acc.exists && acc.data.slice(8 + 4 + 4)
  return _.chunk(data, 32).map((arr) => publicKey(new Uint8Array(arr)))
}

export async function getWinner(program: anchor.Program<Raffle>, randomness: number[], entrants: PublicKey) {
  const winnerRand = expandRandomness(randomness)
  const entrantsAcc = await program.account.entrants.fetch(entrants)
  const winnerIndex = winnerRand % entrantsAcc.total

  const entrantsArray = await getEntrantsArray(entrants)
  return [entrantsArray[winnerIndex], winnerIndex]
}
