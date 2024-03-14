import * as anchor from "@coral-xyz/anchor"
import axios from "axios"
import { GetProgramAccountsFilter } from "@solana/web3.js"

export async function getAccounts(
  program: anchor.Program<any>,
  type: string,
  filters: GetProgramAccountsFilter[] = [],
  decode = false
) {
  const { data } = await axios.post(process.env.RPC_HOST!, {
    jsonrpc: "2.0",
    id: 1,
    method: "getProgramAccounts",
    params: [
      program.programId.toBase58(),
      {
        encoding: "base64",
        filters: [
          {
            memcmp: program.coder.accounts.memcmp(type),
          },
          ...filters,
        ],
      },
    ],
  })

  return await Promise.all(
    data.result.map(async (item: any) => {
      const encoded = Buffer.from(item.account.data[0], "base64")
      return {
        publicKey: new anchor.web3.PublicKey(item.pubkey),
        account: decode ? await program.coder.accounts.decode(type, encoded) : encoded,
      }
    })
  )
}

export async function getAccount(address: anchor.web3.PublicKey, type: string, program: anchor.Program<any>) {
  const { data } = await axios.post(process.env.RPC_HOST!, {
    jsonrpc: "2.0",
    id: 1,
    method: "getAccountInfo",
    params: [
      address,
      {
        encoding: "base64",
      },
    ],
  })

  if (!data.result.value) {
    return null
  }

  return program.coder.accounts.decode(type, Buffer.from(data.result.value.data[0], "base64"))
}
