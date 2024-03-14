import { LoaderFunction, json } from "@vercel/remix"
import { getAllFungiblesByOwner, getDigitalAssetsForWallet } from "~/helpers/helius.server"

export const loader: LoaderFunction = async ({ request, params }) => {
  const { wallet } = params
  const digitalAssets = await getAllFungiblesByOwner(wallet!)

  return json({
    digitalAssets,
  })
}
