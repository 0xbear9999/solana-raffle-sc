import { Chip } from "@nextui-org/react"
import { Entrants, RaffleState, RaffleWithPublicKey, RaffleWithPublicKeyAndEntrants } from "~/types/types"

export function RaffleStateChip({
  raffleState,
  raffle,
  entrants,
}: {
  raffleState: RaffleState
  raffle: RaffleWithPublicKey
  entrants: Entrants
}) {
  return (
    <Chip
      className="absolute top-2 right-2 z-10"
      color={
        {
          [RaffleState.notStarted]: "primary",
          [RaffleState.ended]: "warning",
          [RaffleState.inProgress]: "success",
          [RaffleState.cancelled]: "danger",
          [RaffleState.awaitingRandomness]: "warning",
          [RaffleState.claimed]: "success",
          [RaffleState.drawn]: "danger",
        }[raffleState] as any
      }
    >
      {raffleState === RaffleState.ended && !entrants.total ? RaffleState.claimed : raffleState}
    </Chip>
  )
}
