// Works out *who starts where* in a rotate schedule's cycle, and grades the
// result.
//
// The model is the one the rest of the feature already uses: a schedule owns
// one shared `pattern[]` of cycle cards, and every crew is placed at a
// starting card — its **offset**. A crew's card on any given step is
//
//     pattern[(stepsSinceStart + offset) mod pattern.length]
//
// which is exactly `getAssignedIndex` in `features/schedule-rotation/utils.ts`.
// A crew's offset is stored implicitly, as the pattern position its
// `employee_ids` / `team_ids` sit on — so everything here is a *generator of*
// and *report on* data the form already holds. Nothing new is persisted.
//
// All this module adds is the part a human was doing by hand: choosing the
// offsets so crews are not all resting on the same day, and saying plainly
// when the result is thin, lopsided, or leaves a shift unstaffed.
//
// Two things make it general enough for real rosters rather than just the
// textbook four-crew cases:
//
//   - **Coverage-driven search, not fixed spacing.** Even spacing is only
//     optimal when the rest pattern is uniform. DuPont and Southern Swing are
//     not, so the offsets are chosen by minimising coverage variance and even
//     spacing is kept only as a tie-breaker.
//   - **Fixed-shift crews.** A crew carrying `fixedShiftId` works that shift on
//     every working card instead of taking the card's own shift, which is how
//     "Team A is always on days, Team B always on nights, both on the same
//     2-2-3 rest mask" gets expressed. Leave it unset and the crew rotates
//     through the pattern's shifts as before.

// One card of the cycle. `index` is 0-based (the schema's own `position` is
// 1-based — callers re-index, same as `getRotationPositions` does).
export type SuggestionSlot = {
  index: number
  shiftId?: string
  isOff: boolean
}

// One unit that shares a starting position. A whole team counts as one crew
// (every member rotates together); an individually picked employee is a crew
// of one.
export type SuggestionCrew = {
  key: string
  kind: 'team' | 'employee'
  label: string
  employeeIds: string[]
  // When set, this crew works this shift on every working card rather than the
  // card's own shift — see the note above.
  fixedShiftId?: string
}

export type CrewAssignment = {
  crew: SuggestionCrew
  offset: number
}

export type CoverageDay = {
  index: number
  // Crews working this card of the cycle, and the head count behind them.
  onDuty: number
  headcount: number
  offCrews: number
  byShiftId: Record<string, number>
}

export type SuggestionWarningCode =
  | 'no-crews'
  | 'no-positions'
  | 'overstaffed'
  | 'coverage-gap'
  | 'uncovered-shift'
  | 'uneven-coverage'
  | 'long-work-run'
  | 'weekend-imbalance'
  | 'weekday-drift'
  | 'weekday-anchor'

export type SuggestionWarning = {
  code: SuggestionWarningCode
  // The split is deliberately about *fixability*, not severity of outcome:
  //
  //   error   — nothing to work with at all (no pattern, or nobody on it).
  //   warning — reassigning starting positions would genuinely improve this,
  //             so "Suggest assignment" is worth pressing.
  //   info    — a property of the pattern and crew count that no assignment
  //             can change. An office 5-2 week has nobody in on Saturday by
  //             design, and a day/night pattern is meant to leave one shift
  //             empty half the time; neither is a mistake, so neither may
  //             read as one.
  //
  // Getting this wrong in the obvious direction — treating "fewer crews than
  // cycle days" as understaffing — flags a textbook-correct four-crew Panama
  // roster as broken, which is why the rule is coverage-based instead.
  severity: 'error' | 'warning' | 'info'
  message: string
}

export type RotationAnalysis = {
  coverage: CoverageDay[]
  warnings: SuggestionWarning[]
  cost: number
}

export type RotationSuggestion = RotationAnalysis & {
  assignments: CrewAssignment[]
}

