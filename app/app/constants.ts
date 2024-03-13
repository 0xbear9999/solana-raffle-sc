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
