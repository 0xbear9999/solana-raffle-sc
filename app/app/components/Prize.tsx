import {
  DigitalAsset,
  DigitalAssetWithToken,
  fetchDigitalAssetWithToken,
} from "@metaplex-foundation/mpl-token-metadata"
import { fetchMint, fetchToken } from "@metaplex-foundation/mpl-toolbox"
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import { Card, CircularProgress, Image } from "@nextui-org/react"
import { useWallet } from "@solana/wallet-adapter-react"
import axios from "axios"
import { DAS } from "helius-sdk"
import { useEffect, useState } from "react"
import { useUmi } from "~/context/umi"
import { imageCdn } from "~/helpers"
import { getTokenAccount } from "~/helpers/pdas"
import { RaffleState, RaffleWithPublicKeyAndEntrants, TokenWithTokenInfo } from "~/types/types"
import { RaffleStateChip } from "./RaffleStateChip"

export function Prize({ raffle, raffleState }: { raffle: RaffleWithPublicKeyAndEntrants; raffleState: RaffleState }) {
  const wallet = useWallet()
  const umi = useUmi()
  const [digitalAsset, setDigitalAsset] = useState<DAS.GetAssetResponse | null>(null)
  const [prizeToken, setPrizeToken] = useState<DigitalAsset | null>(null)

  useEffect(() => {
    if (!wallet.publicKey) {
      return
    }
    if (!raffle.account.prize) {
      setDigitalAsset(null)
      setPrizeToken(null)
      return
    }

    ;(async () => {
      if (raffle.account.prizeType.nft) {
        const { data } = await axios.get<{ digitalAsset: DAS.GetAssetResponse }>(
          `/api/get-nft/${raffle.account.prize.toBase58()}`
        )

        setDigitalAsset(data.digitalAsset)
        setPrizeToken(null)
      } else {
        try {
          const mint = fromWeb3JsPublicKey(raffle.account.prize)
          const token = getTokenAccount(umi, mint, fromWeb3JsPublicKey(raffle.publicKey))
          const da = await fetchDigitalAssetWithToken(umi, mint, token)
          setPrizeToken(da)
          setDigitalAsset(null)
        } catch (err: any) {
          if (err.message.includes("The account of type [Metadata] was not found")) {
            const tokenMint = fromWeb3JsPublicKey(raffle.account.prize)
            const mint = await fetchMint(umi, tokenMint)
            const { data } = await axios.get<{ digitalAsset: TokenWithTokenInfo }>(`/api/get-nft/${tokenMint}`)

            setPrizeToken({
              metadata: {
                name:
                  data.digitalAsset.content?.metadata.name ||
                  data.digitalAsset.content?.metadata.symbol ||
                  data.digitalAsset.token_info.symbol ||
                  "Unknown token",
                symbol: data.digitalAsset.content?.metadata.symbol || data.digitalAsset.token_info.symbol,
              } as any,
              mint,
              publicKey: tokenMint,
            })
          } else {
            console.error(err)
          }
        }
      }
    })()
  }, [raffle.account.prize.toBase58(), wallet.publicKey?.toBase58()])

  return (
    <div className="w-full aspect-square flex items-center justify-center relative">
      {raffle.account.prizeType.nft ? (
        <>{digitalAsset ? <Image src={imageCdn(digitalAsset.content?.links?.image!)} /> : <CircularProgress />}</>
      ) : (
        <Card className="w-full h-full flex justify-center items-center">
          {prizeToken ? (
            <p className="text-primary font-bold text-2xl">
              {(
                Number(
                  (BigInt(raffle.account.prizeType.token.amount.toString()) * 1000n) /
                    BigInt(Math.pow(10, prizeToken.mint.decimals))
                ) / 1000
              ).toLocaleString()}{" "}
              {prizeToken.metadata.symbol || "$TOKEN"}
            </p>
          ) : (
            <CircularProgress />
          )}
        </Card>
      )}

      <RaffleStateChip raffleState={raffleState} raffle={raffle} />
    </div>
  )
}
