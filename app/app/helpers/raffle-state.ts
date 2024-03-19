import { Entrants, RaffleState, RaffleWithPublicKey, RaffleWithPublicKeyAndEntrants } from "~/types/types"

export function getRaffleState(raffle: RaffleWithPublicKey, entrants: Entrants) {
  const start = raffle.account.startTime.toNumber()
  const end = raffle.account.endTime.toNumber()

  const date = Date.now() / 1000

  if (!entrants && !raffle.account.uri && raffle.account.claimed) {
    return RaffleState.cancelled
  } else if (raffle.account.claimed) {
    return RaffleState.claimed
  } else if (raffle.account.randomness) {
    return RaffleState.drawn
  } else if (raffle.account.uri) {
    return RaffleState.awaitingRandomness
  } else if ((entrants.total || 0) >= (entrants.max || 0)) {
    return RaffleState.ended
  } else if (raffle.account.claimed && entrants && !entrants.total) {
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
