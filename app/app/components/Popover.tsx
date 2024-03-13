import { InformationCircleIcon } from "@heroicons/react/24/outline"
import { Popover as NextUiPopover, PopoverContent, PopoverTrigger } from "@nextui-org/react"
import { OverlayPlacement } from "@nextui-org/aria-utils"
import { ReactNode } from "react"

export function Popover({
  title,
  content,
  placement = "right",
  large = false,
}: {
  title: string
  content: ReactNode
  placement?: OverlayPlacement
  large?: boolean
}) {
  return (
    <NextUiPopover placement={placement}>
      <PopoverTrigger>
        <InformationCircleIcon className="h-6 w-6 cursor-pointer" />
      </PopoverTrigger>
      <PopoverContent className={large ? "w-[400px]" : "w-[240px]"}>
        <div className="px-1 py-2">
          <div className="text-small font-bold">{title}</div>
          <div className="text-tiny">{content}</div>
        </div>
      </PopoverContent>
    </NextUiPopover>
  )
}
