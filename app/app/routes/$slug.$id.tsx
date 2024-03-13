import * as anchor from "@coral-xyz/anchor"
import { MPL_TOKEN_AUTH_RULES_PROGRAM_ID } from "@metaplex-foundation/mpl-token-auth-rules"
import {
  MPL_TOKEN_METADATA_PROGRAM_ID,
  TokenStandard,
  fetchDigitalAsset,
} from "@metaplex-foundation/mpl-token-metadata"
import { RandomnessService } from "@switchboard-xyz/solana-randomness-service"
import { getSysvar, setComputeUnitLimit, setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox"
import ConfettiExplosion from "react-confetti-explosion"
import {
  PublicKey,
  generateSigner,
  publicKey,
  transactionBuilder,
  unwrapOptionRecursively,
} from "@metaplex-foundation/umi"
import { fromWeb3JsInstruction, fromWeb3JsPublicKey, toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CircularProgress,
  Image,
  Input,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
  cn,
  Pagination,
} from "@nextui-org/react"

import { useLoaderData, useNavigate, useOutletContext } from "@remix-run/react"
import { DAS } from "helius-sdk"
import _ from "lodash"
import { ReactElement, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { NftSelector, NftSelectorModal } from "~/components/NftSelector"
import { DigitalAssetsProvider, useDigitalAssets } from "~/context/digital-assets"
import { useRaffle } from "~/context/raffle"
import { useUmi } from "~/context/umi"
import { fetchToken, type Token } from "@metaplex-foundation/mpl-toolbox"
import {
  FEES_WALLET,
  findProgramConfigPda,
  findProgramDataAddress,
  findRafflePda,
  getTokenAccount,
  getTokenRecordPda,
  nativeMint,
} from "~/helpers/pdas"
import { Entrants, Raffle, RaffleState, RaffleWithPublicKeyAndEntrants, RafflerWithPublicKey } from "~/types/types"
import { SparklesIcon } from "@heroicons/react/24/outline"
import { Popover } from "~/components/Popover"
import { getPriorityFeesForTx } from "~/helpers/helius"
import { usePriorityFees } from "~/context/priority-fees"
import base58 from "bs58"
import { LoaderFunction, json } from "@vercel/remix"
import { raffleProgram } from "~/helpers/raffle.server"
import { dataToPks, expandRandomness, getEntrantsArray, imageCdn, isLive, shorten } from "~/helpers"
import axios from "axios"
import { useWallet } from "@solana/wallet-adapter-react"
import { adminWallet } from "~/constants"
import { Countdown } from "~/components/Countdown"
import { buyTickets } from "~/helpers/txs"
import { getRaffleState } from "~/helpers/raffle-state"
import { RaffleStateChip } from "~/components/RaffleStateChip"
import { BackArrow } from "~/components/BackArrow"

type TicketType = "nft" | "token" | "sol"

export const loader: LoaderFunction = async ({ params }) => {
  const { id } = params
  const raffle = await raffleProgram.account.raffle.fetch(id as string)
  let entrants: Entrants | null = null
  let entrantsArray: string[] = []
  if (raffle.uri) {
    const { data } = await axios.get(raffle.uri)
    entrants = await raffleProgram.coder.accounts.decode("entrants", Buffer.from(Object.values(data) as any))
    entrantsArray = dataToPks(new Uint8Array((Object.values(data) as any).slice(8 + 4 + 4)))
  } else {
    entrants = await raffleProgram.account.entrants.fetchNullable(raffle.entrants)
  }

  return json({
    raffle: await raffleProgram.coder.accounts.encode("raffle", raffle),
    entrants,
    entrantsArray,
    publicKey: id,
  })
}

type Entrant = {
  key: string
  wallet: string
  tickets: number
  chance: string
  winner: ReactElement | null
}

export default function SingleRaffle() {
  const [showConfetti, setShowConfetti] = useState(false)
  const interval = useRef<ReturnType<typeof setInterval>>()
  const { digitalAssets, fetching } = useDigitalAssets()
  const [numTickets, setNumTickets] = useState("")
  const navigate = useNavigate()
  const [digitalAsset, setDigitalAsset] = useState<DAS.GetAssetResponse | null>(null)
  const data = useLoaderData<typeof loader>()
  const raffleProgram = useRaffle()
  const [raffle, setRaffle] = useState<RaffleWithPublicKeyAndEntrants>({
    publicKey: new anchor.web3.PublicKey(data.publicKey),
    account: raffleProgram.coder.accounts.decode("raffle", Buffer.from(data.raffle)),
    entrants: data.entrants,
  })
  const [raffleState, setRaffleState] = useState<RaffleState>(RaffleState.notStarted)
  const { feeLevel } = usePriorityFees()
  const raffler = useOutletContext<RafflerWithPublicKey>()
  const [loading, setLoading] = useState(false)
  const [entrantsGrouped, setEntrantsGrouped] = useState<Entrant[]>([])
  const [modalShowing, setModalShowing] = useState(false)
  const [selectedNft, setSelectedNft] = useState<DAS.GetAssetResponse | null>(null)
  const [page, setPage] = useState(1)
  const [winner, setWinner] = useState<string | null>(null)
  const wallet = useWallet()

  useEffect(() => {
    if (wallet.publicKey?.toBase58() === winner && !raffle.account.claimed) {
      setShowConfetti(true)
    }
  }, [wallet.publicKey, winner, raffle.account.claimed])

  useEffect(() => {
    if (!raffle.publicKey) {
      return
    }

    async function fetchAcc() {
      const acc = await program.account.raffle.fetch(raffle.publicKey)
      const entrants = await program.account.entrants.fetch(acc.entrants)
      setRaffle((prevState) => {
        return {
          ...prevState,
          account: acc,
          entrants,
        }
      })
    }

    const id = program.provider.connection.onAccountChange(raffle.publicKey, fetchAcc)
    return () => {
      program.provider.connection.removeAccountChangeListener(id)
    }
  }, [raffle.publicKey])

  function toggleNftSelector() {
    setModalShowing(!modalShowing)
  }

  const umi = useUmi()

  useEffect(() => {
    async function getEntrants() {
      let entrantsArray: PublicKey[]
      if (data.entrantsArray) {
        entrantsArray = data.entrantsArray
      } else if (raffle.account.uri) {
        const { data } = await axios.get(raffle.account.uri)
        const entrants = await raffleProgram.coder.accounts.decode("entrants", Buffer.from(Object.values(data) as any))
        setRaffle((prevState) => {
          return {
            ...prevState,
            entrants,
          }
        })
        entrantsArray = dataToPks(new Uint8Array((Object.values(data) as any).slice(8 + 4 + 4)))
      } else {
        entrantsArray = await getEntrantsArray(umi, fromWeb3JsPublicKey(raffle.account.entrants))
      }
      const grouped = _.groupBy(entrantsArray, (item) => item)
      const mapped = _.map(grouped, (tickets, key) => {
        const chance = (tickets.length / (raffle.entrants.total || 0)) * 100
        return {
          key,
          wallet: shorten(key) || "",
          tickets: tickets.length,
          chance: `${chance === Infinity ? "100" : chance.toLocaleString()}%`,
          winner: winner === key ? <SparklesIcon className="text-yellow-500" /> : null,
        }
      })

      setEntrantsGrouped(mapped)
    }

    getEntrants()
    if (!raffle.account.claimed) {
      const id = program.provider.connection.onAccountChange(raffle.account.entrants, getEntrants)
      return () => {
        program.provider.connection.removeAccountChangeListener(id)
      }
    }
  }, [raffle.account.entrants.toBase58(), winner])

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
  }, [raffle.account.prize.toBase58()])

  const program = useRaffle()

  useEffect(() => {
    function tick() {
      const state = getRaffleState(raffle)
      console.log({ state, raffle })
      if (!isLive(state)) {
        clearInterval(interval.current)
      }
      setRaffleState(state)
    }
    tick()
    interval.current = setInterval(tick, 1000)

    return () => {
      interval.current && clearInterval(interval.current)
    }
  }, [raffle.account.startTime, raffle.account.endTime, raffle.entrants?.total, raffle.entrants?.max])

  // useEffect(() => {
  //   if ([RaffleState.ended, RaffleState.cancelled, RaffleState.claimed].includes(raffleState) && interval.current) {
  //     clearInterval(interval.current)
  //   }
  // }, [raffleState, interval.current])

  async function cancelRaffle() {
    try {
      setLoading(true)
      const promise = Promise.resolve().then(async () => {
        const entrantsAcc = await program.account.entrants.fetch(raffle.account.entrants)
        let proceedsMint = raffle.account.paymentType.token?.tokenMint
          ? fromWeb3JsPublicKey(raffle.account.paymentType.token.tokenMint)
          : null

        if (raffle.account.paymentType.nft && raffle.account.entryType.burn?.witholdBurnProceeds) {
          proceedsMint = nativeMint
        }

        const prizeDa = await fetchDigitalAsset(umi, fromWeb3JsPublicKey(raffle.account.prize))
        const isPnft = unwrapOptionRecursively(prizeDa.metadata.tokenStandard) === TokenStandard.ProgrammableNonFungible

        let winner: PublicKey
        let winnerIndex = 0
        if (raffle.account.randomness) {
          const winnerRand = expandRandomness(raffle.account.randomness)
          winnerIndex = winnerRand % entrantsAcc.total

          const entrantsArray = await getEntrantsArray(umi, fromWeb3JsPublicKey(raffle.account.entrants))
          winner = entrantsArray[winnerIndex]
        } else {
          winner = umi.identity.publicKey
        }

        const treasury = fromWeb3JsPublicKey(raffler.account.treasury)

        const remainingAccounts: anchor.web3.AccountMeta[] = [
          {
            pubkey: toWeb3JsPublicKey(prizeDa.metadata.publicKey),
            isWritable: true,
            isSigner: false,
          },
          {
            pubkey: toWeb3JsPublicKey(prizeDa.edition?.publicKey!),
            isWritable: false,
            isSigner: false,
          },
        ]

        if (isPnft) {
          remainingAccounts.push(
            {
              pubkey: toWeb3JsPublicKey(getTokenRecordPda(umi, prizeDa.publicKey, data.publicKey)),
              isWritable: true,
              isSigner: false,
            },
            {
              pubkey: toWeb3JsPublicKey(getTokenRecordPda(umi, prizeDa.publicKey, winner)),
              isWritable: true,
              isSigner: false,
            }
          )
        }
        let tx = transactionBuilder()
          .add(setComputeUnitLimit(umi, { units: 500_000 }))
          .add({
            instruction: fromWeb3JsInstruction(
              await program.methods
                .claimPrize(winnerIndex)
                .accounts({
                  programConfig: findProgramConfigPda(umi),
                  raffle: data.publicKey,
                  raffler: raffle.account.raffler,
                  proceedsMint,
                  feesWallet: FEES_WALLET,
                  feesWalletToken: proceedsMint ? getTokenAccount(umi, proceedsMint, FEES_WALLET) : null,
                  proceedsSource: proceedsMint ? getTokenAccount(umi, proceedsMint, data.publicKey) : null,
                  proceedsDestination: proceedsMint ? getTokenAccount(umi, proceedsMint, treasury) : null,
                  entrants: raffle.account.entrants,
                  prize: prizeDa.publicKey,
                  treasury,
                  prizeCustody: getTokenAccount(umi, prizeDa.publicKey, data.publicKey),
                  prizeDestination: getTokenAccount(umi, prizeDa.publicKey, winner),
                  metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
                  sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
                  authority: raffler.account.authority,
                  winner,
                  authRules: unwrapOptionRecursively(prizeDa.metadata.programmableConfig)?.ruleSet || null,
                  authRulesProgram: isPnft ? MPL_TOKEN_AUTH_RULES_PROGRAM_ID : null,
                })
                .remainingAccounts(remainingAccounts)
                .instruction()
            ),
            bytesCreatedOnChain: 0,
            signers: [umi.identity],
          })

        const fee = await getPriorityFeesForTx(
          base58.encode(umi.transactions.serialize(await tx.buildWithLatestBlockhash(umi))),
          feeLevel
        )

        if (fee) {
          tx = tx.prepend(setComputeUnitPrice(umi, { microLamports: fee }))
        }

        const res = await tx.sendAndConfirm(umi, { send: { skipPreflight: true } })
        if (res.result.value.err) {
          throw new Error("Unable to confirm transaction")
        }
      })

      toast.promise(promise, {
        loading: "Cancelling raffle",
        success: "Success",
        error: "Error cancelling raffle",
      })

      await promise
      navigate("..")
    } catch (err: any) {
      console.log(err)
    } finally {
      setLoading(false)
    }
  }

  async function deleteRaffle() {
    try {
      setLoading(true)
      const promise = Promise.resolve().then(async () => {
        const tx = transactionBuilder().add({
          instruction: fromWeb3JsInstruction(
            await program.methods
              .deleteRaffle()
              .accounts({
                raffle: data.publicKey,
                program: program.programId,
                programData: findProgramDataAddress(umi),
              })
              .instruction()
          ),
          bytesCreatedOnChain: 0,
          signers: [umi.identity],
        })

        const fee = await getPriorityFeesForTx(
          base58.encode(umi.transactions.serialize(await tx.buildWithLatestBlockhash(umi))),
          feeLevel
        )

        console.log(fee)

        if (fee) {
          tx.prepend(setComputeUnitPrice(umi, { microLamports: fee }))
        }

        await tx.sendAndConfirm(umi)
      })

      toast.promise(promise, {
        loading: "Deleting raffle",
        success: "Deleted successfully",
        error: "Error deleting",
      })

      await promise
      navigate("..")
    } catch (err) {
      console.log(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedNft) {
      return
    }

    ;(async () => {
      buyTickets({
        nftMint: publicKey(selectedNft.id),
        umi,
        digitalAssets,
        program,
        fetching,
        raffle: {
          publicKey: new anchor.web3.PublicKey(data.publicKey),
          account: raffle.account,
        },
        numTickets,
        onStart: () => setLoading(true),
        onComplete: () => setLoading(false),
        onSuccess: () => {},
        feeLevel,
      })
    })()
  }, [selectedNft])

  async function draw() {
    try {
      setLoading(true)
      const promise = Promise.resolve().then(async () => {
        const entrantsAcc = await umi.rpc.getAccount(fromWeb3JsPublicKey(raffle.account.entrants))
        if (!entrantsAcc.exists) {
          throw new Error("Entrants account not found")
        }
        const url = await umi.uploader.uploadJson(entrantsAcc.data)
        console.log(url)
        const randomnessService = await RandomnessService.fromProvider(program.provider)
        const requestKeypair = generateSigner(umi)

        let settledRandomnessEventPromise = randomnessService.awaitSettledEvent(
          toWeb3JsPublicKey(requestKeypair.publicKey)
        )

        let tx = transactionBuilder().add({
          instruction: fromWeb3JsInstruction(
            await program.methods
              .drawWinner(url)
              .accounts({
                raffle: data.publicKey,
                entrants: raffle.account.entrants,
                randomnessService: randomnessService.programId,
                randomnessRequest: requestKeypair.publicKey,
                randomnessEscrow: getTokenAccount(
                  umi,
                  fromWeb3JsPublicKey(randomnessService.accounts.mint),
                  requestKeypair.publicKey
                ),
                randomnessState: randomnessService.accounts.state,
                randomnessMint: randomnessService.accounts.mint,
              })
              .instruction()
          ),
          bytesCreatedOnChain: 0,
          signers: [umi.identity, requestKeypair],
        })

        const fee = await getPriorityFeesForTx(
          base58.encode(umi.transactions.serialize(await tx.buildWithLatestBlockhash(umi))),
          feeLevel
        )

        if (fee) {
          tx = tx.prepend(setComputeUnitPrice(umi, { microLamports: fee }))
        }

        await tx.sendAndConfirm(umi)
        await settledRandomnessEventPromise
      })

      toast.promise(promise, {
        loading: "Drawing raffle",
        success: "Raffle drawn",
        error: "Error drawing raffle",
      })

      await promise
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function claim() {
    try {
      if (raffle.account.claimed) {
        throw new Error("Already claimed")
      }
      const promise = Promise.resolve().then(async () => {
        const rafflePk = data.publicKey
        let proceedsMint = raffle.account.paymentType.token?.tokenMint
          ? fromWeb3JsPublicKey(raffle.account.paymentType.token.tokenMint)
          : null

        if (raffle.account.paymentType.nft && raffle.account.entryType.burn?.witholdBurnProceeds) {
          proceedsMint = nativeMint
        }

        const prizeDa = await fetchDigitalAsset(umi, fromWeb3JsPublicKey(raffle.account.prize))
        const isPnft = unwrapOptionRecursively(prizeDa.metadata.tokenStandard) === TokenStandard.ProgrammableNonFungible

        let winner: PublicKey
        let winnerIndex = 0
        if (raffle.account.randomness) {
          const winnerRand = expandRandomness(raffle.account.randomness)
          winnerIndex = winnerRand % raffle.entrants.total

          const entrantsArray = await getEntrantsArray(umi, fromWeb3JsPublicKey(raffle.account.entrants))
          winner = entrantsArray[winnerIndex]
        } else {
          winner = umi.identity.publicKey
        }

        const treasury = fromWeb3JsPublicKey(raffler.account.treasury)

        const remainingAccounts: anchor.web3.AccountMeta[] = [
          {
            pubkey: toWeb3JsPublicKey(prizeDa.metadata.publicKey),
            isWritable: true,
            isSigner: false,
          },
          {
            pubkey: toWeb3JsPublicKey(prizeDa.edition!.publicKey),
            isWritable: false,
            isSigner: false,
          },
        ]

        if (isPnft) {
          remainingAccounts.push(
            {
              pubkey: toWeb3JsPublicKey(getTokenRecordPda(umi, prizeDa.publicKey, rafflePk)),
              isWritable: true,
              isSigner: false,
            },
            {
              pubkey: toWeb3JsPublicKey(getTokenRecordPda(umi, prizeDa.publicKey, winner)),
              isWritable: true,
              isSigner: false,
            }
          )
        }

        let tx = transactionBuilder()
          .add(setComputeUnitLimit(umi, { units: 500_000 }))
          .add({
            instruction: fromWeb3JsInstruction(
              await program.methods
                .claimPrize(winnerIndex)
                .accounts({
                  programConfig: findProgramConfigPda(),
                  raffle: rafflePk,
                  raffler: raffle.account.raffler,
                  proceedsMint,
                  feesWallet: FEES_WALLET,
                  feesWalletToken: proceedsMint ? getTokenAccount(umi, proceedsMint, FEES_WALLET) : null,
                  proceedsSource: proceedsMint ? getTokenAccount(umi, proceedsMint, rafflePk) : null,
                  proceedsDestination: proceedsMint ? getTokenAccount(umi, proceedsMint, treasury) : null,
                  entrants: raffle.account.entrants,
                  prize: prizeDa.publicKey,
                  treasury,
                  prizeCustody: getTokenAccount(umi, prizeDa.publicKey, rafflePk),
                  prizeDestination: getTokenAccount(umi, prizeDa.publicKey, winner),
                  metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
                  sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
                  authority: raffler.account.authority,
                  winner,
                  authRules: unwrapOptionRecursively(prizeDa.metadata.programmableConfig)?.ruleSet || null,
                  authRulesProgram: isPnft ? MPL_TOKEN_AUTH_RULES_PROGRAM_ID : null,
                })
                .remainingAccounts(remainingAccounts)
                .instruction()
            ),
            bytesCreatedOnChain: 0,
            signers: [umi.identity],
          })

        const fee = await getPriorityFeesForTx(
          base58.encode(umi.transactions.serialize(await tx.buildWithLatestBlockhash(umi))),
          feeLevel
        )

        if (fee) {
          tx = tx.prepend(setComputeUnitPrice(umi, { microLamports: fee }))
        }

        const res = await tx.sendAndConfirm(umi)
        if (res.result.value.err) {
          throw new Error("Error claiming")
        }

        setRaffleState(RaffleState.claimed)
      })

      toast.promise(promise, {
        loading: isWinner ? "Claiming prize" : "Sending prize",
        success: isWinner ? "Prize claimed successfully" : "Prize sent successfully",
        error: isWinner ? "Error claiming prize" : "Error sending prize",
      })

      await promise
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = wallet.publicKey?.toBase58() === raffler.account.authority.toBase58()
  const isSystemAdmin = wallet.publicKey?.toBase58() === adminWallet

  useEffect(() => {
    if (!raffle.account.randomness || !raffle.account.randomness.length || !raffle.entrants) {
      return
    }

    ;(async () => {
      const winnerRand = expandRandomness(raffle.account.randomness!)
      const winnerIndex = winnerRand % raffle.entrants.total

      const entrantsArray =
        data.entrantsArray || (await getEntrantsArray(umi, fromWeb3JsPublicKey(raffle.account.entrants)))
      const winner = entrantsArray[winnerIndex]
      setWinner(winner)
    })()
  }, [raffle.account.randomness, raffle.entrants])

  const isWinner = wallet.publicKey && winner && wallet.publicKey.toBase58() === winner

  const collectionMetadata = digitalAsset?.grouping?.find((g) => g.group_key === "collection")?.collection_metadata

  return (
    <div className="flex flex-col gap-3 mt-10">
      {showConfetti && (
        <div className="flex w-full items-center justify-center z-50">
          <ConfettiExplosion
            particleCount={200}
            width={2000}
            duration={3000}
            colors={[
              "#59e6c3",
              "#50cfaf",
              "#47b89c",
              "#3ea188",
              "#358a75",
              "#2c7361",
              "#235c4e",
              "#1a453a",
              "#112e27",
              "#081713",
            ]}
          />
        </div>
      )}

      <BackArrow label="All raffles" />
      <div className="flex gap-10">
        <div className="w-1/3">
          <div className="w-full aspect-square flex items-center justify-center relative">
            {digitalAsset ? <Image src={imageCdn(digitalAsset.content?.links?.image!)} /> : <CircularProgress />}
            <RaffleStateChip raffleState={raffleState} raffle={raffle} />
          </div>
        </div>

        <Card className="w-2/3 overflow-visible">
          <CardBody className="flex flex-col gap-3 overflow-visible">
            <div className="flex justify-between gap-3 items-center">
              <h2 className="text-2xl font-bold">{digitalAsset?.content?.metadata.name || "Unnamed NFT"}</h2>
              <h3 className="font-bold uppercase">{collectionMetadata?.name}</h3>
            </div>
            {entrantsGrouped.length ? (
              <div className="flex flex-col gap-2 items-center">
                <Table>
                  <TableHeader
                    columns={[
                      ...(winner ? [{ key: "winner" }] : []),
                      { key: "wallet", label: "Wallet" },
                      { key: "tickets", label: "Tickets" },
                      { key: "chance", label: "Winning chance" },
                    ]}
                  >
                    {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
                  </TableHeader>
                  <TableBody items={Object.values(entrantsGrouped.slice((page - 1) * 10, page * 10))}>
                    {(item) => {
                      return (
                        <TableRow key={item.key}>
                          {(columnKey) => (
                            <TableCell
                              key={columnKey}
                              className={cn({ "font-bold": !!item.winner, "text-yellow-500": !!item.winner })}
                            >
                              {item[columnKey as keyof object]}
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    }}
                  </TableBody>
                </Table>
                {entrantsGrouped.length > 10 && (
                  <Pagination
                    total={Math.ceil(entrantsGrouped.length / 10)}
                    color="primary"
                    page={page}
                    onChange={setPage}
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="font-bold">No entrants yet</p>
              </div>
            )}
          </CardBody>

          <CardFooter className="flex justify-between gap-3">
            <div>
              {raffleState === RaffleState.notStarted ? (
                <div className="flex items-end justify-start h-full">
                  <div>
                    <p className="text-xs font-bold uppercase">Starts in</p>
                    <Countdown until={raffle.account.startTime.toNumber()} className="text-xl" />
                  </div>
                </div>
              ) : (
                <div className="flex items-end justify-start h-full">
                  <div>
                    <p className="text-xs font-bold uppercase">Ends in</p>
                    {(raffle.entrants?.total || 0) < (raffle.entrants?.max || 0) ? (
                      <Countdown until={raffle.account.endTime.toNumber()} className="text-xl" />
                    ) : (
                      <p className="text-xl">ENDED</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 items-end">
              {isAdmin && !raffle.account.claimed && raffle.entrants?.total === 0 && (
                <Button isDisabled={loading || (raffle.entrants?.total || 0) > 0} onClick={cancelRaffle} color="danger">
                  Cancel raffle
                </Button>
              )}
              {isAdmin && raffle.account.claimed && raffle.account.paymentType.nft && <ClaimNfts raffle={raffle} />}
              {isSystemAdmin && raffle.account.claimed && (
                <Button color="danger" isDisabled={loading} onClick={deleteRaffle}>
                  Delete raffle
                </Button>
              )}

              {raffleState == RaffleState.inProgress && (
                <div className="flex gap-3 items-end">
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
                    color="primary"
                    isDisabled={loading || !raffle.entrants}
                    onClick={
                      raffle.account.paymentType.nft
                        ? toggleNftSelector
                        : () =>
                            buyTickets({
                              umi,
                              digitalAssets,
                              program,
                              fetching,
                              raffle: {
                                publicKey: new anchor.web3.PublicKey(data.publicKey),
                                account: raffle.account,
                              },
                              numTickets,
                              onStart: () => setLoading(true),
                              onComplete: () => setLoading(false),
                              onSuccess: () => {},
                              feeLevel,
                            })
                    }
                  >
                    Buy ticket{["0", "1", ""].includes(numTickets) ? "" : "s"}
                  </Button>
                </div>
              )}
              {raffleState === RaffleState.ended && raffle.entrants.total > 0 && (
                <Button color="primary" onClick={draw}>
                  Draw winners
                </Button>
              )}
              {raffleState === RaffleState.drawn && (isWinner || isAdmin) && (
                <Button color="primary" onClick={claim}>
                  {isWinner ? "Claim prize" : "Send prize"}
                </Button>
              )}
            </div>
          </CardFooter>
          <NftSelectorModal
            title="Select an NFT as payment"
            modalOpen={modalShowing}
            setModalOpen={setModalShowing}
            setSelected={setSelectedNft as any}
            filter={(nft: DAS.GetAssetResponse) =>
              !!nft.grouping?.find(
                (n) =>
                  n.group_key === "collection" &&
                  n.group_value === raffle.account.paymentType.nft?.collection.toBase58()
              )
            }
          />
        </Card>
      </div>
    </div>
  )
}

function ClaimNfts({ raffle }: { raffle: RaffleWithPublicKeyAndEntrants }) {
  const { feeLevel } = usePriorityFees()
  const [nfts, setNfts] = useState<DAS.GetAssetResponse[]>([])
  const [loading, setLoading] = useState(false)
  const raffleProgram = useRaffle()
  const umi = useUmi()

  useEffect(() => {
    ;(async () => {
      const {
        data: { digitalAssets },
      } = await axios.get<{ digitalAssets: DAS.GetAssetResponse[] }>(`/api/get-nfts/${raffle.publicKey.toBase58()}`)
      setNfts(digitalAssets)
    })()
  }, [raffle.publicKey.toBase58()])

  async function claimNfts() {
    try {
      setLoading(true)
      const promise = Promise.resolve().then(async () => {
        let tx = transactionBuilder().add([
          ...(await Promise.all(
            nfts.map(async (nft) => {
              const da = await fetchDigitalAsset(umi, publicKey(nft.id))
              const isPft = unwrapOptionRecursively(da.metadata.tokenStandard) === TokenStandard.ProgrammableNonFungible
              const rafflePk = fromWeb3JsPublicKey(raffle.publicKey)
              const raffler = await raffleProgram.account.raffler.fetch(raffle.account.raffler)
              const destination = fromWeb3JsPublicKey(raffler.treasury)
              const instruction = await raffleProgram.methods
                .collectNft()
                .accounts({
                  raffle: rafflePk,
                  raffler: raffle.account.raffler,
                  nftMint: da.publicKey,
                  nftSource: getTokenAccount(umi, da.publicKey, rafflePk),
                  nftDestination: getTokenAccount(umi, da.publicKey, destination),
                  nftMetadata: da.metadata.publicKey,
                  nftEdition: da.edition?.publicKey,
                  treasury: raffler.treasury,
                  authority: raffler.authority,
                  sourceTokenRecord: isPft ? getTokenRecordPda(umi, da.publicKey, rafflePk) : null,
                  destinationTokenRecord: isPft ? getTokenRecordPda(umi, da.publicKey, destination) : null,
                  authRules: isPft ? unwrapOptionRecursively(da.metadata.programmableConfig)?.ruleSet : null,
                  metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
                  authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
                  sysvarInstructions: getSysvar("instructions"),
                })
                .instruction()
              return {
                instruction: fromWeb3JsInstruction(instruction),
                bytesCreatedOnChain: 0,
                signers: [umi.identity],
              }
            })
          )),
        ])

        let txs = tx
          .unsafeSplitByTransactionSize(umi)
          .map((ch) => ch.prepend(setComputeUnitLimit(umi, { units: 1_000_000 })))

        const encoded = base58.encode(umi.transactions.serialize(await txs[0].buildWithLatestBlockhash(umi)))

        const txFee = await getPriorityFeesForTx(encoded, feeLevel)
        if (txFee) {
          txs = txs.map((ch) => ch.prepend(setComputeUnitPrice(umi, { microLamports: txFee })))
        }

        const signed = await umi.identity.signAllTransactions(
          await Promise.all(txs.map((t) => t.buildWithLatestBlockhash(umi)))
        )

        const blockhash = await umi.rpc.getLatestBlockhash()
        let successes = 0
        let errors = 0

        await Promise.all(
          signed.map(async (tx) => {
            const sig = await umi.rpc.sendTransaction(tx)
            const conf = await umi.rpc.confirmTransaction(sig, {
              strategy: {
                type: "blockhash",
                ...blockhash,
              },
            })
            if (conf.value.err) {
              errors++
            } else {
              successes++
            }
          })
        )

        return { successes, errors }
      })

      toast.promise(promise, {
        loading: `Claiming NFTs...`,
        success: ({ successes }) => `${successes} item${successes === 1 ? "" : "s"} claimed successfully`,
        error: `Error claiming items`,
      })

      const { errors } = await promise
      if (errors) {
        toast.error(`${errors} item${errors === 1 ? "" : "s"} couldn't be claimed`)
      }

      await promise
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!nfts.length) {
    return
  }

  return (
    <Button onClick={claimNfts} isDisabled={loading || !nfts.length}>
      Claim NFTs
    </Button>
  )
}
