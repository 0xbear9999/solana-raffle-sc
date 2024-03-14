import { LoaderFunction, json } from "@vercel/remix"
import { getDigitalAssetsForWallet } from "~/helpers/helius.server"

export const loader: LoaderFunction = async ({ request, params }) => {
  const { wallet } = params
  const digitalAssets = await getDigitalAssetsForWallet(wallet!)

  return json({
    digitalAssets,
  })
}
