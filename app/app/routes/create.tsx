import { setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox"
import { createGenericFile, createGenericFileFromBrowserFile, transactionBuilder } from "@metaplex-foundation/umi"
import { fromWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters"
import { Button, Card, CardBody, CardFooter, CardHeader, Input, Link as NextUiLink, Switch } from "@nextui-org/react"
import { Link, useNavigate } from "@remix-run/react"
import { useWallet } from "@solana/wallet-adapter-react"
import base58 from "bs58"
import { compact, debounce } from "lodash"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { ErrorMessage } from "~/components/ErrorMessage"
import { ImageUpload } from "~/components/ImageUpload"
import { PanelCard } from "~/components/PanelCard"
import { Title } from "~/components/Title"
import { usePriorityFees } from "~/context/priority-fees"
import { useRaffle } from "~/context/raffle"
import { useStake } from "~/context/stake"
import { useTheme } from "~/context/theme"
import { useUmi } from "~/context/umi"
import {
  displayErrorFromLog,
  getStakerFromSlug,
  getStakerFromSlugProgram,
  packTx,
  sendAllTxsWithRetries,
  sleep,
  uploadFiles,
} from "~/helpers"
import { getPriorityFeesForTx } from "~/helpers/helius"
import { findProgramConfigPda, findRafflerPda } from "~/helpers/pdas"
import { Assets, Staker } from "~/types/types"

export default function Create() {
  const wallet = useWallet()
  const { feeLevel } = usePriorityFees()
  const { theme, setTheme } = useTheme()
  const stakeProgram = useStake()
  const [stake, setStake] = useState("")
  const [stakeAcc, setStakeAcc] = useState<Staker | null>(null)
  const [loading, setLoading] = useState(false)
  const [slug, setSlug] = useState("")
  const [name, setName] = useState("")
  const [treasury, setTreasury] = useState("")
  const umi = useUmi()
  const program = useRaffle()
  const [slugError, setSlugError] = useState<null | string>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [bgFile, setBgFile] = useState<File | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!slug) {
      setStake("")
      setStakeAcc(null)
      return
    }

    const debouncedFilter = debounce(async () => {
      try {
        const stakeApp = await getStakerFromSlugProgram(slug, stakeProgram)
        if (stakeApp) {
          setStake(stakeApp.publicKey.toBase58())
          setStakeAcc(stakeApp.account)
        } else {
          setStake("")
          setStakeAcc(null)
        }
      } catch (err) {
        console.error(err)
        setStake("")
        setStakeAcc(null)
      }
    }, 500)

    debouncedFilter()
  }, [slug])

  useEffect(() => {
    if (!stake) {
      setStakeAcc(null)
      return
    }

    const debouncedFilter = debounce(async () => {
      try {
        const stakeApp = await stakeProgram.account.staker.fetch(stake)
        if (stakeApp) {
          setStakeAcc(stakeApp)
        } else {
          setStakeAcc(null)
        }
      } catch (err) {
        setStakeAcc(null)
      }
    }, 500)

    debouncedFilter()
  }, [stake])

  useEffect(() => {
    const logo = logoFile ? URL.createObjectURL(logoFile) : null
    const bg = bgFile ? URL.createObjectURL(bgFile) : null
    const theme = {
      logo: logo || stakeAcc?.theme.logos[stakeAcc.theme.logo as keyof object],
      bg: bg || stakeAcc?.theme.backgrounds[stakeAcc.theme.background as keyof object],
    }
    setTheme(theme)
  }, [stakeAcc?.theme, logoFile, bgFile])

  async function createRaffler() {
    try {
      setLoading(true)
      const promise = Promise.resolve().then(async () => {
        const raffler = findRafflerPda(umi, umi.identity.publicKey)
        let logo = null
        let bg = null
        if (logoFile || bgFile) {
          const uploadPromise = uploadFiles(umi, logoFile, bgFile)

          toast.promise(uploadPromise, {
            loading: "Uploading assets",
            success: "Uploaded successfully",
            error: "Error uploading files",
          })

          const res = await uploadPromise
          logo = res.logo
          bg = res.bg
        }

        let tx = transactionBuilder().add({
          instruction: fromWeb3JsInstruction(
            await program.methods
              .init(name, slug, logo, bg)
              .accounts({
                programConfig: findProgramConfigPda(),
                raffler,
                treasury: treasury || null,
                staker: stake || null,
              })
              .instruction()
          ),
          bytesCreatedOnChain: 8 + 32 + (4 + 50) + (4 + 50) + 32 + (1 + 4 + 50) + 1 + (1 + 32) + (1 + 32) + 1,
          signers: [umi.identity],
        })

        const { chunks, txFee } = await packTx(umi, tx, feeLevel)
        const signed = await Promise.all(chunks.map((c) => c.buildAndSign(umi)))
        return await sendAllTxsWithRetries(umi, program.provider.connection, signed, 1 + (txFee ? 1 : 0))
      })

      toast.promise(promise, {
        loading: "Creating new // RAFFLE app",
        success: "// RAFFLE created successfully",
        error: (err) => displayErrorFromLog(err, "Error creating // RAFFLE app"),
      })

      await promise
      navigate(`/${slug}`)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (slug.length > 50) {
      setSlugError("Max 50 characters")
    } else if (!/^(?:[_a-z0-9]+)*$/.test(slug)) {
      setSlugError("Slug can only contain lower case letters, numbers and undercores")
    } else {
      setSlugError(null)
    }
  }, [slug])

  useEffect(() => {
    setSlug(name.replaceAll(" ", "_").replaceAll("-", "_").replaceAll("__", "_").toLowerCase())
  }, [name])

  function clear() {
    setName("")
    setSlug("")
    setTreasury("")
    setStake("")
    setStakeAcc(null)
    setBgFile(null)
    setLogoFile(null)
  }

  const isDirty = name || slug || treasury || stake || logoFile || bgFile
  const canSubmit = name && slug && !slugError

  if (!wallet.publicKey) {
    return <ErrorMessage title="Wallet disconnected" />
  }

  return (
    <div className="h-full flex flex-col gap-4 ">
      <Link to=".">
        {theme?.logo ? <img src={theme?.logo} className="h-20" /> : <h3 className="text-3xl">{name}</h3>}
      </Link>
      <PanelCard
        title={
          <span>
            Create <Title app="raffler" />
          </span>
        }
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button color="danger" variant="bordered" onClick={clear} isDisabled={!isDirty}>
              Clear
            </Button>
            <Button color="primary" isDisabled={loading || !canSubmit} onClick={createRaffler}>
              Create //RAFFLE
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex sm:flex-row flex-col gap-3">
            <Input
              autoFocus
              label="Name"
              variant="bordered"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-form-type="other"
            />
            <Input
              label="Slug"
              variant="bordered"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              description={`https://raffle.xinlabs.io/${slug}`}
              errorMessage={slugError}
              data-form-type="other"
            />
          </div>

          <Input
            label="Treasury"
            variant="bordered"
            value={treasury}
            onChange={(e) => setTreasury(e.target.value)}
            description={`Leave blank to use your wallet`}
            data-form-type="other"
          />

          <div className="flex flex-col [@media(min-width:400px)]:flex-row gap-6 w-full mb-3">
            <ImageUpload
              label="Logo"
              file={logoFile}
              setFile={setLogoFile}
              className="flex-1"
              onClear={() => setLogoFile(null)}
            />
            <ImageUpload
              label="Background"
              file={bgFile}
              setFile={setBgFile}
              className="flex-1"
              onClear={() => setBgFile(null)}
            />
          </div>
          <Input
            label="// STAKE"
            variant="bordered"
            value={stake}
            onValueChange={setStake}
            description={`Linked a // STAKE account to share themes and access stake based raffle entries`}
            data-form-type="other"
          />
        </div>
      </PanelCard>
    </div>
  )
}
