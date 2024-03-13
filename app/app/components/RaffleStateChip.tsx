import { Chip } from "@nextui-org/react"
import { RaffleState, RaffleWithPublicKeyAndEntrants } from "~/types/types"

export function RaffleStateChip({
  raffleState,
  raffle,
}: {
  raffleState: RaffleState
  raffle: RaffleWithPublicKeyAndEntrants
}) {
  console.log(raffleState, raffle)
  return (
    <Chip
      className="absolute top-2 right-2 z-10"
      color={
        {
          [RaffleState.notStarted]: "primary",
          [RaffleState.ended]: "warning",
          [RaffleState.inProgress]: "success",
          [RaffleState.cancelled]: "danger",
          [RaffleState.claimed]: "success",
          [RaffleState.drawn]: "danger",
        }[raffleState] as any
      }
    >
      {raffleState === RaffleState.ended && !raffle.entrants.total ? RaffleState.claimed : raffleState}
    </Chip>
  )
}
