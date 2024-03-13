import { setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox"
import { transactionBuilder } from "@metaplex-foundation/umi"
import { fromWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters"
import { Button, Card, CardBody, CardFooter, CardHeader, Input, Link as NextUiLink, Switch } from "@nextui-org/react"
import { Link, useNavigate } from "@remix-run/react"
import base58 from "bs58"
import { debounce } from "lodash"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { BackArrow } from "~/components/BackArrow"
import { usePriorityFees } from "~/context/priority-fees"
import { useRaffle } from "~/context/raffle"
import { useStake } from "~/context/stake"
import { useUmi } from "~/context/umi"
import { getStakerFromSlug } from "~/helpers"
import { getPriorityFeesForTx } from "~/helpers/helius"
import { findProgramConfigPda, findRafflerPda } from "~/helpers/pdas"
import { Staker } from "~/types/types"

export default function Create() {
  const { feeLevel } = usePriorityFees()
  const stakeProgram = useStake()
  const [stake, setStake] = useState("")
  const [stakeAcc, setStakeAcc] = useState<Staker | null>(null)
  const [linkStake, setLinkStake] = useState(false)
  const [loading, setLoading] = useState(false)
  const [slug, setSlug] = useState("")
  const [name, setName] = useState("")
  const [treasury, setTreasury] = useState("")
  const umi = useUmi()
  const program = useRaffle()
  const [slugError, setSlugError] = useState<null | string>(null)
  const navigate = useNavigate()
  function onOpenChange(open: boolean) {
    if (!open) {
      navigate("/")
    }
  }

  useEffect(() => {
    if (!slug) {
      setStake("")
      setLinkStake(false)
      setStakeAcc(null)
      return
    }

    const debouncedFilter = debounce(async () => {
      try {
        const stakeApp = await getStakerFromSlug(slug, stakeProgram)
        if (stakeApp) {
          setStake(stakeApp.publicKey.toBase58())
          setStakeAcc(stakeApp.account)
          setLinkStake(true)
        } else {
          setStake("")
          setStakeAcc(null)
          setLinkStake(false)
        }
      } catch (err) {
        setStake("")
        setStakeAcc(null)
        setLinkStake(false)
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
          setLinkStake(true)
        } else {
          setStakeAcc(null)
          setLinkStake(false)
        }
      } catch (err) {
        setStakeAcc(null)
        setLinkStake(false)
      }
    }, 500)

    debouncedFilter()
  }, [stake])

  async function createRaffler() {
    try {
      setLoading(true)
      const promise = Promise.resolve().then(async () => {
        const raffler = findRafflerPda(umi, umi.identity.publicKey)
        let tx = transactionBuilder().add({
          instruction: fromWeb3JsInstruction(
            await program.methods
              .init(name, slug)
              .accounts({
                programConfig: findProgramConfigPda(),
                raffler,
                treasury: treasury || null,
                staker: linkStake && stake ? stake : null,
              })
              .instruction()
          ),
          bytesCreatedOnChain: 8 + 32 + (4 + 50) + (4 + 50) + 32 + (1 + 4 + 50) + 1 + (1 + 32) + (1 + 32) + 1,
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
          throw res.result.value.err
        }
      })

      toast.promise(promise, {
        loading: "Creating new RAFFLE app",
        success: "RAFFLE created successfully",
        error: "Error creating app",
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
    setLinkStake(false)
  }

  const isDirty = name || slug || treasury || stake
  const canSubmit = name && slug && !slugError

  return (
    <div className="flex flex-col gap-3">
      <BackArrow />
      <Card className="w-1/2 p-10 mx-auto">
        <CardHeader>
          <h1 className="font-bold text-center w-full">Create // RAFFLE</h1>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-3">
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

            <Input
              label="Treasury"
              variant="bordered"
              value={treasury}
              onChange={(e) => setTreasury(e.target.value)}
              description={`Leave blank to use your wallet`}
              data-form-type="other"
            />

            <Input
              label="// STAKE"
              variant="bordered"
              value={stake}
              onValueChange={setStake}
              description={`Linked a // STAKE account to share themes and access stake based raffle entries`}
              data-form-type="other"
              endContent={
                <Switch
                  size="sm"
                  isDisabled={!stakeAcc}
                  isSelected={!!stakeAcc && linkStake}
                  onValueChange={setLinkStake}
                >
                  Link
                </Switch>
              }
            />
          </div>
        </CardBody>
        <CardFooter>
          <div className="flex gap-3 justify-end w-full">
            <Button color="danger" variant="bordered" onClick={clear} isDisabled={!isDirty}>
              Clear
            </Button>
            <Button color="primary" isDisabled={loading || !canSubmit} onClick={createRaffler}>
              Create //RAFFLE
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
