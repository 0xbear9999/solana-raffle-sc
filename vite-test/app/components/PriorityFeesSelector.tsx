import { PriorityFees } from "../constants"
import { usePriorityFees } from "../context/priority-fees"
import { Popover } from "./Popover"
import { Select, SelectItem, Selection } from "@nextui-org/react"

export function PriorityFeesSelector() {
  const { feeLevel, setFeeLevel } = usePriorityFees()

  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <div className="flex items-center gap-3">
        <Popover
          title="Priority fees"
          content={`Increase this to prioritise your transactions in times of network congestion. We recommend always using at-least "MEDIUM" priority to ensure your transactions are processed.`}
          placement="left"
        />
        <Select
          label="Priority fees"
          variant="bordered"
          placeholder="Select an animal"
          selectedKeys={new Set([feeLevel])}
          className="max-w-xs"
          onSelectionChange={(val: Selection) => {
            setFeeLevel([...val][0] as any)
          }}
          size="sm"
        >
          {Object.keys(PriorityFees).map((key, i) => (
            <SelectItem
              value={PriorityFees[key as keyof typeof PriorityFees]}
              key={PriorityFees[key as keyof typeof PriorityFees]}
            >
              {PriorityFees[key as keyof typeof PriorityFees]}
            </SelectItem>
          ))}
        </Select>
      </div>
    </div>
  )
}
