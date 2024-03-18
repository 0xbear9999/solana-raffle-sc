import { PropsWithChildren } from "react"
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"

export function WalletProviders({ children, rpcHost }: PropsWithChildren & { rpcHost: string }) {
  return (
    <ConnectionProvider endpoint={rpcHost}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
