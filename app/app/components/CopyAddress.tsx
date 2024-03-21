import { CheckCircleIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline"
import { Link, Tooltip } from "@nextui-org/react"
import { FC, useEffect, useState } from "react"
import { shorten } from "~/helpers"

type CopyAddressProps = {
  children: any
  chain?: string
  wallet?: Boolean
  textAlign?: "right" | "left" | "center"
  color?: any
  fontWeight?: any
}

export const CopyAddress: FC<CopyAddressProps> = ({ children, chain = "solana", wallet, ...props }) => {
  const [copied, setCopied] = useState(false)

  function copyPk() {
    navigator.clipboard.writeText(children)
    setCopied(true)
  }

  useEffect(() => {
    if (!copied) return

    const id = setTimeout(() => {
      setCopied(false)
    }, 2000)

    return () => {
      clearTimeout(id)
    }
  }, [copied])

  const targets = {
    solana: {
      name: "Solscan",
      url: "https://solscan.io/token/",
      image: "/solscan.png",
    },
  }

  const target = targets[chain as keyof object] as any

  return (
    <span className="flex gap-1 items-center">
      <Tooltip content={`View on ${target.name}`}>
        <Link href={`${target.url}${children}`} target="_blank">
          <img src={target.image} width="15px" style={{ display: "block" }} />
        </Link>
      </Tooltip>
      <span {...props}>{shorten(children)}</span>

      {copied ? (
        <CheckCircleIcon className="w-6 text-primary" />
      ) : (
        <Tooltip content="Copy address">
          <DocumentDuplicateIcon className="w-6 cursor-pointer" onClick={copyPk} />
        </Tooltip>
      )}
    </span>
  )
}