export type SuggestionOptions = {
  // Only needed for the weekday/weekend checks. Without it those are skipped.
  startDate?: Date
  // JS `getDay()` values. Defaults to Saturday + Sunday.
  weekendDays?: number[]
}

const DEFAULT_WEEKEND_DAYS = [0, 6]

// Above this many candidate offset sets the exhaustive search is skipped in
// favour of a seeded local search. Sized so the rosters people actually build
// stay exhaustive: DuPont (28 cards, 4 crews) is 2,925 candidates and a 28-day
// cycle with 6 crews is 80,730.
const EXHAUSTIVE_LIMIT = 100_000

const MAX_LOCAL_ROUNDS = 60

// Per-shift balance matters more than raw head count — a day where nobody is
// on nights is worse than a day with one extra person on days.
const SHIFT_BALANCE_WEIGHT = 2

// Only ever breaks exact ties, pulling equally-good answers toward the evenly
// spaced one a human would have picked.
const EVEN_SPACING_TIEBREAK = 1e-4

// A crew is "on" whenever its card is a working one; which shift it actually
// works is its own fixed shift if it has one, else the card's.
function shiftForCrew(
  slot: SuggestionSlot,
  crew: SuggestionCrew
): string | undefined {
  if (slot.isOff) return undefined
  return crew.fixedShiftId ?? slot.shiftId
}

function floorMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

// The spacing a human would reach for: crews spread as evenly as the cycle
// allows. Strictly increasing (so offsets stay distinct) whenever there are at
// least as many cards as crews.
function evenSpacedOffsets(cycleLength: number, crewCount: number): number[] {
  return Array.from({ length: crewCount }, (_, k) =>
    Math.floor((k * cycleLength) / crewCount)
  )
}

// How many cards of one full cycle each crew spends on each shift. Independent
// of the offsets — every crew visits every card exactly once per cycle — so
// these targets can be computed before any search starts.
function buildShiftTargets(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[]
): Map<string, number> {
  const cycleLength = slots.length
  const workSlots = slots.filter((slot) => !slot.isOff).length

  const cardsPerShift = new Map<string, number>()
  slots.forEach((slot) => {
    if (slot.isOff || !slot.shiftId) return
    cardsPerShift.set(slot.shiftId, (cardsPerShift.get(slot.shiftId) ?? 0) + 1)
  })

  const totals = new Map<string, number>()
  crews.forEach((crew) => {
    if (crew.fixedShiftId) {
      // A fixed-shift crew works its own shift on every working card.
      totals.set(
        crew.fixedShiftId,
        (totals.get(crew.fixedShiftId) ?? 0) + workSlots
      )
      return
    }
    cardsPerShift.forEach((count, shiftId) => {
      totals.set(shiftId, (totals.get(shiftId) ?? 0) + count)
    })
  })

  const targets = new Map<string, number>()
  totals.forEach((total, shiftId) => {
    targets.set(shiftId, total / cycleLength)
  })
  return targets
}

export function buildCoverage(
  slots: SuggestionSlot[],
  assignments: CrewAssignment[]
): CoverageDay[] {
  const cycleLength = slots.length
  if (cycleLength === 0) return []

  return Array.from({ length: cycleLength }, (_, day) => {
    const byShiftId: Record<string, number> = {}
    let onDuty = 0
    let headcount = 0
    let offCrews = 0

    assignments.forEach(({ crew, offset }) => {
      const slot = slots[floorMod(day + offset, cycleLength)]
      const shiftId = shiftForCrew(slot, crew)
      if (!shiftId) {
        offCrews += 1
        return
      }
      onDuty += 1
      // A crew always counts as at least one body, even before its team has
      // been populated — otherwise an empty team reads as free coverage.
      headcount += Math.max(crew.employeeIds.length, 1)
      byShiftId[shiftId] = (byShiftId[shiftId] ?? 0) + 1
    })

    return { index: day, onDuty, headcount, offCrews, byShiftId }
  })
}

