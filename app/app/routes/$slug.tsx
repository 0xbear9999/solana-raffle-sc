import * as anchor from "@coral-xyz/anchor"
import { Button, Switch, Tab, Tabs } from "@nextui-org/react"
import { LoaderFunction, MetaFunction, json } from "@vercel/remix"
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useRaffle } from "~/context/raffle"
import { displayErrorFromLog, getRafflerFromSlug, packTx, sendAllTxsWithRetries } from "~/helpers"
import { raffleProgram } from "~/helpers/raffle.server"
import { stakeProgram } from "~/helpers/stake.server"
import { Raffler, RafflerWithPublicKey, Theme } from "~/types/types"
import { umi } from "~/helpers/umi"
import { getAccount } from "~/helpers/index.server"
import { useTheme } from "~/context/theme"
import { transactionBuilder } from "@metaplex-foundation/umi"
import { fromWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters"
import { findProgramDataAddress } from "~/helpers/pdas"
import toast from "react-hot-toast"
import { useState } from "react"
import { usePriorityFees } from "~/context/priority-fees"
import { adminWallet } from "~/constants"
import { Popover } from "~/components/Popover"
import { useUmi } from "~/context/umi"

export const meta: MetaFunction = ({ data }: { data: any }) => {
  return [{ title: `${data.name} // RAFFLE` }]
}

export const loader: LoaderFunction = async ({ params }) => {
  const { slug } = params
  if (slug === "all") {
    return json({
      all: true,
    })
  }
  const raffler: RafflerWithPublicKey = await getRafflerFromSlug(slug as string)
  const staker = raffler?.account.staker ? await getAccount(raffler.account.staker, "staker", stakeProgram) : null
  const encoded = await raffleProgram.coder.accounts.encode("raffler", raffler?.account)

  const theme: Theme = {
    logo:
      raffler.account.logo && raffler.account.logo !== "undefined?ext=undefined"
        ? `https://arweave.net/${raffler.account.logo}`
        : staker?.theme?.logos[staker.theme.logo] || null,
    bg:
      raffler.account.bg && raffler.account.bg !== "undefined?ext=undefined"
        ? `https://arweave.net/${raffler.account.bg}`
        : staker?.theme?.backgrounds[staker.theme.background] || null,
  }

  return json({
    raffler: {
      publicKey: raffler?.publicKey,
      account: encoded,
    },
    name: raffler?.account.name,
    theme,
  })
}

export default function Raffle() {
  const umi = useUmi()
  const { feeLevel } = usePriorityFees()
  const [loading, setLoading] = useState(false)
  const { theme } = useTheme()
  const { pathname } = useLocation()
  const data = useLoaderData<typeof loader>()
  const raffleProgram = useRaffle()
  const raffler: RafflerWithPublicKey | null = !data.all
    ? {
        publicKey: new anchor.web3.PublicKey(data.raffler.publicKey),
        account: raffleProgram.coder.accounts.decode("raffler", Buffer.from(data.raffler.account)),
      }
    : null
  const wallet = useWallet()

  const isAdmin = wallet.publicKey?.toBase58() === raffler?.account.authority.toBase58()

  async function toggleActive(active: boolean) {
    try {
      setLoading(true)
      const promise = Promise.resolve().then(async () => {
        const tx = transactionBuilder().add({
          instruction: fromWeb3JsInstruction(
            await raffleProgram.methods
              .toggleActive(active)
              .accounts({
                raffler: raffler?.publicKey,
                programData: findProgramDataAddress(),
                program: raffleProgram.programId,
              })
              .instruction()
          ),
          bytesCreatedOnChain: 0,
          signers: [umi.identity],
        })

        const { chunks, txFee } = await packTx(umi, tx, feeLevel)
        const signed = await Promise.all(chunks.map((c) => c.buildAndSign(umi)))
        return await sendAllTxsWithRetries(umi, raffleProgram.provider.connection, signed, txFee ? 1 : 0)
      })

      toast.promise(promise, {
        loading: active ? "Enabling raffler" : "Disabling raffler",
        success: "Success",
        error: (err) => displayErrorFromLog(err, "Error disabling raffle"),
      })

      await promise
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-4 ">
      {raffler && (
        <div className="flex gap-2 justify-between align-middle">
          <Link to=".">
            {theme?.logo ? (
              <img src={theme?.logo} className="h-20" />
            ) : (
              <h3 className="text-3xl">{raffler.account.name}</h3>
            )}
          </Link>

          {isAdmin && !pathname.includes("/create") && (
            <div>
              <Link to="create">
                <Button color="primary">Create new raffle</Button>
              </Link>
            </div>
          )}
          {(isAdmin || wallet.publicKey?.toBase58()) === adminWallet && pathname.includes("/admin") && (
            <div className="flex items-center gap-1">
              <Switch
                checked={raffler.account.isActive}
                onValueChange={(checked) => toggleActive(checked)}
                isDisabled={loading}
              />
              <p>Active</p>
              <Popover
                title="Raffler active"
                content="Check this toggle to display raffler on public homepage"
                placement="left"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex-1">
        <Outlet context={raffler} key={raffler?.publicKey.toBase58()} />
      </div>
    </div>
  )
}
