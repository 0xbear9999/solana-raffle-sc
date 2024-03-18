import * as anchor from "@coral-xyz/anchor"
import { MPL_TOKEN_AUTH_RULES_PROGRAM_ID } from "@metaplex-foundation/mpl-token-auth-rules"
import {
  MPL_TOKEN_METADATA_PROGRAM_ID,
  TokenStandard,
  fetchDigitalAsset,
  fetchDigitalAssetWithTokenByMint,
} from "@metaplex-foundation/mpl-token-metadata"
import { getSysvar, setComputeUnitLimit, setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox"
import {
  deserializeAccount,
  publicKey,
  sol,
  transactionBuilder,
  unwrapOptionRecursively,
} from "@metaplex-foundation/umi"
import { fromWeb3JsInstruction, toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters"
import { Button, Card, CardBody, Input, Spinner } from "@nextui-org/react"
import { LoaderFunction, json } from "@vercel/remix"
import { isRouteErrorResponse, useLoaderData, useRouteError } from "@remix-run/react"
import { useWallet } from "@solana/wallet-adapter-react"
import base58 from "bs58"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { ErrorMessage } from "~/components/ErrorMessage"
import { adminWallet } from "~/constants"
import { usePriorityFees } from "~/context/priority-fees"
import { useRaffle } from "~/context/raffle"
import { useUmi } from "~/context/umi"
import { getPriorityFeesForTx } from "~/helpers/helius"
import { findProgramConfigPda, findProgramDataAddress, getTokenAccount, getTokenRecordPda } from "~/helpers/pdas"
import { raffleProgram } from "~/helpers/raffle.server"
import { umi } from "~/helpers/umi"
import { getAccount } from "~/helpers/index.server"
import { ProgramConfig } from "~/types/types"

export const loader: LoaderFunction = async () => {
  const programConfig = await getAccount(toWeb3JsPublicKey(findProgramConfigPda(umi)), "programConfig", raffleProgram)

  return json({
    programConfig: await raffleProgram.coder.accounts.encode("programConfig", programConfig),
  })
}

export default function Admin() {
  const [loading, setLoading] = useState(false)
  const raffleProgram = useRaffle()
  const wallet = useWallet()
  const data = useLoaderData<typeof loader>()
  const programConfig = raffleProgram.coder.accounts.decode("programConfig", Buffer.from(data.programConfig))

  async function init() {
    try {
      setLoading(true)
      const promise = raffleProgram.methods
        .initProgramConfig(new anchor.BN(sol(0.01).basisPoints.toString()), 500)
        .accounts({
          programConfig: findProgramConfigPda(),
          programData: findProgramDataAddress(),
          program: raffleProgram.programId,
        })
        .rpc()

      toast.promise(promise, {
        loading: "Initialising config",
        success: "Successfully initialised config",
        error: "Error initialising config",
      })

      await promise
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function setSlugs() {
    try {
      setLoading(true)
      const slugs = (await raffleProgram.account.raffler.all()).map((r) => r.account.slug)
      const promise = raffleProgram.methods
        .setSlugs(slugs)
        .accounts({
          programConfig: findProgramConfigPda(),
          programData: findProgramDataAddress(),
          program: raffleProgram.programId,
        })
        .rpc()

      toast.promise(promise, {
        loading: "Setting slugs",
        success: "Successfully set slugs",
        error: "Error setting slugs",
      })

      await promise
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!wallet.publicKey) {
    return <ErrorMessage title="Wallet disconnected" />
  }

  if (wallet.publicKey.toBase58() !== adminWallet) {
    return <ErrorMessage title="Unauthorized" content="The connected wallet cannot access this resource" />
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <Button onClick={init} disabled={loading}>
          Init
        </Button>
        <Button onClick={setSlugs} disabled={loading}>
          Set slugs
        </Button>
      </div>

      <Recover />
      <UpdateProgramConfig programConfig={programConfig} />
    </div>
  )
}

function UpdateProgramConfig({ programConfig }: { programConfig: ProgramConfig }) {
  const umi = useUmi()
  const { feeLevel } = usePriorityFees()
  const [loading, setLoading] = useState(false)
  const [proceedsShare, setProceedsShare] = useState(programConfig.proceedsShare.toString())
  const program = useRaffle()

  async function updateProgramConfig() {
    try {
      setLoading(true)
      const promise = Promise.resolve().then(async () => {
        let tx = transactionBuilder().add({
          instruction: fromWeb3JsInstruction(
            await program.methods
              .updateProgramConfig(null, Number(proceedsShare))
              .accounts({
                programConfig: findProgramConfigPda(umi),
                program: program.programId,
                programData: findProgramDataAddress(umi),
              })
              .instruction()
          ),
          bytesCreatedOnChain: 0,
          signers: [umi.identity],
        })
        const built = await tx.buildWithLatestBlockhash(umi)

        const fee = await getPriorityFeesForTx(base58.encode(umi.transactions.serialize(built)), feeLevel)

        if (fee) {
          tx = tx.prepend(setComputeUnitPrice(umi, { microLamports: fee }))
        }

        const conf = await tx.sendAndConfirm(umi)
        if (conf.result.value.err) {
          throw new Error("Error confirming")
        }
      })

      toast.promise(promise, {
        loading: "Updating program config",
        success: "Updated successfully",
        error: "Error updating",
      })

      await promise
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <Input type="number" label="Proceeds share" value={proceedsShare} onValueChange={setProceedsShare} />
        <Button onClick={updateProgramConfig}>Update</Button>
      </CardBody>
    </Card>
  )
}

function Recover() {
  const { feeLevel } = usePriorityFees()
  const raffleProgram = useRaffle()
  const [mint, setMint] = useState("")
  const [destination, setDestination] = useState("")
  const [entrants, setEntrants] = useState("")
  const [loading, setLoading] = useState(false)
  const umi = useUmi()

  async function recover() {
    try {
      setLoading(true)
      const promise = Promise.resolve().then(async () => {
        const nft = await fetchDigitalAssetWithTokenByMint(umi, publicKey(mint))
        const isPnft = unwrapOptionRecursively(nft.metadata.tokenStandard) === TokenStandard.ProgrammableNonFungible
        const destinationPk = destination ? publicKey(destination) : umi.identity.publicKey

        let tx = transactionBuilder()
          .add(setComputeUnitLimit(umi, { units: 1_000_000 }))
          .add({
            instruction: fromWeb3JsInstruction(
              await raffleProgram.methods
                .recoverNft()
                .accounts({
                  nftMint: nft.publicKey,
                  destination: destinationPk,
                  nftDestination: getTokenAccount(umi, nft.publicKey, destinationPk),
                  nftMetadata: nft.metadata.publicKey,
                  nftEdition: nft.edition?.publicKey,
                  nftSource: nft.token.publicKey,
                  raffle: nft.token.owner,
                  sourceTokenRecord: isPnft ? getTokenRecordPda(umi, nft.publicKey, nft.token.owner) : null,
                  destinationTokenRecord: isPnft ? getTokenRecordPda(umi, nft.publicKey, destinationPk) : null,
                  entrants,
                  programData: findProgramDataAddress(),
                  program: raffleProgram.programId,
                  authRules: isPnft ? unwrapOptionRecursively(nft.metadata.programmableConfig)?.ruleSet : null,
                  authRulesProgram: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
                  metadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
                  sysvarInstructions: getSysvar("instructions"),
                })
                .instruction()
            ),
            bytesCreatedOnChain: 0,
            signers: [umi.identity],
          })

        const built = await tx.buildWithLatestBlockhash(umi)

        const fee = await getPriorityFeesForTx(base58.encode(umi.transactions.serialize(built)), feeLevel)

        if (fee) {
          tx = tx.prepend(setComputeUnitPrice(umi, { microLamports: fee }))
        }

        const conf = await tx.sendAndConfirm(umi)
      })

      toast.promise(promise, {
        loading: "Recovering NFT",
        success: "Successfully recovered NFT",
        error: "Error recovering NFT",
      })

      await promise
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <p>Recover NFT</p>
        <Input label="NFT Mint" value={mint} onValueChange={setMint} />
        <Input label="Entrants" value={entrants} onValueChange={setEntrants} />
        <Input label="Destination" value={destination} onValueChange={setDestination} />
        <Button onClick={recover}>Recover</Button>
      </CardBody>
    </Card>
  )
}
