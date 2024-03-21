import * as anchor from "@coral-xyz/anchor"
import axios from "axios"
import { GetProgramAccountsFilter } from "@solana/web3.js"

export async function getProgramAccounts(
  program: anchor.Program<any>,
  type: string,
  filters: GetProgramAccountsFilter[] = [],
  decode = false,
  size?: number
) {
  const { data } = await axios.post(process.env.RPC_HOST!, {
    jsonrpc: "2.0",
    id: 1,
    method: "getProgramAccounts",
    params: [
      program.programId.toBase58(),
      {
        encoding: "base64",
        commitment: "processed",
        filters: [
          {
            memcmp: program.coder.accounts.memcmp(type),
          },
          ...filters,
          ...(size
            ? [
                {
                  dataSize: size,
                },
              ]
            : []),
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

export async function getMultipleAccounts(
  addresses: anchor.web3.PublicKey[],
  type: string,
  program: anchor.Program<any>,
  decode: boolean = true
) {
  const { data } = await axios.post(process.env.RPC_HOST!, {
    jsonrpc: "2.0",
    id: 1,
    method: "getMultipleAccounts",
    params: [
      addresses.map((a) => a.toBase58()),
      {
        encoding: "base64",
        commitment: "processed",
      },
    ],
  })

  if (!decode) {
    return data.result.value.map((v: any) => (v ? Buffer.from(v.data[0], "base64") : null))
  }

  return await Promise.all(
    data.result.value.map(async (item: any) => {
      if (!item) {
        return null
      }
      const encoded = Buffer.from(item.data[0], "base64")
      return await program.coder.accounts.decode(type, encoded)
    })
  )
}

export async function getAccount(
  address: anchor.web3.PublicKey,
  type: string,
  program: anchor.Program<any>,
  decode = true
) {
  const { data } = await axios.post(process.env.RPC_HOST!, {
    jsonrpc: "2.0",
    id: 1,
    method: "getAccountInfo",
    params: [
      address,
      {
        encoding: "base64",
        commitment: "processed",
      },
    ],
  })

  if (!data.result.value) {
    return null
  }

  return decode
    ? program.coder.accounts.decode(type, Buffer.from(data.result.value.data[0], "base64"))
    : Buffer.from(data.result.value.data[0], "base64")
}
