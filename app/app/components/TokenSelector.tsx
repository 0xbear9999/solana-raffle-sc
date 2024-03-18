import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@nextui-org/react"
import { useWallet } from "@solana/wallet-adapter-react"
import axios from "axios"
import { DAS } from "helius-sdk"
import { orderBy } from "lodash"
import { Dispatch, SetStateAction, useEffect, useState } from "react"
import { shorten } from "~/helpers"
import { TokenWithTokenInfo } from "~/types/types"

export function TokenSelector({
  modalOpen,
  setModalOpen,
  setSelected,
}: {
  modalOpen: boolean
  setModalOpen: Dispatch<SetStateAction<boolean>>
  setSelected: (asset: DAS.GetAssetResponse) => void
}) {
  const [tokens, setTokens] = useState<TokenWithTokenInfo[]>([])
  const wallet = useWallet()
  useEffect(() => {
    if (!wallet.publicKey) {
      return
    }

    ;(async () => {
      const { data } = await axios.get<{ digitalAssets: TokenWithTokenInfo[] }>(
        `/api/get-fungibles/${wallet.publicKey}`
      )
      setTokens(orderBy(data.digitalAssets, (item) => item.token_info?.price_info?.total_price || 0, "desc"))
    })()
  }, [wallet.publicKey])

  return (
    <Modal
      isOpen={modalOpen}
      onClose={() => setModalOpen(false)}
      className="main-theme text-foreground"
      size="5xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Select a token</ModalHeader>
            <ModalBody>
              <Table>
                <TableHeader>
                  <TableColumn>Name</TableColumn>
                  <TableColumn>Address</TableColumn>
                  <TableColumn>Balance</TableColumn>
                  <TableColumn>Price</TableColumn>
                  <TableColumn>Value</TableColumn>
                </TableHeader>
                <TableBody>
                  {tokens.map((token: TokenWithTokenInfo) => {
                    return (
                      <TableRow
                        key={token.id}
                        className="hover:bg-gray-800 cursor-pointer"
                        onClick={() => {
                          setSelected(token)
                          onClose()
                        }}
                      >
                        <TableCell>
                          {token.content?.metadata.name ||
                            token.content?.metadata.symbol ||
                            token.token_info.symbol ||
                            "Unknown token"}
                        </TableCell>
                        <TableCell key="address">{shorten(token.id)}</TableCell>
                        <TableCell key="balance">
                          {(token.token_info.balance / Math.pow(10, token.token_info.decimals)).toLocaleString()}
                        </TableCell>
                        <TableCell>${token.token_info?.price_info?.price_per_token}</TableCell>
                        <TableCell>${token.token_info?.price_info?.total_price}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
