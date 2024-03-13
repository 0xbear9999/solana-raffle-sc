"use client"
import { useWallet } from "@solana/wallet-adapter-react"
import { DAS } from "helius-sdk"
import { PropsWithChildren, createContext, useContext, useEffect, useState } from "react"

const Context = createContext<
  | {
      digitalAssets: DAS.GetAssetResponse[]
      fetching: boolean
      removeNft: Function
    }
  | undefined
>(undefined)

export function DigitalAssetsProvider({ children }: PropsWithChildren) {
  const [digitalAssets, setDigitalAssets] = useState<DAS.GetAssetResponse[]>([])
  const [fetching, setFetching] = useState(false)
  const wallet = useWallet()

  async function fetchAssets(wallet: string) {
    if (fetching) {
      return
    }
    const worker = new Worker(`/fetch-assets.worker.js?${Math.random()}`)

    worker.onmessage = async (event) => {
      const { digitalAssets } = event.data
      setDigitalAssets(digitalAssets.filter((da: DAS.GetAssetResponse) => !da.compression?.compressed))
      setFetching(false)
      worker.terminate()
    }
    setFetching(true)

    worker.postMessage({
      wallet,
    })
  }

  useEffect(() => {
    if (!wallet.publicKey) {
      setDigitalAssets([])
      return
    }

    setDigitalAssets([])

    fetchAssets(wallet.publicKey!.toBase58())
  }, [wallet.publicKey])

  function removeNft(mint: string) {
    setDigitalAssets((das) => das.filter((da) => da.id !== mint))
  }

  return <Context.Provider value={{ removeNft, digitalAssets, fetching }}>{children}</Context.Provider>
}

export const useDigitalAssets = () => {
  const context = useContext(Context)

  if (context === undefined) {
    throw new Error("useDigitalAssets must be used in a DigitalAssetsProvider")
  }

  return context
}
