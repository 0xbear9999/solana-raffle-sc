import { setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox"
import { publicKey, transactionBuilder } from "@metaplex-foundation/umi"
import { fromWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters"
import { Button, Card, CardBody, CardFooter, CardHeader, Input } from "@nextui-org/react"
import { json, useNavigate, useOutletContext } from "@remix-run/react"
import { useWallet } from "@solana/wallet-adapter-react"
import base58 from "bs58"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { ErrorMessage } from "~/components/ErrorMessage"
import { ImageUpload } from "~/components/ImageUpload"
import { Title } from "~/components/Title"
import { adminWallet } from "~/constants"
import { usePriorityFees } from "~/context/priority-fees"
import { useRaffle } from "~/context/raffle"
import { useStake } from "~/context/stake"
import { useTheme } from "~/context/theme"
import { useUmi } from "~/context/umi"
import { displayErrorFromLog, packTx, sendAllTxsWithRetries, uploadFiles } from "~/helpers"
import { getPriorityFeesForTx } from "~/helpers/helius"
import { findProgramConfigPda, findProgramDataAddress } from "~/helpers/pdas"
import { RafflerWithPublicKey, Staker } from "~/types/types"

export default function RafflerAdmin() {
  const wallet = useWallet()
  const program = useRaffle()
  const initialRaffler = useOutletContext<RafflerWithPublicKey>()
  const [raffler, setRaffler] = useState(initialRaffler)

  useEffect(() => {
    setRaffler(initialRaffler)

    async function getRaffler() {
      const raffler = await program.account.raffler.fetch(initialRaffler.publicKey)
      setRaffler({
        publicKey: initialRaffler.publicKey,
        account: raffler,
      })
    }

    const id = program.provider.connection.onAccountChange(initialRaffler.publicKey, getRaffler)
    return () => {
      program.provider.connection.removeAccountChangeListener(id)
    }
  }, [initialRaffler])

  if (!wallet.publicKey) {
    return <ErrorMessage title="Wallet disconnected" />
  }

  if (![raffler.account.authority.toBase58(), adminWallet].includes(wallet.publicKey.toBase58())) {
    return <ErrorMessage title="Unauthorized" content="The connected wallet cannot access this resource" />
  }

  return (
    <div className="flex items-center justify-center h-full w-full">
      <RafflerAdminForm raffler={raffler} />
    </div>
  )
}

function RafflerAdminForm({ raffler }: { raffler: RafflerWithPublicKey }) {
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { feeLevel } = usePriorityFees()
  const wallet = useWallet()
  const [name, setName] = useState(raffler.account.name)
  const stakeProgram = useStake()
  const raffleProgram = useRaffle()
  const [treasury, setTreasury] = useState(raffler.account.treasury.toBase58())
  const [stakerPk, setStakerPk] = useState(raffler.account.staker?.toBase58() || "")
  const [staker, setStaker] = useState<Staker | null>(null)
  const [stakerError, setStakerError] = useState<string | null>(null)
  const [treasuryError, setTreasuryError] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [bgFile, setBgFile] = useState<File | null>(null)
  const [logo, setLogo] = useState(raffler.account.logo)
  const [bg, setBg] = useState(raffler.account.bg)
  const umi = useUmi()
  const [loading, setLoading] = useState(false)

  function reset() {
    setName(raffler.account.name)
    setTreasury(raffler.account.treasury.toBase58())
    setStakerPk(raffler.account.staker?.toBase58() || "")
    setLogoFile(null)
    setBgFile(null)
    setTreasuryError(null)
  }

  useEffect(() => {
    if (!treasury) {
      setTreasuryError(null)
      return
    }
    ;(async () => {
      try {
        const pk = publicKey(treasury)
        setTreasuryError(null)
      } catch (err: any) {
        console.error(err)
        setTreasuryError("Invalid treasury")
      }
    })()
  }, [treasury])

  useEffect(() => {
    if (!stakerPk) {
      setStakerError(null)
      setStaker(null)
      return
    }
    ;(async () => {
      try {
        const pk = publicKey(stakerPk)
        const acc = await stakeProgram.account.staker.fetch(pk)
        setStaker(acc)
        if (!acc) {
          throw new Error("staker not found")
        }
        setStakerError(null)
      } catch (err: any) {
        console.error(err)
        setStakerError("Invalid staker")
        setStaker(null)
      }
    })()
  }, [stakerPk])

  async function updateRaffler() {
    try {
      setLoading(true)
      const promise = Promise.resolve().then(async () => {
        const { logo: newLogo, bg: newBg } = await uploadFiles(umi, logoFile, bgFile)

        let tx = transactionBuilder().add({
          instruction: fromWeb3JsInstruction(
            await raffleProgram.methods
              .updateRaffler(name, newLogo || logo, newBg || bg, !stakerPk)
              .accounts({
                raffler: raffler.publicKey,
                treasury,
                staker: stakerPk || null,
              })
              .instruction()
          ),
          bytesCreatedOnChain: 0,
          signers: [umi.identity],
        })

        const { chunks, txFee } = await packTx(umi, tx, feeLevel)
        const signed = await Promise.all(chunks.map((c) => c.buildAndSign(umi)))
        return await sendAllTxsWithRetries(umi, raffleProgram.provider.connection, signed, 1 + (txFee ? 1 : 0))
      })

      toast.promise(promise, {
        loading: "Updating // RAFFLE",
        success: "Updated successfully",
        error: (err) => displayErrorFromLog(err, "Error updating"),
      })

      await promise
    } catch {
    } finally {
      setLoading(false)
    }
  }

  async function deleteRaffle() {
    try {
      setLoading(true)
      const promise = Promise.resolve().then(async () => {
        let tx = transactionBuilder().add({
          instruction: fromWeb3JsInstruction(
            await raffleProgram.methods
              .deleteRaffler()
              .accounts({
                raffler: raffler.publicKey,
                programConfig: findProgramConfigPda(umi),
                program: raffleProgram.programId,
                programData: findProgramDataAddress(umi),
              })
              .instruction()
          ),
          bytesCreatedOnChain: 0,
          signers: [umi.identity],
        })

        const { chunks, txFee } = await packTx(umi, tx, feeLevel)
        const signed = await Promise.all(chunks.map((c) => c.buildAndSign(umi)))
        return await sendAllTxsWithRetries(umi, raffleProgram.provider.connection, signed, 1 + (txFee ? 1 : 0))
      })

      toast.promise(promise, {
        loading: "Deleting raffler",
        success: "Deleted successfully",
        error: (err) => displayErrorFromLog(err, "Error deleting"),
      })

      await promise
      navigate("/")
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const logo = logoFile ? URL.createObjectURL(logoFile) : null
    const bg = bgFile ? URL.createObjectURL(bgFile) : null
    const theme = {
      logo:
        logo ||
        (raffler.account.logo
          ? `https://arweave.net/${raffler.account.logo}`
          : staker?.theme.logos[staker.theme.logo as keyof object]),
      bg:
        bg ||
        (raffler.account.bg
          ? `https://arweave.net/${raffler.account.bg}`
          : staker?.theme.backgrounds[staker.theme.background as keyof object]),
    }
    setTheme(theme)
  }, [staker?.theme, logoFile, bgFile])

  const isDirty =
    name !== raffler.account.name ||
    treasury !== raffler.account.treasury.toBase58() ||
    stakerPk !== raffler.account.staker?.toBase58() ||
    logoFile ||
    bgFile
  const canSubmit = isDirty && !treasuryError && !stakerError && name

  return (
    <Card className="w-2/3 m-auto py-10 px-16">
      <CardHeader>
        <h1 className="text-3xl uppercase font-bold text-center w-full">
          <Title /> ADMIN
        </h1>
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        <Input label="Name" value={name} onValueChange={setName} data-form-type="other" isClearable />
        <Input
          label="Treasury"
          value={treasury}
          onValueChange={setTreasury}
          data-form-type="other"
          description="Leave blank to use admin wallet"
          isClearable
          errorMessage={treasuryError}
        />
        <Input
          label="Staker"
          value={stakerPk}
          onValueChange={setStakerPk}
          data-form-type="other"
          isClearable
          errorMessage={stakerError}
        />
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Assets are pulled from a configured // STAKE instance if present, or they can be overidden here:
          </p>
          <div className="flex gap-3">
            <ImageUpload
              label="Logo"
              className="flex-1"
              file={logoFile}
              setFile={setLogoFile}
              initial={logo}
              onClear={() => {
                setLogo(null)
                setLogoFile(null)
              }}
            />
            <ImageUpload
              label="Background"
              className="flex-1"
              file={bgFile}
              setFile={setBgFile}
              initial={bg}
              onClear={() => {
                setBg(null)
                setBgFile(null)
              }}
            />
          </div>
        </div>
      </CardBody>
      <CardFooter>
        {wallet.publicKey?.toBase58() === adminWallet && (
          <Button color="danger" onClick={deleteRaffle}>
            Delete
          </Button>
        )}
        <div className="flex gap-3 justify-end w-full">
          <Button color="danger" variant="bordered" onClick={reset}>
            Reset
          </Button>
          <Button color="primary" isDisabled={!canSubmit} onClick={updateRaffler}>
            Update
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
