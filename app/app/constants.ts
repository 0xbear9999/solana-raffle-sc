import { publicKey } from "@metaplex-foundation/umi"

export enum PriorityFees {
  MIN = "Min",
  LOW = "Low",
  MEDIUM = "Medium",
  HIGH = "High",
  VERYHIGH = "VeryHigh",
  // UNSAFEMAX = "UnsafeMax",
}

export const adminWallet = publicKey("9YjXACMG9MJ6EW9cXneUh5nfc48nUBbwb5DQkhx6qEcY")

export const MAX_TX_SIZE = 1232
export const PRIORITY_FEE_IX_SIZE = 44
export const PRIORITY_AND_COMPUTE_IXS_SIZE = 56