// A day with nobody on it at all is categorically worse than a lumpy one, so
// it is priced above everything else the score can add up to rather than left
// to compete on equal terms. Without this, a 5-2 pattern run by two crews came
// back as [2, 2, 2, 1, 0, 1, 2] — one day with the plant shut, bought in
// exchange for a very even Morning count — when [2, 2, 1, 1, 2, 1, 1] was
// available.
//
// Gaps nobody can fill stay harmless. When the pattern simply has not got the
// crew-days to cover every card — a single crew on a 5-2 week — every
// candidate pays the same number of these, and a constant added to every
// candidate cannot change which one is smallest. It only bites when a gap was
// avoidable, which is exactly when it should.
//
// The size is a bound, not a magic number: the largest total the rest of the
// score can reach, so one gap always outweighs any amount of unevenness.
// `(onDuty - mean)²` and `(actual - target)²` are both capped by `crewCount²`,
// since each side of the subtraction lies in [0, crewCount].
function emptyDayPenalty(
  cycleLength: number,
  crewCount: number,
  shiftCount: number
): number {
  const perDayMax = (1 + SHIFT_BALANCE_WEIGHT * shiftCount) * crewCount ** 2
  const spacingMax = EVEN_SPACING_TIEBREAK * crewCount * cycleLength ** 2
  return cycleLength * perDayMax + spacingMax + 1
}

// Lower is better. Days nobody works at all first, then flat crew-on-duty
// counts, then flat per-shift counts, with evenly spaced offsets only as a
// tie-break.
function scoreOffsets(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[],
  offsets: number[],
  targets: Map<string, number>
): number {
  const cycleLength = slots.length
  const crewCount = crews.length
  if (cycleLength === 0 || crewCount === 0) return 0

  const workSlots = slots.filter((slot) => !slot.isOff).length
  const meanOnDuty = (crewCount * workSlots) / cycleLength
  const gapPenalty = emptyDayPenalty(cycleLength, crewCount, targets.size)

  let cost = 0

  for (let day = 0; day < cycleLength; day++) {
    let onDuty = 0
    const perShift = new Map<string, number>()

    for (let k = 0; k < crewCount; k++) {
      const slot = slots[floorMod(day + offsets[k], cycleLength)]
      const shiftId = shiftForCrew(slot, crews[k])
      if (!shiftId) continue
      onDuty += 1
      perShift.set(shiftId, (perShift.get(shiftId) ?? 0) + 1)
    }

    if (onDuty === 0) cost += gapPenalty
    cost += (onDuty - meanOnDuty) ** 2

    targets.forEach((target, shiftId) => {
      const actual = perShift.get(shiftId) ?? 0
      cost += SHIFT_BALANCE_WEIGHT * (actual - target) ** 2
    })
  }

  const ideal = evenSpacedOffsets(cycleLength, crewCount)
  const sorted = [...offsets].sort((a, b) => a - b)
  sorted.forEach((offset, k) => {
    cost += EVEN_SPACING_TIEBREAK * (offset - ideal[k]) ** 2
  })

  return cost
}

function combinationCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1)
    if (result > EXHAUSTIVE_LIMIT) return Number.POSITIVE_INFINITY
  }
  return Math.round(result)
}

function* combinations(pool: number[], k: number): Generator<number[]> {
  if (k === 0) {
    yield []
    return
  }
  if (k > pool.length) return

  const indices = Array.from({ length: k }, (_, i) => i)
  for (;;) {
    yield indices.map((i) => pool[i])
    let i = k - 1
    while (i >= 0 && indices[i] === pool.length - k + i) i--
    if (i < 0) return
    indices[i] += 1
    for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1
  }
}

