import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata"
import { Umi } from "@metaplex-foundation/umi"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters"
import { useWallet } from "@solana/wallet-adapter-react"
import { ReactNode, createContext, useContext } from "react"
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys"
import { mplToolbox } from "@metaplex-foundation/mpl-toolbox"

const Context = createContext<Umi | undefined>(undefined)

export function UmiProvider({ children, rpcHost }: { children: ReactNode; rpcHost: string }) {
  const wallet = useWallet()
  const umi = createUmi(rpcHost, {
    commitment: "processed",
  })
    .use(mplToolbox())
    .use(mplTokenMetadata())
    .use(walletAdapterIdentity(wallet))
    .use(irysUploader())
  return <Context.Provider value={umi}>{children}</Context.Provider>
}

export const useUmi = () => {
  const context = useContext(Context)

  if (context === undefined) {
    throw new Error("useUmi must be used in a UmiProvider")
  }

  return context
}
