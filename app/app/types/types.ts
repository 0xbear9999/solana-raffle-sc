import * as anchor from "@coral-xyz/anchor"
import { Raffle as RaffleProgram } from "./raffle"
import { Stake } from "./stake"
import { DAS } from "helius-sdk"

export type RafflerWithPublicKey = {
  publicKey: anchor.web3.PublicKey
  account: Raffler
}

export type RaffleWithPublicKey = {
  publicKey: anchor.web3.PublicKey
  account: Raffle
}

export type RaffleWithPublicKeyAndEntrants = RaffleWithPublicKey & {
  entrants: Entrants
}

export type StakerWithPublicKey = {
  publicKey: anchor.web3.PublicKey
  account: Staker
}

export type Theme = {
  bg?: string | null
  logo?: string | null
}

export type Assets = { bg: string | null; logo: string | null }

export type Entrants = anchor.IdlAccounts<RaffleProgram>["entrants"]
export type Raffler = anchor.IdlAccounts<RaffleProgram>["raffler"]
export type Raffle = anchor.IdlAccounts<RaffleProgram>["raffle"]
export type ProgramConfig = anchor.IdlAccounts<RaffleProgram>["programConfig"]
export type Staker = anchor.IdlAccounts<Stake>["staker"]

export enum RaffleState {
  notStarted = "Not started",
  inProgress = "In progress",
  ended = "Awaiting draw",
  awaitingRandomness = "Awaiting result",
  claimed = "Ended",
  cancelled = "Cancelled",
  drawn = "Drawn",
}

export type TokenWithTokenInfo = DAS.GetAssetResponse & {
  token_info: {
    balance: number
    decimals: number
    symbol: string
    price_info: {
      total_price: number
      price_per_token: number
    }
  }
}