// Hill-climbing over the actual crew→offset assignment. Two move types, and
// the second one earns its keep: moving a crew explores different offset
// *sets*, while swapping two crews' offsets only matters once crews differ
// from each other — different team sizes, or a fixed shift on some of them.
function localImprove(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[],
  targets: Map<string, number>,
  seed: number[]
): number[] {
  const cycleLength = slots.length
  const crewCount = crews.length
  const allowDuplicates = crewCount > cycleLength

  let best = [...seed]
  let bestCost = scoreOffsets(slots, crews, best, targets)

  for (let round = 0; round < MAX_LOCAL_ROUNDS; round++) {
    let improved = false

    for (let k = 0; k < crewCount; k++) {
      for (let offset = 0; offset < cycleLength; offset++) {
        if (best[k] === offset) continue
        if (!allowDuplicates && best.includes(offset)) continue
        const trial = [...best]
        trial[k] = offset
        const cost = scoreOffsets(slots, crews, trial, targets)
        if (cost < bestCost - 1e-9) {
          best = trial
          bestCost = cost
          improved = true
        }
      }
    }

    for (let a = 0; a < crewCount; a++) {
      for (let b = a + 1; b < crewCount; b++) {
        if (best[a] === best[b]) continue
        const trial = [...best]
        trial[a] = best[b]
        trial[b] = best[a]
        const cost = scoreOffsets(slots, crews, trial, targets)
        if (cost < bestCost - 1e-9) {
          best = trial
          bestCost = cost
          improved = true
        }
      }
    }

    if (!improved) break
  }

  return best
}

function chooseOffsets(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[],
  targets: Map<string, number>
): number[] {
  const cycleLength = slots.length
  const crewCount = crews.length
  if (cycleLength === 0 || crewCount === 0) return []

  const seed = evenSpacedOffsets(cycleLength, crewCount)

  // Rotating every offset by the same amount rotates the coverage array
  // without changing it, so one crew can be pinned to card 0 for free — it
  // removes a whole symmetry class from the search.
  const candidates = combinationCount(cycleLength - 1, crewCount - 1)

  let start = seed
  if (crewCount <= cycleLength && candidates <= EXHAUSTIVE_LIMIT) {
    const pool = Array.from({ length: cycleLength - 1 }, (_, i) => i + 1)
    let bestCost = Number.POSITIVE_INFINITY
    for (const combo of combinations(pool, crewCount - 1)) {
      const offsets = [0, ...combo]
      const cost = scoreOffsets(slots, crews, offsets, targets)
      if (cost < bestCost - 1e-9) {
        bestCost = cost
        start = offsets
      }
    }
  }

  // Always polish: the exhaustive pass picks the best offset *set* but hands
  // crews to it in pick order, which is not necessarily the best pairing once
  // crews differ from one another.
  return localImprove(slots, crews, targets, start)
}

