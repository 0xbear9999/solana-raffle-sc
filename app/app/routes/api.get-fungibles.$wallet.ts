import { LoaderFunction, json } from "@remix-run/node"
import { getAllFungiblesByOwner, getDigitalAssetsForWallet } from "~/helpers/helius.server"

export const loader: LoaderFunction = async ({ request, params }) => {
  const { wallet } = params
  const digitalAssets = await getAllFungiblesByOwner(wallet!)

  return json({
    digitalAssets,
  })
}
