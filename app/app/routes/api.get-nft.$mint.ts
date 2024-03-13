import { LoaderFunction, json } from "@vercel/remix"
import { getDigitalAsset, getDigitalAssetsForWallet } from "~/helpers/helius.server"

export const loader: LoaderFunction = async ({ params }) => {
  const { mint } = params
  const digitalAsset = await getDigitalAsset(mint!)

  return json({
    digitalAsset,
  })
}