function longestWorkRun(slots: SuggestionSlot[]): number {
  const cycleLength = slots.length
  if (cycleLength === 0) return 0
  if (slots.every((slot) => !slot.isOff)) return Number.POSITIVE_INFINITY

  let longest = 0
  let run = 0
  // Twice around, so a run that wraps the end of the cycle is measured whole.
  for (let i = 0; i < cycleLength * 2; i++) {
    if (slots[i % cycleLength].isOff) {
      run = 0
      continue
    }
    run += 1
    longest = Math.max(longest, run)
  }
  return Math.min(longest, cycleLength)
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function formatAverage(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

function buildWeekdayWarnings(
  slots: SuggestionSlot[],
  assignments: CrewAssignment[],
  options: SuggestionOptions
): SuggestionWarning[] {
  const { startDate } = options
  if (!startDate) return []

  const cycleLength = slots.length
  const warnings: SuggestionWarning[] = []

  if (cycleLength % 7 !== 0) {
    warnings.push({
      code: 'weekday-drift',
      severity: 'info',
      message: `A ${cycleLength}-day cycle is not a whole number of weeks, so each crew's working weekdays shift every time it repeats. That is normal for continuous operations — if the pattern is meant to read the same every week, use a cycle length that is a multiple of 7.`,
    })
    return warnings
  }

  const startDay = startDate.getDay()
  if (startDay !== 1) {
    warnings.push({
      code: 'weekday-anchor',
      severity: 'info',
      message: `The cycle starts on a ${WEEKDAY_NAMES[startDay]}, so card 1 always falls on a ${WEEKDAY_NAMES[startDay]}. Start the schedule on a Monday if the pattern is meant to be read Monday-first.`,
    })
  }

  const weekendDays = options.weekendDays ?? DEFAULT_WEEKEND_DAYS
  const weekendLoads = assignments.map(({ crew, offset }) => {
    let worked = 0
    for (let day = 0; day < cycleLength; day++) {
      if (!weekendDays.includes((startDay + day) % 7)) continue
      const slot = slots[floorMod(day + offset, cycleLength)]
      if (shiftForCrew(slot, crew)) worked += 1
    }
    return worked
  })

  if (weekendLoads.length > 1) {
    const min = Math.min(...weekendLoads)
    const max = Math.max(...weekendLoads)
    if (max - min > 1) {
      warnings.push({
        code: 'weekend-imbalance',
        severity: 'warning',
        message: `Weekend load is uneven — crews work between ${min} and ${max} weekend days per cycle. Reassigning starting positions can usually even this out.`,
      })
    }
  }

  return warnings
}

function buildWarnings(
  slots: SuggestionSlot[],
  assignments: CrewAssignment[],
  coverage: CoverageDay[],
  targets: Map<string, number>,
  options: SuggestionOptions
): SuggestionWarning[] {
  const cycleLength = slots.length
  const crewCount = assignments.length
  const warnings: SuggestionWarning[] = []

  if (cycleLength === 0) {
    return [
      {
        code: 'no-positions',
        severity: 'error',
        message:
          'Build the pattern first — there are no cycle positions to assign anyone to.',
      },
    ]
  }

  if (crewCount === 0) {
    return [
      {
        code: 'no-crews',
        severity: 'error',
        message:
          'Nobody is on this rotation yet. Pick teams or employees above, then suggest an assignment.',
      },
    ]
  }

  const workSlots = slots.filter((slot) => !slot.isOff).length

  if (crewCount > cycleLength) {
    warnings.push({
      code: 'overstaffed',
      severity: 'info',
      message: `${plural(crewCount, 'crew')} on a ${cycleLength}-day cycle means ${plural(crewCount - cycleLength, 'crew')} share a starting position with another. That is fine when a shift needs more than one crew on it.`,
    })
  }

  const onDutyCounts = coverage.map((day) => day.onDuty)
  const minOnDuty = Math.min(...onDutyCounts)
  const maxOnDuty = Math.max(...onDutyCounts)

  if (workSlots > 0 && minOnDuty === 0) {
    const emptyDays = coverage
      .filter((day) => day.onDuty === 0)
      .map((day) => day.index + 1)
    // Somebody can be in every day only if there are enough crew-days to go
    // around at all. Below that it is the pattern's shape, not the assignment
    // — a one-crew 5-2 week is *supposed* to leave the weekend empty.
    const fillable = crewCount * workSlots >= cycleLength
    warnings.push({
      code: 'coverage-gap',
      severity: fillable ? 'warning' : 'info',
      message: fillable
        ? `Nobody is working on ${plural(emptyDays.length, 'day')} of the cycle (${emptyDays.join(', ')}), and there are enough crews to cover them. Suggest an assignment to close the gap.`
        : `Nobody works on ${plural(emptyDays.length, 'day')} of the cycle (${emptyDays.join(', ')}). With ${plural(crewCount, 'crew')} and ${plural(workSlots, 'working card')} that is what this pattern is shaped to do — expected for an office week, worth adding crews if it is meant to run continuously.`,
    })
  } else if (maxOnDuty - minOnDuty > 1) {
    warnings.push({
      code: 'uneven-coverage',
      severity: 'warning',
      message: `Crews on duty swings between ${minOnDuty} and ${maxOnDuty} across the cycle. Suggesting an assignment will flatten it as far as the pattern allows.`,
    })
  }

  // Smallest crew count that would put at least one crew on every shift every
  // day. Meaningless once crews carry their own fixed shift, since then the
  // pattern's own card counts stop driving who works what.
  const anyFixedShift = assignments.some(
    (assignment) => assignment.crew.fixedShiftId
  )
  const cardsPerShift = new Map<string, number>()
  slots.forEach((slot) => {
    if (slot.isOff || !slot.shiftId) return
    cardsPerShift.set(slot.shiftId, (cardsPerShift.get(slot.shiftId) ?? 0) + 1)
  })
  const recommendedCrews = anyFixedShift
    ? undefined
    : Math.max(
        ...[...cardsPerShift.values()].map((count) =>
          Math.ceil(cycleLength / count)
        ),
        0
      )

  targets.forEach((target, shiftId) => {
    const uncovered = coverage.filter(
      (day) => (day.byShiftId[shiftId] ?? 0) === 0
    )
    if (uncovered.length === 0) return

    // Below one crew-day per cycle day the shift simply cannot be staffed
    // every day, whoever starts where — that is the pattern talking, not a bad
    // assignment, so it must not read as something to go and fix.
    const structural = target < 1
    const remedy =
      structural && recommendedCrews && recommendedCrews > crewCount
        ? ` ${plural(recommendedCrews, 'crew')} would cover every shift every day.`
        : ''

    warnings.push({
      code: 'uncovered-shift',
      severity: structural ? 'info' : 'warning',
      message: structural
        ? `One shift sits unstaffed on ${plural(uncovered.length, 'day')} of the cycle. With ${plural(crewCount, 'crew')} this pattern only asks for ${formatAverage(target)} crew per day on it, so no arrangement of starting positions covers it fully.${remedy}`
        : `One shift is unstaffed on ${plural(uncovered.length, 'day')} of the cycle even though there are enough crews to cover it. Suggesting an assignment should close the gap.`,
    })
  })

  const workRun = longestWorkRun(slots)
  if (workRun === Number.POSITIVE_INFINITY) {
    warnings.push({
      code: 'long-work-run',
      severity: 'warning',
      message:
        'The pattern has no rest cards at all, so nobody on it ever gets a day off.',
    })
  } else if (workRun > 7) {
    warnings.push({
      code: 'long-work-run',
      severity: 'warning',
      message: `The pattern runs ${workRun} working days back to back. Most working-time rules cap this at 6 or 7.`,
    })
  }

  warnings.push(...buildWeekdayWarnings(slots, assignments, options))

  return warnings
}

// Grades an assignment that already exists — what the form panel calls on
// every keystroke, so it reflects hand edits, not just the last suggestion.
export function analyzeRotation(
  slots: SuggestionSlot[],
  assignments: CrewAssignment[],
  options: SuggestionOptions = {}
): RotationAnalysis {
  const crews = assignments.map((assignment) => assignment.crew)
  const targets = buildShiftTargets(slots, crews)
  const coverage = buildCoverage(slots, assignments)
  const cost = scoreOffsets(
    slots,
    crews,
    assignments.map((assignment) => assignment.offset),
    targets
  )

  return {
    coverage,
    warnings: buildWarnings(slots, assignments, coverage, targets, options),
    cost,
  }
}

// Picks a starting position for every crew, then grades the result.
// Deterministic: the same slots and crews in the same order always produce the
// same offsets, so re-running never shuffles a roster the user has looked at.
export function suggestRotationAssignment(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[],
  options: SuggestionOptions = {}
): RotationSuggestion {
  const targets = buildShiftTargets(slots, crews)
  const offsets = chooseOffsets(slots, crews, targets)
  const assignments: CrewAssignment[] = crews.map((crew, k) => ({
    crew,
    offset: offsets[k] ?? 0,
  }))

  return { assignments, ...analyzeRotation(slots, assignments, options) }
}
