"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"

import { Button, Listbox, ListboxItem, Modal, ModalBody, ModalContent } from "@nextui-org/react"
import { shorten } from "~/helpers"
import { ArrowLeftStartOnRectangleIcon, DocumentDuplicateIcon, WalletIcon } from "@heroicons/react/24/outline"

export const WalletButton = ({ authority }: { authority?: string }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const wallet = useWallet()
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }

  const { setVisible, visible } = useWalletModal()
  const toggleVisible = () => {
    setVisible(!visible)
  }

  async function copyAddress() {
    try {
      const address = wallet.publicKey?.toBase58()
      if (!address) {
        throw new Error("Wallet not connected")
      }
      await navigator.clipboard.writeText(address)
      toast.success(`${shorten(address)} copied to clipboard`)
    } catch (err: any) {
      toast.error(err.message || "Error copying address")
    } finally {
      handleClose()
    }
  }

  function onDisconnectClick() {
    wallet.disconnect()
    handleClose()
  }

  function handleChangeWallet() {
    toggleVisible()
    handleClose()
  }

  function openSettingsModal() {
    handleClose()
  }

  const isAdmin = wallet.publicKey?.toBase58() === authority
  // const isXs = useMediaQuery((theme: Theme) => theme.breakpoints.down("xs"))

  return (
    <>
      <div>
        <Button onClick={wallet.connected ? handleClick : toggleVisible} color="primary">
          <div className="flex gap-1 items-center">
            <WalletIcon className="w-5" />
            <p>{wallet.connected ? shorten(wallet.publicKey?.toBase58() as string) : "Connect"}</p>
          </div>
        </Button>
      </div>
      <Modal
        isOpen={open}
        onOpenChange={(open) => !open && handleClose()}
        className="main-theme text-foreground w-full max-w-[260px] border-small px-1 py-2 rounded-small border-default-200 dark:border-default-100"
      >
        <ModalContent className="absolute top-0 right-2">
          <ModalBody>
            <Listbox
              aria-label="Wallet"
              onAction={(key) => {
                switch (key) {
                  case "copy":
                    copyAddress()
                    break
                  case "change-wallet":
                    handleChangeWallet()
                    break
                  case "disconnect":
                    onDisconnectClick()
                    break
                }
              }}
            >
              <ListboxItem key="copy" startContent={<DocumentDuplicateIcon className="w-5" />}>
                Copy address
              </ListboxItem>
              <ListboxItem key="change-wallet" startContent={<WalletIcon className="w-5" />}>
                Change wallet
              </ListboxItem>
              <ListboxItem
                key="disconnect"
                className="text-danger"
                color="danger"
                startContent={<ArrowLeftStartOnRectangleIcon className="w-5" />}
              >
                Disconnect
              </ListboxItem>

              {/* <MenuItem onClick={copyAddress}>
          <ListItemIcon>
            <ContentCopy />
          </ListItemIcon>
          <ListItemText>
            <Link underline="none">Copy address</Link>
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleChangeWallet}>
          <ListItemIcon>
            <WalletIcon />
          </ListItemIcon>
          <ListItemText>
            <Link underline="none">Change wallet</Link>
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={onDisconnectClick}>
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText>
            <Link underline="none">Disconnect</Link>
          </ListItemText>
        </MenuItem> */}
            </Listbox>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  )
}
