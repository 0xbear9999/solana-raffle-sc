import { NextUIProvider } from "@nextui-org/react"
import { PropsWithChildren } from "react"
import { WalletProviders } from "./WalletProvider"
import { UmiProvider } from "~/context/umi"
import { DigitalAssetsProvider } from "~/context/digital-assets"
import { PriorityFeesProvider } from "~/context/priority-fees"
import { RaffleProvider } from "~/context/raffle"
import { StakeProvider } from "~/context/stake"
import { ThemeProvider } from "~/context/theme"
import { Theme } from "~/types/types"

export function Providers({ children, rpcHost, theme }: PropsWithChildren<{ rpcHost: string; theme?: Theme }>) {
  return (
    <NextUIProvider>
      <WalletProviders rpcHost={rpcHost}>
        <UmiProvider rpcHost={rpcHost}>
          <DigitalAssetsProvider>
            <PriorityFeesProvider>
              <RaffleProvider>
                <ThemeProvider theme={theme}>
                  <StakeProvider>{children}</StakeProvider>
                </ThemeProvider>
              </RaffleProvider>
            </PriorityFeesProvider>
          </DigitalAssetsProvider>
        </UmiProvider>
      </WalletProviders>
    </NextUIProvider>
  )
}
