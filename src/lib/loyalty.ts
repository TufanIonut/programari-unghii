import type { LoyaltyCard } from '../api/loyalty'

/** „Încă 3 vizite până la 20% reducere.” */
export function visitsLeftText(card: Pick<LoyaltyCard, 'stamps' | 'required' | 'reward'>) {
  const left = card.required - card.stamps
  return left === 1 ? `La următoarea vizită primești ${card.reward}.` : `Încă ${left} vizite până la ${card.reward}.`
}
