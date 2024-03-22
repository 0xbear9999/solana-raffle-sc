import * as anchor from "@coral-xyz/anchor"
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import { json, type LoaderFunction, type MetaFunction } from "@vercel/remix"
import { Link, useLoaderData } from "@remix-run/react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useEffect, useState } from "react"
import { raffleProgram } from "~/helpers/raffle.server"
import { useRaffle } from "~/context/raffle"
import { useUmi } from "~/context/umi"
import { Card, CardBody, Image } from "@nextui-org/react"
import { RafflerWithPublicKey, Staker, StakerWithPublicKey } from "~/types/types"
import { useStake } from "~/context/stake"
import { getProgramAccounts } from "~/helpers/index.server"
import _ from "lodash"
import { Title } from "~/components/Title"

export const loader: LoaderFunction = async () => {
  const rafflers: RafflerWithPublicKey[] = await getProgramAccounts(raffleProgram, "raffler", undefined, true)

  return json({
    rafflers: await Promise.all(
      rafflers
        .filter((r) => r.account.isActive)
        .map(async (r) => {
          return {
            publicKey: r.publicKey.toBase58(),
            account: await raffleProgram.coder.accounts.encode("raffler", r.account),
          }
        })
    ),
  })
}

export default function Index() {
  const [loading, setLoading] = useState(false)
  const wallet = useWallet()
  const umi = useUmi()
  const raffleProgram = useRaffle()
  const data = useLoaderData<typeof loader>()
  const rafflers: RafflerWithPublicKey[] = _.orderBy(
    data.rafflers.map((r: any) => {
      return {
        publicKey: new anchor.web3.PublicKey(r.publicKey),
        account: raffleProgram.coder.accounts.decode("raffler", Buffer.from(r.account)),
      }
    }),
    [(r) => r.account.slug !== "xin_labs", (r) => r.account.slug !== "dandies", (r) => r.account.slug]
  )

  return (
    <div className="container m-x-auto h-full">
      <div className="grid gap-6 lg:grid-cols-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:gid-cols-5">
        <Link to="/all">
          <Card className="h-40">
            <CardBody className="flex items-center justify-center">
              <Title app="all" size="text-3xl" />
            </CardBody>
          </Card>
        </Link>
        {rafflers.map((raffler: RafflerWithPublicKey) => (
          <Raffler raffler={raffler} key={raffler.publicKey.toBase58()} />
        ))}
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

  const image =
    raffler.account.logo && raffler.account.logo !== "undefined?ext=undefined"
      ? `https://arweave.net/${raffler.account.logo}`
      : staker && staker.theme.logo !== null
      ? staker.theme.logos[staker.theme.logo]
      : null

  return (
    <Link to={`/${raffler.account.slug}`}>
      <Card className="h-40">
        {image ? (
          <div className="h-40 flex items-center justify-center">
            <img src={image} className="p-10 max-h-full max-w-full" />
          </div>
        ) : (
          <CardBody className="flex items-center justify-center">{raffler.account.name}</CardBody>
        )}
      </Card>
    </Link>
  )
}
