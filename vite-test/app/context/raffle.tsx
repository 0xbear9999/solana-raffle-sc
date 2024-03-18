import * as anchor from "@coral-xyz/anchor"
import { PropsWithChildren, createContext, useContext } from "react"
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import { metadata } from "~/idl/raffle.json"
import { Raffle, IDL } from "~/types/raffle"

const programId = new anchor.web3.PublicKey(metadata.address)

const Context = createContext<anchor.Program<Raffle> | undefined>(undefined)

export function RaffleProvider({ children }: PropsWithChildren) {
  const wallet = useAnchorWallet()
  const { connection } = useConnection()
  const provider = new anchor.AnchorProvider(connection, wallet!, {})

  const program = new anchor.Program(IDL, programId, provider)
  return <Context.Provider value={program}>{children}</Context.Provider>
}

export const useRaffle = () => {
  const context = useContext(Context)

  if (context === undefined) {
    throw new Error("useAnchor must be used in an AnchorProvider")
  }

  return context
}
