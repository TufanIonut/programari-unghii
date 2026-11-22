export type Season = 'winter' | 'spring' | 'summer' | 'autumn'
/** Ce a ales vizitatoarea: anotimpul după dată, unul anume sau fără animație. */
export type SeasonChoice = 'auto' | Season | 'off'

export const SEASON_LABEL: Record<Season, string> = {
  winter: 'Iarnă — zăpadă',
  spring: 'Primăvară — flori',
  summer: 'Vară — umbrele',
  autumn: 'Toamnă — frunze',
}

/** Dec–feb iarnă, mar–mai primăvară, iun–aug vară, sep–nov toamnă. */
export function seasonOf(date: Date): Season {
  const m = date.getMonth()
  if (m === 11 || m <= 1) return 'winter'
  if (m <= 4) return 'spring'
  if (m <= 7) return 'summer'
  return 'autumn'
}

const KEY = 'pu-season'
const CHOICES: SeasonChoice[] = ['auto', 'winter', 'spring', 'summer', 'autumn', 'off']

export function loadSeasonChoice(): SeasonChoice {
  try {
    const v = localStorage.getItem(KEY) as SeasonChoice | null
    return v && CHOICES.includes(v) ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function saveSeasonChoice(choice: SeasonChoice) {
  try {
    if (choice === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* fără stocare (navigare privată): alegerea ține doar până la reîncărcare */
  }
}

export const resolveSeason = (choice: SeasonChoice, now = new Date()): Season | null =>
  choice === 'off' ? null : choice === 'auto' ? seasonOf(now) : choice
