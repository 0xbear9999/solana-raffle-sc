import {
  DigitalAsset,
  DigitalAssetWithToken,
  fetchDigitalAssetWithToken,
} from "@metaplex-foundation/mpl-token-metadata"
import { fetchMint, fetchToken } from "@metaplex-foundation/mpl-toolbox"
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import { Card, Chip, CircularProgress, Image } from "@nextui-org/react"
import { useWallet } from "@solana/wallet-adapter-react"
import axios from "axios"
import { DAS } from "helius-sdk"
import { useEffect, useState } from "react"
import { useUmi } from "~/context/umi"
import { imageCdn } from "~/helpers"
import { getTokenAccount } from "~/helpers/pdas"
import {
  Entrants,
  RaffleState,
  RaffleWithPublicKey,
  RaffleWithPublicKeyAndEntrants,
  TokenWithTokenInfo,
} from "~/types/types"
import { RaffleStateChip } from "./RaffleStateChip"

export function Prize({
  raffle,
  raffleState,
  entrants,
}: {
  raffle: RaffleWithPublicKey
  raffleState: RaffleState
  entrants: Entrants
}) {
  const wallet = useWallet()
  const umi = useUmi()
  const [digitalAsset, setDigitalAsset] = useState<TokenWithTokenInfo | null>(null)

  useEffect(() => {
    if (!raffle.account.prize) {
      setDigitalAsset(null)
      return
    }

    ;(async () => {
      const { data } = await axios.get<{ digitalAsset: TokenWithTokenInfo }>(
        `/api/get-nft/${raffle.account.prize.toBase58()}`
      )
      console.log(data)

      setDigitalAsset(data.digitalAsset)
    })()
  }, [raffle.account.prize.toBase58()])

  return (
    <div className="w-full aspect-square flex items-center justify-center relative">
      {raffle.account.prizeType.nft ? (
        <>{digitalAsset ? <Image src={imageCdn(digitalAsset.content?.links?.image!)} /> : <CircularProgress />}</>
      ) : (
        <Card className="w-full h-full">
          {digitalAsset ? (
            <div
              className="w-full h-full flex justify-center items-center"
              style={{
                backgroundImage: `url(${imageCdn(digitalAsset?.content?.links?.image!)}`,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
              }}
            >
              <p className="text-primary font-bold text-2xl bg-background rounded-xl px-2 py-1">
                {(
                  Number(
                    (BigInt(raffle.account.prizeType.token.amount.toString()) * 1000n) /
                      BigInt(Math.pow(10, digitalAsset.token_info.decimals))
                  ) / 1000
                ).toLocaleString()}{" "}
                {digitalAsset.token_info.symbol || "$TOKEN"}
              </p>
              {digitalAsset.token_info.price_info.price_per_token && (
                <Chip className="absolute bottom-5 left-5" color="primary">
                  $
                  {(
                    (digitalAsset.token_info.price_info.price_per_token *
                      raffle.account.prizeType.token.amount.toNumber()) /
                    Math.pow(10, digitalAsset.token_info.decimals)
                  ).toLocaleString()}
                </Chip>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <CircularProgress />
            </div>
          )}
        </Card>
      )}

      <RaffleStateChip raffleState={raffleState} raffle={raffle} entrants={entrants} />
    </div>
  )
}
