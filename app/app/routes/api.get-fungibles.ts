import { ActionFunctionArgs } from "@remix-run/node"
import { LoaderFunction, json } from "@vercel/remix"
import { getAllFungibles } from "~/helpers/helius.server"

export const action = async ({ request }: ActionFunctionArgs) => {
  const { mints } = await request.json()
  const fungibles = await getAllFungibles(mints)

  return json({
    fungibles,
  })
}
