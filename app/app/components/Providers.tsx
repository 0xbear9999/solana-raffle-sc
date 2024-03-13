import { NextUIProvider } from "@nextui-org/react"
import { PropsWithChildren } from "react"
import { WalletProviders } from "./WalletProvider"
import { UmiProvider } from "~/context/umi"
import { DigitalAssetsProvider } from "~/context/digital-assets"
import { PriorityFeesProvider } from "~/context/priority-fees"
import { RaffleProvider } from "~/context/raffle"
import { StakeProvider } from "~/context/stake"

export function Providers({ children, rpcHost }: PropsWithChildren<{ rpcHost: string }>) {
  return (
    <NextUIProvider>
      <WalletProviders rpcHost={rpcHost}>
        <UmiProvider rpcHost={rpcHost}>
          <DigitalAssetsProvider>
            <PriorityFeesProvider>
              <RaffleProvider>
                <StakeProvider>{children}</StakeProvider>
              </RaffleProvider>
            </PriorityFeesProvider>
          </DigitalAssetsProvider>
        </UmiProvider>
      </WalletProviders>
    </NextUIProvider>
  )
}
