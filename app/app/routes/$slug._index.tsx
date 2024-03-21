import * as anchor from "@coral-xyz/anchor"
import { DigitalAsset, fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata"
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  Chip,
  CircularProgress,
  Image,
  Input,
  Select,
  SelectItem,
  Switch,
  Tab,
  Tabs,
} from "@nextui-org/react"
import { LoaderFunction, json } from "@vercel/remix"
import { Link, useLoaderData, useOutletContext } from "@remix-run/react"
import { useWallet } from "@solana/wallet-adapter-react"
import axios from "axios"
import { DAS } from "helius-sdk"
import _, { omit, orderBy, uniq, uniqBy } from "lodash"
import { useEffect, useRef, useState } from "react"
import { Countdown } from "~/components/Countdown"
import { RaffleStateChip } from "~/components/RaffleStateChip"
import { useDigitalAssets } from "~/context/digital-assets"
import { usePriorityFees } from "~/context/priority-fees"
import { useRaffle } from "~/context/raffle"
import { useUmi } from "~/context/umi"
import { dataToPks, entrantsFromUri, getRafflerFromSlug, imageCdn, isLive, shorten } from "~/helpers"
import { nativeMint } from "~/helpers/pdas"
import { getRaffleState } from "~/helpers/raffle-state"
import { raffleProgram } from "~/helpers/raffle.server"
import { buyTickets } from "~/helpers/txs"
import {
  Entrants,
  RaffleState,
  RaffleWithPublicKey,
  RaffleWithPublicKeyAndEntrants,
  RafflerWithPublicKey,
  TokenWithTokenInfo,
} from "~/types/types"
import { getMultipleAccounts, getProgramAccounts } from "~/helpers/index.server"
import { Prize } from "~/components/Prize"
import { adminWallet } from "~/constants"

export const loader: LoaderFunction = async ({ params }) => {
  const raffler = params.slug !== "all" && (await getRafflerFromSlug(params.slug as string))
  if (!raffler && params.slug !== "all") {
    throw new Response("Not found", { status: 404, statusText: "Not found" })
  }

  const raffles: RaffleWithPublicKey[] = await getProgramAccounts(
    raffleProgram,
    "raffle",
    raffler
      ? [
          {
            memcmp: {
              bytes: raffler.publicKey.toBase58(),
              offset: 8,
            },
          },
        ]
      : [],
    true,
    308
  )

  const entrantsEncoded = await getMultipleAccounts(
    raffles.map((r) => r.account.entrants),
    "entrants",
    raffleProgram,
    false
  )

  return json({
    raffles: await Promise.all(
      raffles.map(async (raffle, index) => {
        const entrants =
          entrantsEncoded[index] || (raffle.account.uri ? await entrantsFromUri(raffle.account.uri) : null)

        return {
          publicKey: raffle.publicKey.toBase58(),
          account: await raffleProgram.coder.accounts.encode("raffle", raffle.account),
          entrants: entrants ? await raffleProgram.coder.accounts.decode("entrants", entrants) : null,
          entrantsArray: entrants ? dataToPks(new Uint8Array(entrants).slice(8 + 4 + 4)) : [],
        }
      })
    ),
  })
}

type Tab = "live" | "upcoming" | "ended" | "past" | "cancelled"
type Filter = {
  label: string
  value: string
}

