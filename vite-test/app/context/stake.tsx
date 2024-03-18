import * as anchor from "@coral-xyz/anchor"
import { PropsWithChildren, createContext, useContext } from "react"
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import { metadata } from "~/idl/stake.json"
import { Stake, IDL } from "~/types/stake"

const programId = new anchor.web3.PublicKey(metadata.address)

const Context = createContext<anchor.Program<Stake> | undefined>(undefined)

export function StakeProvider({ children }: PropsWithChildren) {
  const wallet = useAnchorWallet()
  const { connection } = useConnection()
  const provider = new anchor.AnchorProvider(connection, wallet!, {})

  const program = new anchor.Program(IDL, programId, provider)
  return <Context.Provider value={program}>{children}</Context.Provider>
}

export const useStake = () => {
  const context = useContext(Context)

  if (context === undefined) {
    throw new Error("useStake must be used in a StakeProvider")
  }

  return context
}
