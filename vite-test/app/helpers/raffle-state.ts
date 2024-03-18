import { RaffleState, RaffleWithPublicKeyAndEntrants } from "~/types/types"

export function getRaffleState(raffle: RaffleWithPublicKeyAndEntrants) {
  const start = raffle.account.startTime.toNumber()
  const end = raffle.account.endTime.toNumber()

  const date = Date.now() / 1000

  console.log(!raffle.entrants && !raffle.account.uri)

  if (!raffle.entrants && !raffle.account.uri && raffle.account.claimed) {
    return RaffleState.cancelled
  } else if (raffle.account.claimed) {
    return RaffleState.claimed
  } else if (raffle.account.randomness) {
    return RaffleState.drawn
  } else if ((raffle.entrants.total || 0) >= (raffle.entrants.max || 0)) {
    return RaffleState.ended
  } else if (raffle.account.claimed && raffle.entrants && !raffle.entrants.total) {
    return RaffleState.cancelled
  } else if (raffle.account.claimed) {
    return RaffleState.claimed
  } else if (date < start) {
    return RaffleState.notStarted
  } else if (date >= end) {
    return RaffleState.ended
  } else {
    return RaffleState.inProgress
  }
}