export default function Raffles() {
  const [tab, setTab] = useState<Tab>("live")
  const wallet = useWallet()
  const data = useLoaderData<typeof loader>()
  const raffleProgram = useRaffle()
  const raffler = useOutletContext<RafflerWithPublicKey>()
  const [filter, setFilter] = useState(new Set(["all"]))
  const [filters, setFilters] = useState<Filter[]>()
  const [onlyMine, setOnlyMine] = useState(false)

  const raffles: RaffleWithPublicKeyAndEntrants[] = data.raffles.map((r: any) => {
    return {
      publicKey: new anchor.web3.PublicKey(r.publicKey),
      account: raffleProgram.coder.accounts.decode("raffle", Buffer.from(r.account)),
      entrants: r.entrants,
      entrantsArray: r.entrantsArray,
    }
  })

  const grouped = _.groupBy(
    raffles
      .filter(
        (r) =>
          filter.has("all") ||
          (filter.has("nft") && r.account.paymentType.nft) ||
          filter.has(r.account.paymentType.token?.tokenMint.toBase58() || "")
      )
      .filter((r) => {
        if (!onlyMine) {
          return true
        }
        if (!r.entrantsArray.length || !wallet.publicKey) {
          return false
        }
        return r.entrantsArray.includes(fromWeb3JsPublicKey(wallet.publicKey))
      }),
    (raffle) => {
      const state = getRaffleState(omit(raffle, "entrants"), raffle.entrants)
      return state
    }
  )

  const isAdmin =
    wallet.publicKey?.toBase58() === raffler?.account.authority.toBase58() ||
    wallet.publicKey?.toBase58() === adminWallet

  useEffect(() => {
    ;(async () => {
      const tokens = uniq(raffles.map((r) => r.account.paymentType.token?.tokenMint.toBase58()))
      const {
        data: { fungibles },
      } = await axios.post<{ fungibles: TokenWithTokenInfo[] }>("/api/get-fungibles", {
        mints: tokens,
      })
      const filters = [
        {
          value: "all",
          label: "All",
        },
        {
          value: "nft",
          label: "NFT",
        },
        ...uniqBy(
          fungibles.map((r) => ({
            value: r.id,
            label:
              r.content?.metadata.name ||
              r.content?.metadata.description ||
              r.token_info.symbol ||
              shorten(r.id) ||
              "Unknown token",
          })),
          (item) => item.value
        ),
      ]
      setFilters(filters)
    })()
  }, [])

  return (
    <div className="flex flex-col gap-6 mt-10">
      <div className="flex flex-row justify-between gap-3 items-center">
        <Tabs
          size="lg"
          selectedKey={tab}
          onSelectionChange={(tab) => setTab(tab as Tab)}
          items={[
            {
              key: "live",
              title: "Live",
            },
            {
              key: "ended",
              title: "Ended",
            },
            {
              key: "upcoming",
              title: "Upcoming",
            },
            {
              key: "past",
              title: "Past",
            },
            ...(isAdmin
              ? [
                  {
                    key: "cancelled",
                    title: "Cancelled",
                  },
                ]
              : []),
          ]}
        >
          {(tab) => <Tab title={tab.title} key={tab.key} />}

          {/* <Tab title="Ended" key="ended" />
          <Tab title="Upcoming" key="upcoming" />

          <Tab title="Past" key="past" />
          {isAdmin && <Tab title="Cancelled" key="cancelled" />} */}
        </Tabs>
        <div className="flex flex-col gap-2">
          {filters?.length && (
            <Select
              value="all"
              label="Entry"
              variant="bordered"
              className="max-w-[200px]"
              selectedKeys={filter}
              onSelectionChange={(filter) => setFilter(filter as Set<string>)}
              items={filters}
            >
              {(filter) => (
                <SelectItem className="bg-background" key={filter.value!}>
                  {filter.label}
                </SelectItem>
              )}
            </Select>
          )}
          <Tabs selectedKey={onlyMine ? "mine" : "all"} onSelectionChange={(key) => setOnlyMine(key === "mine")}>
            <Tab key="mine" title="Only mine" />
            <Tab key="all" title="All" />
          </Tabs>
        </div>
        {/* <Switch isSelected={onlyMine} onValueChange={setOnlyMine} /> */}
      </div>
      {tab === "live" && (
        <Section
          label="Live"
          raffles={orderBy(grouped[RaffleState.inProgress], (raffle) => raffle.account.endTime.toNumber())}
        />
      )}
      {tab === "ended" && (
        <Section
          label="Ended"
          raffles={orderBy(
            [
              ...(grouped[RaffleState.ended] || []),
              ...(grouped[RaffleState.drawn] || []),
              ...(grouped[RaffleState.awaitingRandomness] || []),
            ],
            (raffle) => raffle.account.endTime.toNumber()
          )}
        />
      )}
      {tab === "upcoming" && (
        <Section
          label="Upcoming"
          raffles={orderBy(grouped[RaffleState.notStarted], (raffle) => raffle.account.startTime.toNumber())}
        />
      )}
      {tab === "past" && (
        <Section
          label="Past"
          raffles={orderBy(grouped[RaffleState.claimed], (raffle) => raffle.account.startTime.toNumber())}
        />
      )}
      {tab === "cancelled" && (
        <Section
          label="Cancelled"
          raffles={orderBy(grouped[RaffleState.cancelled], (raffle) => raffle.account.startTime.toNumber())}
        />
      )}
    </div>
  )
}

function Section({ raffles = [], label }: { raffles: RaffleWithPublicKeyAndEntrants[]; label: string }) {
  return (
    <div className="mb-10">
      <h3 className="text-xl font-bold">{label} raffles:</h3>
      {raffles.length ? (
        <div className="grid gap-6 lg:grid-cols-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:gid-cols-5 mt-10">
          {raffles.map(({ entrants, ...raffle }) => {
            return <Raffle raffle={raffle} entrants={entrants} key={raffle.publicKey.toBase58()} />
          })}
        </div>
      ) : (
        <div className="flex justify-center items-center h-40">
          <p className="font-bold bg-background text-xl rounded-xl px-2 py-1">No {label.toLowerCase()} raffles</p>
        </div>
      )}
    </div>
  )
}

