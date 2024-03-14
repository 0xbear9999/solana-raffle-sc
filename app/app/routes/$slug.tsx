import * as anchor from "@coral-xyz/anchor"
import { Button, Tab, Tabs } from "@nextui-org/react"
import { LoaderFunction, MetaFunction, json } from "@vercel/remix"
import { Link, Outlet, useLoaderData } from "@remix-run/react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useRaffle } from "~/context/raffle"
import { getRafflerFromSlug, getStakerFromSlug } from "~/helpers"
import { raffleProgram } from "~/helpers/raffle.server"
import { stakeProgram } from "~/helpers/stake.server"
import { Raffler, RafflerWithPublicKey } from "~/types/types"
import { umi } from "~/helpers/umi"
import { getAccount } from "~/helpers/index.server"

export const meta: MetaFunction = ({ data }: { data: any }) => {
  return [{ title: `${data.name} // RAFFLE` }]
}

export const loader: LoaderFunction = async ({ params }) => {
  const { slug } = params
  const raffler = await getRafflerFromSlug(slug as string)
  const staker = raffler?.account.staker ? await getAccount(raffler.account.staker, "staker", stakeProgram) : null
  const encoded = await raffleProgram.coder.accounts.encode("raffler", raffler?.account)

  return json({
    raffler: {
      publicKey: raffler?.publicKey,
      account: encoded,
    },
    name: raffler?.account.name,
    theme: staker?.theme,
  })
}

export default function Raffle() {
  const data = useLoaderData<typeof loader>()
  const raffleProgram = useRaffle()
  const raffler: RafflerWithPublicKey = {
    publicKey: new anchor.web3.PublicKey(data.raffler.publicKey),
    account: raffleProgram.coder.accounts.decode("raffler", Buffer.from(data.raffler.account)),
  }
  const wallet = useWallet()

  const isAdmin = wallet.publicKey?.toBase58() === raffler.account.authority.toBase58()

  const logo = data.theme?.logos?.[data.theme.logo]
  return (
    <div className="h-full flex flex-col gap-4 ">
      <div className="flex gap-2 justify-between align-middle">
        <Link to=".">
          {logo ? <img src={logo} className="h-20" /> : <h3 className="text-3xl">{raffler.account.name}</h3>}
        </Link>

        {isAdmin && (
          <Link to="create">
            <Button color="primary">Create new raffle</Button>
          </Link>
        )}
      </div>
      <div className="flex-1">
        <Outlet context={raffler} />
      </div>
    </div>
  )
}
