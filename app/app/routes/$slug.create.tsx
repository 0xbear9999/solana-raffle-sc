import * as anchor from "@coral-xyz/anchor"
import { MPL_TOKEN_AUTH_RULES_PROGRAM_ID } from "@metaplex-foundation/mpl-token-auth-rules"
import {
  DigitalAsset,
  DigitalAssetWithToken,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  TokenStandard,
  fetchDigitalAsset,
  fetchDigitalAssetWithToken,
} from "@metaplex-foundation/mpl-token-metadata"

import { createAccount, fetchMint, setComputeUnitLimit, setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox"
import {
  RpcGetAccountOptions,
  generateSigner,
  publicKey,
  transactionBuilder,
  unwrapOptionRecursively,
} from "@metaplex-foundation/umi"
import { fromWeb3JsInstruction, fromWeb3JsPublicKey, toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import {
  Accordion,
  AccordionItem,
  Button,
  Card,
  CardBody,
  CardFooter,
  Image,
  Input,
  Link,
  RadioGroup,
  Switch,
  Tab,
  Tabs,
} from "@nextui-org/react"
import { isRouteErrorResponse, useNavigate, useOutletContext, useRouteError } from "@remix-run/react"
import { BN } from "bn.js"
import { DAS } from "helius-sdk"
import { debounce } from "lodash"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { CustomRadio } from "~/components/CustomRadio"
import { NftSelector } from "~/components/NftSelector"
import { useRaffle } from "~/context/raffle"
import { useUmi } from "~/context/umi"
import { fetchToken, type Token } from "@metaplex-foundation/mpl-toolbox"
import { FEES_WALLET, findRafflePda, getTokenAccount, getTokenRecordPda, nativeMint } from "~/helpers/pdas"
import { RafflerWithPublicKey, TokenWithTokenInfo } from "~/types/types"
import { InformationCircleIcon } from "@heroicons/react/24/outline"
import { Popover } from "~/components/Popover"
import { getPriorityFeesForTx } from "~/helpers/helius"
import { usePriorityFees } from "~/context/priority-fees"
import base58 from "bs58"
import { TokenSelector } from "~/components/TokenSelector"
import { useWallet } from "@solana/wallet-adapter-react"
import { ErrorMessage } from "~/components/ErrorMessage"
import { displayErrorFromLog } from "~/helpers"
import axios from "axios"

type TicketType = "nft" | "token" | "sol"
type PrizeType = "nft" | "token"

export default function Create() {
  const navigate = useNavigate()
  const [tokenSelectorShowing, setTokenSelectorShowing] = useState(false)
  const [prizeTokenSelectorShowing, setPrizeTokenSelectorShowing] = useState(false)
  const { feeLevel } = usePriorityFees()
  const raffler = useOutletContext<RafflerWithPublicKey>()
  const [loading, setLoading] = useState(false)
  const umi = useUmi()
  const [tokenAcc, setTokenAcc] = useState<null | DigitalAsset>(null)
  const [tokenError, setTokenError] = useState<null | string>(null)
  const [prizeTokenAcc, setPrizeTokenAcc] = useState<null | DigitalAssetWithToken>(null)
  const [prizeTokenError, setPrizeTokenError] = useState<null | string>(null)
  const wallet = useWallet()
  const [formState, setFormState] = useState<{
    prizeType: PrizeType
    prizeTokenAmount: string
    type: TicketType
    unlimitedTickets: boolean
    numTickets: string
    burnOnPurchase: boolean
    ticketPrice: string
    startTime: string
    duration: string
    witholdBurnProceeds: boolean
    maxEntrantPct: number
    tokenMint: string
    prize: DAS.GetAssetResponse | null
    entryCollectionMint: string
    prepayRent: boolean
    gatedCollection: string
    prizeTokenMint: string
  }>({
    prizeType: "nft",
    prizeTokenAmount: "",
    type: "sol",
    unlimitedTickets: false,
    numTickets: "",
    burnOnPurchase: false,
    ticketPrice: "",
    startTime: "",
    duration: "24",
    witholdBurnProceeds: true,
    maxEntrantPct: 10000,
    tokenMint: "",
    prize: null,
    entryCollectionMint: "",
    prepayRent: false,
    gatedCollection: "",
    prizeTokenMint: "",
  })

  useEffect(() => {
    if (!formState.tokenMint) {
      setTokenAcc(null)

      setTokenError(null)
      return
    }

    const debouncedFilter = debounce(async () => {
      try {
        const mint = publicKey(formState.tokenMint)
        const da = await fetchDigitalAsset(umi, mint)
        setTokenAcc(da)
        setTokenError(null)
      } catch (err: any) {
        if (err.message.includes("The account of type [Metadata] was not found")) {
          const tokenMint = publicKey(formState.tokenMint)
          const mint = await fetchMint(umi, tokenMint)
          const { data } = await axios.get<{ digitalAsset: TokenWithTokenInfo }>(`/api/get-nft/${tokenMint}`)

          setTokenAcc({
            metadata: {
              name:
                data.digitalAsset.content?.metadata.name ||
                data.digitalAsset.content?.metadata.symbol ||
                data.digitalAsset.token_info.symbol ||
                "Unknown token",
              symbol: data.digitalAsset.content?.metadata.symbol || data.digitalAsset.token_info.symbol,
            } as any,
            mint,
            publicKey: tokenMint,
          })
        } else {
          console.error(err)
        }
      }
    }, 500)

    debouncedFilter()
  }, [formState.tokenMint])

  useEffect(() => {
    if (!formState.prizeTokenMint) {
      setPrizeTokenAcc(null)

      setPrizeTokenError(null)
      return
    }

    const debouncedFilter = debounce(async () => {
      try {
        const tokenMint = publicKey(formState.prizeTokenMint!)
        const tokenAcc = await fetchDigitalAssetWithToken(
          umi,
          tokenMint,
          getTokenAccount(umi, tokenMint, umi.identity.publicKey)
        )
        if (tokenAcc) {
          setPrizeTokenAcc(tokenAcc)
          setPrizeTokenError(null)
        } else {
          setPrizeTokenAcc(null)
          setPrizeTokenError("Error looking up token account")
        }
      } catch (err: any) {
        if (err.message.includes("The account of type [Metadata] was not found")) {
          const tokenMint = publicKey(formState.prizeTokenMint)
          const mint = await fetchMint(umi, tokenMint)
          const token = await fetchToken(umi, getTokenAccount(umi, tokenMint, umi.identity.publicKey))
          const { data } = await axios.get<{ digitalAsset: TokenWithTokenInfo }>(`/api/get-nft/${tokenMint}`)

          setPrizeTokenAcc({
            metadata: {
              name:
                data.digitalAsset.content?.metadata.name ||
                data.digitalAsset.content?.metadata.symbol ||
                data.digitalAsset.token_info.symbol ||
                "Unknown token",
              symbol: data.digitalAsset.content?.metadata.symbol || data.digitalAsset.token_info.symbol,
            } as any,
            mint,
            token,
            publicKey: tokenMint,
          })
        } else {
          setPrizeTokenError("Error looking up token account")
          setPrizeTokenAcc(null)
        }
      }
    }, 500)

    debouncedFilter()
  }, [formState.prizeTokenMint])

  const program = useRaffle()

  async function createRaffle() {
    try {
      setLoading(true)

      const entrants = generateSigner(umi)
      const raffle = findRafflePda(umi, entrants.publicKey)
      const promise = Promise.resolve().then(async () => {
        if (formState.prizeType === "nft" && !formState.prize) {
          throw new Error("Select a prize before starting the raffle")
        }
        if (
          formState.prizeType === "token" &&
          (!formState.prizeTokenMint || !formState.prizeTokenAmount || formState.prizeTokenAmount === "0")
        ) {
          throw new Error("Select a prize before starting the raffle")
        }
        if (!formState.unlimitedTickets && (!formState.numTickets || formState.numTickets === "0")) {
          throw new Error("Number of tickets cannot be zero")
        }
        const factor =
          formState.type === "token" && tokenAcc ? Math.pow(10, tokenAcc.mint.decimals) : anchor.web3.LAMPORTS_PER_SOL

        let dataLen = 8 + 4 + 4

        if (formState.prepayRent && !formState.unlimitedTickets) {
          dataLen += Number(formState.numTickets || 0) * 32
        }
        const rent = await umi.rpc.getRent(dataLen)

        let tokenMint =
          formState.type === "sol" ? nativeMint : formState.tokenMint ? publicKey(formState.tokenMint) : null

        if (formState.type === "nft" && formState.witholdBurnProceeds) {
          tokenMint = nativeMint
        }
        const entryCollectionMint = formState.entryCollectionMint ? publicKey(formState.entryCollectionMint) : null
        const treasury = fromWeb3JsPublicKey(raffler.account.treasury)

        const isNft = formState.prizeType === "nft"

        const prizeAcc = isNft ? await fetchDigitalAsset(umi, publicKey(formState.prize!.id)) : null
        const isPfnt =
          prizeAcc && unwrapOptionRecursively(prizeAcc.metadata.tokenStandard) === TokenStandard.ProgrammableNonFungible

        const remainingAccounts: anchor.web3.AccountMeta[] = []

        if (formState.gatedCollection) {
          remainingAccounts.push({
            pubkey: new anchor.web3.PublicKey(formState.gatedCollection),
            isSigner: false,
            isWritable: false,
          })
        }

        if (prizeAcc) {
          remainingAccounts.push(
            {
              pubkey: toWeb3JsPublicKey(prizeAcc.metadata.publicKey),
              isWritable: true,
              isSigner: false,
            },
            {
              pubkey: toWeb3JsPublicKey(prizeAcc.edition?.publicKey!),
              isWritable: false,
              isSigner: false,
            },
            {
              pubkey: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
              isWritable: false,
              isSigner: false,
            }
          )
        }

        if (isPfnt) {
          remainingAccounts.push(
            {
              pubkey: toWeb3JsPublicKey(getTokenRecordPda(umi, prizeAcc.publicKey, umi.identity.publicKey)),
              isWritable: true,
              isSigner: false,
            },
            {
              pubkey: toWeb3JsPublicKey(getTokenRecordPda(umi, prizeAcc.publicKey, raffle)),
              isWritable: true,
              isSigner: false,
            },
            {
              pubkey: toWeb3JsPublicKey(MPL_TOKEN_AUTH_RULES_PROGRAM_ID),
              isWritable: false,
              isSigner: false,
            }
          )
          const authRules = unwrapOptionRecursively(prizeAcc.metadata.programmableConfig)?.ruleSet
          if (authRules) {
            remainingAccounts.push({
              pubkey: toWeb3JsPublicKey(authRules),
              isSigner: false,
              isWritable: false,
            })
          }
        }

        const entryType = formState.burnOnPurchase
          ? { burn: { witholdBurnProceeds: formState.witholdBurnProceeds } }
          : { spend: {} }

        const prizeType =
          formState.prizeType === "nft"
            ? { nft: {} }
            : {
                token: {
                  amount: formState.prizeTokenAmount
                    ? new BN(Number(formState.prizeTokenAmount) * Math.pow(10, prizeTokenAcc?.mint.decimals || 0))
                    : new BN(0),
                },
              }

        const prizePk = prizeAcc ? prizeAcc.publicKey : publicKey(formState.prizeTokenMint)

        const instruction = await program.methods
          .initRaffle(
            prizeType,
            formState.numTickets ? Number(formState.numTickets) : null,
            entryType,
            formState.ticketPrice ? new BN(Number(formState.ticketPrice) * factor) : null,
            formState.startTime ? new BN(Date.parse(formState.startTime) / 1000) : null,
            new BN(Number(formState.duration) * 60 * 60),
            !!formState.gatedCollection,
            formState.maxEntrantPct
          )
          .accounts({
            raffler: raffler.publicKey,
            raffle,
            entrants: entrants.publicKey,
            tokenMint: tokenMint,
            entryCollectionMint,
            tokenVault: tokenMint ? getTokenAccount(umi, tokenMint, raffle) : null,
            prize: prizePk,
            treasury,
            feesWallet: tokenMint ? FEES_WALLET : null,
            feesWalletToken: tokenMint ? getTokenAccount(umi, tokenMint, FEES_WALLET) : null,
            treasuryTokenAccount: tokenMint ? getTokenAccount(umi, tokenMint, treasury) : null,
            prizeToken: getTokenAccount(umi, prizePk, umi.identity.publicKey),
            prizeCustody: getTokenAccount(umi, prizePk, raffle),
            metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          })
          .remainingAccounts(remainingAccounts)
          .instruction()

        let tx = transactionBuilder()
          .add(
            createAccount(umi, {
              newAccount: entrants,
              space: dataLen,
              lamports: rent,
              programId: fromWeb3JsPublicKey(program.programId),
            })
          )
          .add(setComputeUnitLimit(umi, { units: 500_000 }))
          .add({
            instruction: fromWeb3JsInstruction(instruction),
            signers: [umi.identity],
            bytesCreatedOnChain: 8 + 32 + 32 + 32 + (1 + 32) + (1 + 32 + 8) + 1 + (1 + 32) + 8 + 8 + 8 + 1 + 2 + 1 + 1,
          })

        const built = await tx.buildWithLatestBlockhash(umi)

        const fee = await getPriorityFeesForTx(base58.encode(umi.transactions.serialize(built)), feeLevel)

        if (fee) {
          tx = tx.prepend(setComputeUnitPrice(umi, { microLamports: fee }))
        }

        const conf = await tx.sendAndConfirm(umi, {
          confirm: { commitment: "confirmed" },
        })
        if (conf.result.value.err) {
          throw new Error(conf.result.value.err.toString())
        }
      })

      toast.promise(promise, {
        loading: "Creating new Raffle",
        success: "Raffle created successfully",
        error: (err) => displayErrorFromLog(err, "Error creating raffle"),
      })

      await promise
      navigate(`../${raffle}`)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function setField(field: string, value: any) {
    setFormState((formState) => ({
      ...formState,
      [field]: value,
    }))
  }

  function toggleTokenSelector() {
    setTokenSelectorShowing(!tokenSelectorShowing)
  }

  if (wallet.publicKey && wallet.publicKey?.toBase58() !== raffler.account.authority.toBase58()) {
    return <ErrorMessage title="Unauthorized" content="Only the raffle authority can create raffles" />
  }

  function setPrizeTokenAmountMax() {
    if (!prizeTokenAcc) {
      toast.error("No token entered")
      return
    }

    setField(
      "prizeTokenAmount",
      (
        Number((prizeTokenAcc.token.amount * 1000n) / BigInt(Math.pow(10, prizeTokenAcc.mint.decimals))) / 1000
      ).toString()
    )
  }

  useEffect(() => {
    setField("prizeTokenAmount", "")
  }, [formState.prizeTokenMint])

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-10 mt-10">
      <Card className="lg:w-1/3 w-full">
        <CardBody className="flex flex-col gap-3 justify-between">
          <div className="flex gap-3 justify-between items-center">
            <h3 className="text-lg">Prize type</h3>
            <Tabs selectedKey={formState.prizeType} onSelectionChange={(key) => setField("prizeType", key)}>
              <Tab title="NFT" key="nft" className="flex flex-col" />
              <Tab title="Token" key="token" />
            </Tabs>
          </div>
          <div className="flex-1">
            {formState.prizeType === "nft" ? (
              <NftSelector selected={formState.prize} setSelected={(prize) => setField("prize", prize)} />
            ) : (
              <div className="flex flex-col gap-3 h-full">
                <Input
                  label="Token address"
                  value={formState.prizeTokenMint}
                  onValueChange={(val) => setField("prizeTokenMint", val)}
                  errorMessage={prizeTokenError}
                  startContent={prizeTokenAcc?.metadata.symbol || "$TOKEN"}
                  // isClearable
                  data-form-type="other"
                  // description={
                  //   tokenAcc &&
                  //   `${tokenAcc.metadata.symbol}: bal ${(
                  //     Number((tokenAcc.token.amount * 100n) / BigInt(Math.pow(10, tokenAcc.mint.decimals))) / 100
                  //   ).toLocaleString()}`
                  // }
                  endContent={
                    <Button size="sm" onClick={() => setPrizeTokenSelectorShowing(true)}>
                      Browse
                    </Button>
                  }
                />
                <Input
                  label="Amount"
                  value={formState.prizeTokenAmount}
                  onValueChange={(val) => setField("prizeTokenAmount", val)}
                  endContent={
                    <Button size="sm" onClick={setPrizeTokenAmountMax}>
                      Max
                    </Button>
                  }
                />
                {formState.prizeTokenMint && formState.prizeTokenAmount && (
                  <div className="flex flex-1 justify-center items-center h-full">
                    <p className="text-primary font-bold font-lg">
                      {Number(formState.prizeTokenAmount).toLocaleString()} {prizeTokenAcc?.metadata.symbol || "$TOKEN"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card className="lg:w-2/3 w-full overflow-visible">
        <CardBody className="flex flex-col gap-3 overflow-visible">
          <div className="flex gap-3 justify-between items-center">
            <h3 className="text-lg">Entry type</h3>
            <Tabs selectedKey={formState.type} onSelectionChange={(key) => setField("type", key)}>
              <Tab title="SOL" key="sol" />
              <Tab title="Token" key="token" />
              <Tab title="NFT" key="nft" className="flex flex-col" />
            </Tabs>
          </div>

          {["token"].includes(formState.type) && (
            <div className="flex gap-3">
              {formState.type === "token" && (
                <Input
                  label="Token address"
                  value={formState.tokenMint}
                  onValueChange={(val) => setField("tokenMint", val)}
                  errorMessage={tokenError}
                  startContent={tokenAcc?.metadata.symbol || "$TOKEN"}
                  data-form-type="other"
                  endContent={
                    <Button size="sm" onClick={toggleTokenSelector}>
                      Browse
                    </Button>
                  }
                />
              )}
            </div>
          )}

          {formState.type === "nft" && (
            <Input
              label="MCC"
              value={formState.entryCollectionMint}
              onValueChange={(val) => setField("entryCollectionMint", val)}
              endContent={
                <Popover
                  title="Metaplex Certified Collection"
                  placement="left"
                  large
                  content={
                    <div className="flex flex-col gap-3">
                      <p>This can be found by looking at the NFT on Solscan and checking the "Metadata" tab</p>
                      <Image src={"/mcc.png"} />
                      <p>
                        If your collection doesn't have a Metaplex Certified Collection (MCC) you can add one using{" "}
                        <Link
                          href="https://biblio.tech/tools/nft-suite"
                          className="text-tiny"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Biblio.tech
                        </Link>
                      </p>
                    </div>
                  }
                />
              }
            />
          )}
          <div className="flex flex-col md:flex-row gap-3">
            {["sol", "token"].includes(formState.type) && (
              <Input
                label="Entry price"
                type="number"
                min={0}
                value={formState.ticketPrice}
                onValueChange={(val) => setField("ticketPrice", val)}
              />
            )}
            <Input
              type={formState.unlimitedTickets ? "text" : "number"}
              label="Number of tickets"
              value={formState.unlimitedTickets ? "∞" : formState.numTickets.toString()}
              onValueChange={(value) => setField("numTickets", value)}
              step={1}
              min={0}
              max={"18446744073709551615"}
              disabled={formState.unlimitedTickets}
              endContent={
                <div className="flex gap-3 items-center">
                  <Switch
                    isSelected={formState.unlimitedTickets}
                    onValueChange={(checked) => setField("unlimitedTickets", checked)}
                    size="sm"
                  >
                    Unlimited
                  </Switch>
                </div>
              }
            />
          </div>

          <h3>Timing</h3>

          <div className="flex flex-col md:flex-row gap-3">
            <Input
              label="Start time"
              type="datetime-local"
              value={formState.startTime}
              placeholder="dd/mm/yyyy, --:--"
              onChange={(e) => setField("startTime", e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              description="Leave blank to start raffle now"
            />
            <Input
              type="number"
              step={1}
              min={1}
              label="Duration (hours)"
              value={formState.duration}
              onValueChange={(val) => setField("duration", val)}
            />
          </div>
          <Accordion>
            <AccordionItem title="Advanced options">
              <div className="flex flex-col gap-3">
                {/* <div className="flex gap-3 items-center">
                    <Switch
                      isSelected={!formState.unlimitedTickets && formState.prepayRent}
                      onValueChange={(val) => setField("prepayRent", val)}
                      isDisabled={formState.unlimitedTickets}
                    >
                      Prepay entrants rent
                    </Switch>
                    <Popover
                      title="Prepay rent"
                      content={`Entrants are stored in an onchain account, the rent for this is 0.0002 per entrant. If you prefer you can select to prepay this rent, which will be refunded on raffle conclusion`}
                    />
                  </div> */}
                <div className="flex gap-3 items-center">
                  <Switch
                    isSelected={formState.burnOnPurchase}
                    onValueChange={(checked) => setField("burnOnPurchase", checked)}
                    isDisabled={formState.type === "sol"}
                  >
                    Burn on entry
                  </Switch>
                  <Popover
                    title="Burn on entry"
                    content="NFTs/Token entry cost is burnt on entering the raffle. The rent from this can be collected by selecting Withold burn proceeds."
                  />
                </div>
                <div className="flex gap-3 items-center">
                  <Switch
                    isSelected={formState.burnOnPurchase && formState.witholdBurnProceeds}
                    onValueChange={(checked) => setField("witholdBurnProceeds", checked)}
                    isDisabled={!formState.burnOnPurchase}
                  >
                    Withold burn proceeds
                  </Switch>
                  <Popover
                    title="Withold burn proceeds"
                    content="NFTs are burnt on entry, the proceeds are collected and paid to the raffle treasury. Untick this if you
            would like entrants to collect the rent from burning"
                  />
                </div>
                <div className="flex gap3 items-center">
                  <Input
                    label="Gated collection"
                    value={formState.gatedCollection}
                    onValueChange={(value) => setField("gatedCollection", value)}
                    endContent={
                      <Popover
                        title="NFT Gated Raffles"
                        content="Add the Metaplex Certified Collection here if you wish to gate raffles to holders of a certain NFT collection"
                      />
                    }
                  />
                </div>
              </div>
            </AccordionItem>
          </Accordion>
        </CardBody>

        <CardFooter className="flex justify-end gap-3">
          <div className="flex gap-3">
            <Button variant="faded" color="danger">
              Clear
            </Button>
            <Button color="primary" isDisabled={loading} onClick={createRaffle}>
              Create raffle
            </Button>
          </div>
        </CardFooter>
      </Card>
      <TokenSelector
        modalOpen={tokenSelectorShowing}
        setModalOpen={setTokenSelectorShowing}
        setSelected={(e: DAS.GetAssetResponse) => setField("tokenMint", e.id)}
      />
      <TokenSelector
        modalOpen={prizeTokenSelectorShowing}
        setModalOpen={setPrizeTokenSelectorShowing}
        setSelected={(e: DAS.GetAssetResponse) => setField("prizeTokenMint", e.id)}
      />
    </div>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <h1 className="text-xl font-bold">
          {error.status}: {error.statusText}
        </h1>
        <p>{error.data}</p>
      </div>
    )
  } else if (error instanceof Error) {
    return (
      <div>
        <h1>Error</h1>
        <p>{error.message}</p>
        <p>The stack trace is:</p>
        <pre>{error.stack}</pre>
      </div>
    )
  } else {
    console.log(error)
    return <h1>Unknown Error</h1>
  }
}