function Raffle({
  raffle: initialRaffle,
  entrants: initialEntrants,
}: {
  raffle: RaffleWithPublicKey
  entrants: Entrants
}) {
  const wallet = useWallet()
  const [entrants, setEntrants] = useState<Entrants>(initialEntrants)
  const [raffle, setRaffle] = useState(initialRaffle)
  const { feeLevel } = usePriorityFees()
  const [loading, setLoading] = useState(false)
  const [numTickets, setNumTickets] = useState("")
  const program = useRaffle()
  const { digitalAssets, fetching } = useDigitalAssets()
  const umi = useUmi()
  const [token, setToken] = useState<DigitalAsset | null>(null)
  const [digitalAsset, setDigitalAsset] = useState<DAS.GetAssetResponse | null>(null)
  const raffleProgram = useRaffle()
  const [raffleState, setRaffleState] = useState<RaffleState>(RaffleState.inProgress)

  useEffect(() => {
    setRaffle(initialRaffle)
  }, [initialRaffle])

  useEffect(() => {
    if (!raffle.account.prize) {
      setDigitalAsset(null)
      return
    }

    ;(async () => {
      const { data } = await axios.get<{ digitalAsset: DAS.GetAssetResponse }>(
        `/api/get-nft/${raffle.account.prize.toBase58()}`
      )

      setDigitalAsset(data.digitalAsset)
    })()
  }, [raffle.account.prize])

  useEffect(() => {
    if (!raffle.account.paymentType.token?.tokenMint) {
      setToken(null)
      return
    }

    ;(async () => {
      const da = await fetchDigitalAsset(umi, fromWeb3JsPublicKey(raffle.account.paymentType.token?.tokenMint!))
      setToken(da)
    })()
  }, [raffle.account.paymentType.token?.tokenMint])

  useEffect(() => {
    if (!raffle.account.entrants) {
      return
    }

    async function getEntrants() {
      const entrantsAcc = await program.account.entrants.fetchNullable(raffle.account.entrants)
      if (entrantsAcc) {
        setEntrants(entrantsAcc)
      }
    }

    const id = raffleProgram.provider.connection.onAccountChange(raffle.account.entrants, getEntrants)

    return () => {
      raffleProgram.provider.connection.removeAccountChangeListener(id)
    }
  }, [raffle.account.entrants])

  const isSol = raffle.account.paymentType.token?.tokenMint.toBase58() === nativeMint
  const factor = isSol ? anchor.web3.LAMPORTS_PER_SOL : Math.pow(10, token?.mint.decimals || 0)

  const interval = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    function tick() {
      const state = getRaffleState(raffle, entrants)

      if (!isLive(state)) {
        clearInterval(interval.current)
      }

      setRaffleState(state)
    }
    tick()
    interval.current = setInterval(tick, 1000)

    return () => {
      clearInterval(interval.current)
    }
  }, [raffle.account.startTime, raffle.account.endTime, entrants])

  return (
    <Card>
      <Link to={`${raffle.publicKey.toBase58()}`}>
        <Prize raffle={raffle} raffleState={raffleState} entrants={entrants} />
      </Link>
      <CardBody>
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-lg font-bold truncate">{digitalAsset?.content?.metadata.name}</h3>
          </div>

          <div className="flex justify-between">
            <p>Entry price:</p>
            <p className="text-primary font-bold">
              {raffle.account.paymentType.nft
                ? "1 NFT"
                : `${(raffle.account.paymentType.token?.ticketPrice?.toNumber?.() || 0) / factor} ${
                    isSol ? "SOL" : token?.metadata.symbol || "$TOKEN"
                  }`}
            </p>
          </div>
          <div className="flex justify-between">
            <p>Tickets:</p>
            <p>
              {entrants?.total.toString() || 0} /{" "}
              {entrants?.max.toString() === "4294967295" ? "∞" : entrants?.max.toString() || 0}
            </p>
          </div>
          <>
            {raffleState === RaffleState.notStarted ? (
              <div className="flex items-end justify-start h-full">
                <div>
                  <p className="text-xs font-bold uppercase">Starts in</p>
                  <Countdown until={raffle.account.startTime.toNumber()} className="text-xl" compact urgent={false} />
                </div>
              </div>
            ) : (
              <div className="flex items-end justify-start h-full">
                <div>
                  <p className="text-xs font-bold uppercase">Ends in</p>
                  {(entrants?.total || 0) < (entrants?.max || 0) ? (
                    <Countdown until={raffle.account.endTime.toNumber()} className="text-xl" compact />
                  ) : (
                    <p className="text-xl">ENDED</p>
                  )}
                </div>
              </div>
            )}
          </>
        </div>
      </CardBody>
      <CardFooter>
        {raffleState === RaffleState.inProgress ? (
          <div className="flex gap-3 items-end justify-between">
            {raffle.account.paymentType.token && (
              <Input
                type="number"
                value={numTickets}
                onValueChange={(num) => setNumTickets(num)}
                label="Quantity"
                labelPlacement="outside"
                min={1}
                step={1}
              />
            )}

            <Button
              onClick={() =>
                buyTickets({
                  umi,
                  digitalAssets,
                  program,
                  fetching,
                  raffle,
                  numTickets,
                  onStart: () => setLoading(true),
                  onComplete: () => setLoading(false),
                  onSuccess: () => {},
                  feeLevel,
                })
              }
              isDisabled={!wallet.publicKey}
              color="primary"
            >
              Buy ticket{["0", "1", ""].includes(numTickets) ? "" : "s"}
            </Button>
          </div>
        ) : (
          <div className="flex justify-between w-full">
            <div />
            <Link to={`${raffle.publicKey.toBase58()}`}>
              <Button>View</Button>
            </Link>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
