import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import { json, type LoaderFunction, type MetaFunction } from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useEffect, useState } from "react"
import { raffleProgram } from "~/helpers/raffle.server"
import { useRaffle } from "~/context/raffle"
import { useUmi } from "~/context/umi"
import { Card, CardBody, Image } from "@nextui-org/react"
import { RafflerWithPublicKey, Staker, StakerWithPublicKey } from "~/types/types"
import { useStake } from "~/context/stake"
import { PlusCircleIcon } from "@heroicons/react/24/outline"
import { orderBy } from "lodash"

export const loader: LoaderFunction = async () => {
  const rafflers = orderBy(await raffleProgram.account.raffler.all(), [
    (r) => r.account.slug !== "xin_labs",
    (r) => r.account.slug !== "dandies",
    (r) => r.account.slug,
  ])
  return json({
    rafflers,
  })
}

export default function Index() {
  const [loading, setLoading] = useState(false)
  const { rafflers } = useLoaderData<typeof loader>()
  const wallet = useWallet()
  const umi = useUmi()
  const raffleProgram = useRaffle()

  return (
    <div className="container m-x-auto">
      <div className="grid gap-4 grid-cols-3">
        {rafflers.map((raffler: RafflerWithPublicKey) => (
          <Raffler raffler={raffler} />
        ))}
        <Card>
          <CardBody className="flex items-center justify-center">
            <Link to="/create" className="flex flex-col items-center justify-center gap-2">
              <PlusCircleIcon className="text-primary w-10" />
              <p className="text-3xl font-bold uppercase text-primary">Create Raffler</p>
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Raffler({ raffler }: { raffler: RafflerWithPublicKey }) {
  const [staker, setStaker] = useState<Staker | null>(null)
  const stakeProgram = useStake()

  useEffect(() => {
    if (!raffler.account.staker) {
      setStaker(null)
      return
    }

    ;(async () => {
      const staker = await stakeProgram.account.staker.fetch(raffler.account.staker!)
      setStaker(staker || null)
    })()
  }, [raffler.account.slug])

  return (
    <Link to={`/${raffler.account.slug}`}>
      <Card>
        {staker && staker.theme.logo !== null && (
          <div className="h-40 flex items-center justify-center">
            <img src={staker.theme.logos[staker.theme.logo]} className="p-10 max-h-full max-w-full" />
          </div>
        )}
        {/* <CardBody>{raffler.account.name}</CardBody> */}
      </Card>
    </Link>
  )
}
