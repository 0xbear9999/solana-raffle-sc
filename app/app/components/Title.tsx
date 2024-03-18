import { cn } from "@nextui-org/react"

export function Title({ size = "text-md", app = "Raffle" }: { size?: string; app?: string }) {
  return (
    <span>
      <span className={cn("text-primary font-bold", size)}>// </span>
      <span className={cn("text-inherit font-bold uppercase", size)}>{app}</span>
    </span>
  )
}
