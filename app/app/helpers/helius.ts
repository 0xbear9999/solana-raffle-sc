import { PublicKey } from "@metaplex-foundation/umi"
import axios from "axios"
import { Helius } from "helius-sdk"
import { PriorityFees } from "~/constants"

const url = "https://perfect-cordy-fast-mainnet.helius-rpc.com/"

export async function getPriorityFeesForTx(tx: string, feeLevel: PriorityFees) {
  const { data } = await axios.post(url, {
    jsonrpc: "2.0",
    id: "1",
    method: "getPriorityFeeEstimate",
    params: [
      {
        transaction: tx,
        options: { priorityLevel: feeLevel },
      },
    ],
  })

  return data?.result?.priorityFeeEstimate || 0
}
