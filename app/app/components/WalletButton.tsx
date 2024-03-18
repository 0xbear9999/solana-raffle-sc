"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { useEffect, useState } from "react"
import { toast } from "react-hot-toast"

import { Button, Listbox, ListboxItem, Modal, ModalBody, ModalContent, ModalHeader } from "@nextui-org/react"
import { shorten } from "~/helpers"
import {
  ArrowLeftStartOnRectangleIcon,
  Cog6ToothIcon,
  DocumentDuplicateIcon,
  WalletIcon,
} from "@heroicons/react/24/outline"
import { useRaffle } from "~/context/raffle"
import { Link, useMatches } from "@remix-run/react"
import { Title } from "./Title"
import { Raffler } from "~/types/types"

export const WalletButton = () => {
  const program = useRaffle()
  const matches = useMatches()
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

  function onAdminClick() {
    handleClose()
  }

  let raffler = (matches.find((match: any) => match.data !== null && "raffler" in match.data)?.data as any)?.raffler

  const account: Raffler | null = raffler
    ? program.coder.accounts.decode("raffler", Buffer.from(raffler.account))
    : null
  const authority = account?.authority.toBase58()

  const isAdmin = wallet.publicKey?.toBase58() === authority

  const icons = {
    copy: <DocumentDuplicateIcon className="w-5" />,
    "change-wallet": <WalletIcon className="w-5" />,
    disconnect: <ArrowLeftStartOnRectangleIcon className="w-5" />,
    admin: <Cog6ToothIcon className="w-5" />,
  }

  return (
    <>
      <div>
        <Button onClick={wallet.connected ? handleClick : toggleVisible} color="primary" variant="bordered">
          <div className="flex gap-1 items-center">
            <WalletIcon className="w-5" />
            <p className="sm:hidden md:flex flex">
              {wallet.connected ? shorten(wallet.publicKey?.toBase58() as string) : "Connect"}
            </p>
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
              items={[
                {
                  key: "copy",
                  label: "Copy",
                },
                {
                  key: "change-wallet",
                  label: "Change wallet",
                },
                {
                  key: "disconnect",
                  label: "Disconnect",
                },
                ...(isAdmin ? [{ key: "admin", label: "Admin" }] : []),
              ]}
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
                  case "admin":
                    onAdminClick()
                    break
                }
              }}
            >
              {(item) => (
                <ListboxItem
                  key={item.key}
                  color={item.key === "disconnect" ? "danger" : "default"}
                  className={item.key === "disconnect" ? "text-danger" : ""}
                  startContent={icons[item.key as keyof object]}
                >
                  {item.key === "admin" ? <Link to={`${account?.slug}/admin`}>{item.label}</Link> : item.label}
                </ListboxItem>
              )}
            </Listbox>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  )
}
