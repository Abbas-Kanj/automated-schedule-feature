// Works out *who works which shift on which day* of a rotate schedule's
// cycle, and grades the result.
//
// ## The model
//
// A rotate schedule owns one shared `pattern[]` of cycle cards. That pattern
// is a **template describing one crew's journey** — "Morning, Morning, off,
// Afternoon, …" — not a declaration of what runs each day. What must run each
// day is the schedule's own `shift_ids`: **every selected shift is meant to be
// covered on every day of the cycle.**
//
// Two numbers place a crew against that template:
//
//   - `dayOffset` — which card it stands on, so its card on step `d` is
//     `pattern[(d + dayOffset) mod L]`. This is the old offset, unchanged.
//   - `shiftStep` — how far its journey is *transposed* through the shift
//     list, ordered by start time. A crew on a Morning card with
//     `shiftStep` 1 works the next shift along instead.
//
// The second one is what makes full daily coverage reachable at all. Without
// it a 5-2 pattern whose cards all say "Morning" could never staff Night,
// however many crews were added — every crew visits every card, and every
// card said Morning. With it, two crews at `shiftStep` 0 and 1 cover both
// shifts every weekday off the very same pattern.
//
// ## What is stored
//
// Not these placements — the schedule stores the resolved (cycle day × shift)
// → crews matrix (`day_coverage` in `schedules/data/schema.ts`), because the
// form's manual grid edits single cells freely, which no pair of offsets can
// express. So this module has two halves that meet in the middle:
//
//   - `suggestRotationCoverage` searches placements and hands back the
//     journeys they imply, which the caller materialises into cells.
//   - `analyzeDayCoverage` grades the *matrix*, so hand edits are graded
//     honestly rather than being re-derived from offsets that no longer
//     describe them.
//
// Nothing here imports the schema or a store — see `rotation-crews.ts` for
// the bridge to both.

// One card of the cycle. `index` is 0-based (the schema's own `position` is
// 1-based — callers re-index, same as `getRotationPositions` does).
export type SuggestionSlot = {
  index: number
  shiftId?: string
  isOff: boolean
}

// One unit that rotates together. A whole team counts as one crew; an
// individually picked employee is a crew of one.
export type SuggestionCrew = {
  key: string
  kind: 'team' | 'employee'
  label: string
  employeeIds: string[]
}

export type CrewPlacement = {
  crew: SuggestionCrew
  dayOffset: number
  shiftStep: number
}

// A crew as the *matrix* describes it: which shifts it works on each cycle
// day. An array per day rather than a single id because free cell editing can
// put one crew on two shifts the same day — that is a mistake worth naming,
// not something to silently drop.
export type CoverageCrew = {
  key: string
  label: string
  headcount: number
  byDay: Map<number, string[]>
}

export type CoverageDay = {
  index: number
  onDuty: number
  headcount: number
  byShiftId: Record<string, number>
  uncoveredShiftIds: string[]
}

export type SuggestionWarningCode =
  | 'no-crews'
  | 'no-positions'
  | 'coverage-gap'
  | 'uncovered-shift'
  | 'uneven-coverage'
  | 'crew-double-booked'
  | 'long-work-run'
  | 'weekend-imbalance'
  | 'weekday-drift'
  | 'weekday-anchor'

export type SuggestionWarning = {
  code: SuggestionWarningCode
  // The split is deliberately about *fixability*, not severity of outcome:
  //
  //   error   — nothing to work with at all (no pattern, or nobody on it).
  //   warning — a different assignment would genuinely improve this, so
  //             "Suggest assignment" (or an edit) is worth reaching for.
  //   info    — a property of the pattern and crew count that no assignment
  //             can change. An office 5-2 week has nobody in on Saturday by
  //             design; with two crews and three shifts one shift is empty
  //             every day whatever anyone does. Neither is a mistake, so
  //             neither may read as one.
  //
  // Getting this wrong in the obvious direction — treating "not enough crews
  // to fill the grid" as a bad assignment — flags a textbook-correct roster
  // as broken, which is why the rule is crew-days based instead.
  severity: 'error' | 'warning' | 'info'
  message: string
}

export type RotationAnalysis = {
  coverage: CoverageDay[]
  warnings: SuggestionWarning[]
  cost: number
}

export type RotationSuggestion = RotationAnalysis & {
  placements: CrewPlacement[]
}

export type AnalysisOptions = {
  // Only needed for the weekday/weekend checks. Without it those are skipped.
  startDate?: Date
  // JS `getDay()` values. Defaults to Saturday + Sunday.
  weekendDays?: number[]
  // Shift id -> display name, so warnings can say "Night" instead of "One
  // shift". Falls back to a generic phrase when absent.
  shiftLabels?: Map<string, string>
}

const DEFAULT_WEEKEND_DAYS = [0, 6]

// Above this many candidate offset sets the exhaustive search is skipped in
// favour of a seeded local search. Sized so the rosters people actually build
// stay exhaustive: DuPont (28 cards, 4 crews) is 2,925 candidates and a 28-day
// cycle with 6 crews is 80,730.
const EXHAUSTIVE_LIMIT = 100_000

const MAX_LOCAL_ROUNDS = 60

// Only ever breaks exact ties, pulling equally-good answers toward the evenly
// spaced one a human would have picked.
const EVEN_SPACING_TIEBREAK = 1e-4

function floorMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

// The shift a crew works on one card: the card decides *whether* it works,
// the crew's own step decides *what*. An unknown shift id (a since-deleted
// shift still named by the pattern) is passed through rather than rotated,
// so it stays visibly wrong instead of silently becoming a different shift.
function shiftForCard(
  slot: SuggestionSlot,
  shiftStep: number,
  orderedShiftIds: string[]
): string | undefined {
  if (slot.isOff || !slot.shiftId) return undefined
  if (orderedShiftIds.length === 0) return slot.shiftId
  const base = orderedShiftIds.indexOf(slot.shiftId)
  if (base < 0) return slot.shiftId
  return orderedShiftIds[floorMod(base + shiftStep, orderedShiftIds.length)]
}

// One crew's whole cycle: the shift it works on each cycle day, `undefined`
// where it is off. The atomic primitive both halves of this module and
// `rotation-crews.ts` build on.
export function placementShifts(
  slots: SuggestionSlot[],
  placement: Pick<CrewPlacement, 'dayOffset' | 'shiftStep'>,
  orderedShiftIds: string[]
): (string | undefined)[] {
  const cycleLength = slots.length
  return Array.from({ length: cycleLength }, (_, day) =>
    shiftForCard(
      slots[floorMod(day + placement.dayOffset, cycleLength)],
      placement.shiftStep,
      orderedShiftIds
    )
  )
}

export function placementsToCoverageCrews(
  slots: SuggestionSlot[],
  placements: CrewPlacement[],
  orderedShiftIds: string[]
): CoverageCrew[] {
  return placements.map((placement) => {
    const byDay = new Map<number, string[]>()
    placementShifts(slots, placement, orderedShiftIds).forEach(
      (shiftId, day) => {
        if (shiftId) byDay.set(day, [shiftId])
      }
    )
    return {
      key: placement.crew.key,
      label: placement.crew.label,
      // A crew always counts as at least one body, even before its team has
      // been populated — otherwise an empty team reads as free coverage.
      headcount: Math.max(placement.crew.employeeIds.length, 1),
      byDay,
    }
  })
}

export function buildCoverage(
  crews: CoverageCrew[],
  orderedShiftIds: string[],
  cycleLength: number
): CoverageDay[] {
  return Array.from({ length: cycleLength }, (_, day) => {
    const byShiftId: Record<string, number> = {}
    orderedShiftIds.forEach((shiftId) => {
      byShiftId[shiftId] = 0
    })

    let onDuty = 0
    let headcount = 0

    crews.forEach((crew) => {
      const worked = crew.byDay.get(day)
      if (!worked?.length) return
      onDuty += 1
      headcount += crew.headcount
      worked.forEach((shiftId) => {
        byShiftId[shiftId] = (byShiftId[shiftId] ?? 0) + 1
      })
    })

    return {
      index: day,
      onDuty,
      headcount,
      byShiftId,
      uncoveredShiftIds: orderedShiftIds.filter((id) => !byShiftId[id]),
    }
  })
}

// --- scoring ---------------------------------------------------------------

// An unstaffed shift is categorically worse than a lumpy roster, so it is
// priced above everything else the score can add up to rather than left to
// compete on equal terms. Without this the search happily traded a whole
// shift away for a flatter head count.
//
// Holes nobody can fill stay harmless. When there are simply not enough
// crew-days to fill every cell, *every* candidate pays the same minimum
// number of these, and a constant added to every candidate cannot change
// which one is smallest — while a candidate that leaves more cells empty than
// it had to still pays more. It only bites when a hole was avoidable, which
// is exactly when it should.
//
// The size is a bound, not a magic number: the largest total the rest of the
// score can reach. Every squared term has both sides in [0, crewCount].
function uncoveredCellPenalty(
  cycleLength: number,
  crewCount: number,
  shiftCount: number
): number {
  const balanceMax = cycleLength * shiftCount * crewCount ** 2
  const onDutyMax = cycleLength * crewCount ** 2
  const spacingMax = EVEN_SPACING_TIEBREAK * crewCount * cycleLength ** 2
  return balanceMax + onDutyMax + spacingMax + 1
}

// Lower is better. Unstaffed (day, shift) cells first, then flat per-cell
// crew counts, then flat crews-on-duty. The evenly spaced tie-break lives in
// `scorePlacements`, since only the search has offsets to space out.
function scoreCoverage(
  coverage: CoverageDay[],
  orderedShiftIds: string[],
  crewCount: number,
  crewDays: number
): number {
  const cycleLength = coverage.length
  const shiftCount = orderedShiftIds.length
  if (cycleLength === 0 || crewCount === 0 || shiftCount === 0) return 0

  const cellPenalty = uncoveredCellPenalty(cycleLength, crewCount, shiftCount)
  const meanPerCell = crewDays / (cycleLength * shiftCount)
  const meanOnDuty = crewDays / cycleLength

  let cost = 0
  coverage.forEach((day) => {
    cost += cellPenalty * day.uncoveredShiftIds.length
    orderedShiftIds.forEach((shiftId) => {
      cost += ((day.byShiftId[shiftId] ?? 0) - meanPerCell) ** 2
    })
    cost += (day.onDuty - meanOnDuty) ** 2
  })

  return cost
}

// The spacing a human would reach for: crews spread as evenly as the cycle
// allows.
function evenSpacedOffsets(cycleLength: number, crewCount: number): number[] {
  return Array.from({ length: crewCount }, (_, k) =>
    Math.floor((k * cycleLength) / crewCount)
  )
}

function spacingTiebreak(dayOffsets: number[], cycleLength: number): number {
  const ideal = evenSpacedOffsets(cycleLength, dayOffsets.length)
  const sorted = [...dayOffsets].sort((a, b) => a - b)
  return sorted.reduce(
    (sum, offset, k) => sum + EVEN_SPACING_TIEBREAK * (offset - ideal[k]) ** 2,
    0
  )
}

function scorePlacements(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[],
  dayOffsets: number[],
  shiftSteps: number[],
  orderedShiftIds: string[]
): number {
  const cycleLength = slots.length
  const crewCount = crews.length
  if (cycleLength === 0 || crewCount === 0) return 0

  const placements: CrewPlacement[] = crews.map((crew, k) => ({
    crew,
    dayOffset: dayOffsets[k],
    shiftStep: shiftSteps[k],
  }))
  const coverageCrews = placementsToCoverageCrews(
    slots,
    placements,
    orderedShiftIds
  )
  const coverage = buildCoverage(coverageCrews, orderedShiftIds, cycleLength)
  const crewDays = coverageCrews.reduce((sum, crew) => sum + crew.byDay.size, 0)

  return (
    scoreCoverage(coverage, orderedShiftIds, crewCount, crewDays) +
    spacingTiebreak(dayOffsets, cycleLength)
  )
}

// --- search ----------------------------------------------------------------

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

type Placement = { dayOffsets: number[]; shiftSteps: number[] }

// Hill-climbing over the actual crew -> (day offset, shift step) assignment.
// Three move types, and each earns its keep: moving a crew's day explores
// different rest staggers, moving its shift step explores which shift it
// fills, and swapping two crews' whole placements only matters once crews
// differ from each other in size.
//
// Duplicate day offsets are deliberately allowed. Two crews on the same rest
// rhythm but different shift steps is the *correct* answer for an office 5-2
// with a morning and a night shift, and forbidding it — as the single-offset
// model had to — would rule that roster out entirely.
function localImprove(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[],
  orderedShiftIds: string[],
  seed: Placement
): Placement {
  const cycleLength = slots.length
  const crewCount = crews.length
  const shiftCount = Math.max(orderedShiftIds.length, 1)

  let best: Placement = {
    dayOffsets: [...seed.dayOffsets],
    shiftSteps: [...seed.shiftSteps],
  }
  let bestCost = scorePlacements(
    slots,
    crews,
    best.dayOffsets,
    best.shiftSteps,
    orderedShiftIds
  )

  const tryTrial = (trial: Placement): boolean => {
    const cost = scorePlacements(
      slots,
      crews,
      trial.dayOffsets,
      trial.shiftSteps,
      orderedShiftIds
    )
    if (cost < bestCost - 1e-9) {
      best = trial
      bestCost = cost
      return true
    }
    return false
  }

  for (let round = 0; round < MAX_LOCAL_ROUNDS; round++) {
    let improved = false

    for (let k = 0; k < crewCount; k++) {
      for (let day = 0; day < cycleLength; day++) {
        if (best.dayOffsets[k] === day) continue
        const dayOffsets = [...best.dayOffsets]
        dayOffsets[k] = day
        if (tryTrial({ dayOffsets, shiftSteps: [...best.shiftSteps] })) {
          improved = true
        }
      }
    }

    for (let k = 0; k < crewCount; k++) {
      for (let step = 0; step < shiftCount; step++) {
        if (best.shiftSteps[k] === step) continue
        const shiftSteps = [...best.shiftSteps]
        shiftSteps[k] = step
        if (tryTrial({ dayOffsets: [...best.dayOffsets], shiftSteps })) {
          improved = true
        }
      }
    }

    for (let a = 0; a < crewCount; a++) {
      for (let b = a + 1; b < crewCount; b++) {
        const sameDay = best.dayOffsets[a] === best.dayOffsets[b]
        const sameStep = best.shiftSteps[a] === best.shiftSteps[b]
        if (sameDay && sameStep) continue
        const dayOffsets = [...best.dayOffsets]
        const shiftSteps = [...best.shiftSteps]
        dayOffsets[a] = best.dayOffsets[b]
        dayOffsets[b] = best.dayOffsets[a]
        shiftSteps[a] = best.shiftSteps[b]
        shiftSteps[b] = best.shiftSteps[a]
        if (tryTrial({ dayOffsets, shiftSteps })) improved = true
      }
    }

    if (!improved) break
  }

  return best
}

// Places crews one at a time, each into the (day, shift-step) that best
// completes what is already down. Coverage rewards exactly this kind of
// stepwise filling, and it is the start that rescues the cases where the
// hand-written seeds are actively misleading — a DuPont pattern already
// spelling out its own day/night alternation wants every shift step at 0, and
// a round-robin start there is worse than useless.
function greedyPlacement(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[],
  orderedShiftIds: string[]
): Placement {
  const cycleLength = slots.length
  const shiftCount = Math.max(orderedShiftIds.length, 1)
  const dayOffsets: number[] = []
  const shiftSteps: number[] = []

  crews.forEach((_, k) => {
    // Crew 0 is pinned by the symmetries below — every choice is equivalent.
    if (k === 0) {
      dayOffsets.push(0)
      shiftSteps.push(0)
      return
    }

    const placed = crews.slice(0, k + 1)
    let bestDay = 0
    let bestStep = 0
    let bestCost = Number.POSITIVE_INFINITY

    for (let day = 0; day < cycleLength; day++) {
      for (let step = 0; step < shiftCount; step++) {
        const cost = scorePlacements(
          slots,
          placed,
          [...dayOffsets, day],
          [...shiftSteps, step],
          orderedShiftIds
        )
        if (cost < bestCost - 1e-9) {
          bestCost = cost
          bestDay = day
          bestStep = step
        }
      }
    }

    dayOffsets.push(bestDay)
    shiftSteps.push(bestStep)
  })

  return { dayOffsets, shiftSteps }
}

function bestDayOffsetsFor(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[],
  orderedShiftIds: string[],
  shiftSteps: number[]
): number[] {
  const cycleLength = slots.length
  const pool = Array.from({ length: cycleLength - 1 }, (_, i) => i + 1)
  let best = evenSpacedOffsets(cycleLength, crews.length)
  let bestCost = Number.POSITIVE_INFINITY

  for (const combo of combinations(pool, crews.length - 1)) {
    const dayOffsets = [0, ...combo]
    const cost = scorePlacements(
      slots,
      crews,
      dayOffsets,
      shiftSteps,
      orderedShiftIds
    )
    if (cost < bestCost - 1e-9) {
      bestCost = cost
      best = dayOffsets
    }
  }

  return best
}

function choosePlacement(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[],
  orderedShiftIds: string[]
): Placement {
  const cycleLength = slots.length
  const crewCount = crews.length
  const shiftCount = Math.max(orderedShiftIds.length, 1)
  if (cycleLength === 0 || crewCount === 0) {
    return { dayOffsets: [], shiftSteps: [] }
  }

  const evenDays = evenSpacedOffsets(cycleLength, crewCount)
  // Two shift-step seeds, and both are needed. All-zero is right whenever the
  // pattern already spells out the shift alternation itself (DDNNOO, DuPont);
  // round-robin is right whenever it names one shift over and over and the
  // crews have to be fanned out across the rest. Seeding only one of them
  // leaves the hill-climb stuck in the other's basin.
  const stepSeeds: number[][] = [Array.from({ length: crewCount }, () => 0)]
  if (shiftCount > 1) {
    stepSeeds.push(Array.from({ length: crewCount }, (_, k) => k % shiftCount))
  }

  const starts: Placement[] = stepSeeds.map((shiftSteps) => ({
    dayOffsets: evenDays,
    shiftSteps,
  }))
  starts.push(greedyPlacement(slots, crews, orderedShiftIds))

  // Two free symmetries, so crew 0 can be pinned to day offset 0 and a whole
  // symmetry class dropped from the search: rotating every day offset by the
  // same amount rotates the coverage array without changing it, and rotating
  // every shift step cyclically permutes which shift is which — every term of
  // the score is a symmetric sum over shifts, so it is invariant under both.
  //
  // The budget is the *total* number of candidates scored, so adding a second
  // shift-step seed halves how long a cycle stays exhaustive rather than
  // doubling the work.
  const candidates = combinationCount(cycleLength - 1, crewCount - 1)
  if (
    crewCount <= cycleLength &&
    candidates * stepSeeds.length <= EXHAUSTIVE_LIMIT
  ) {
    stepSeeds.forEach((shiftSteps) => {
      starts.push({
        dayOffsets: bestDayOffsetsFor(
          slots,
          crews,
          orderedShiftIds,
          shiftSteps
        ),
        shiftSteps,
      })
    })
  }

  // Always polish, from every start: the exhaustive pass only searches day
  // offsets against one fixed set of shift steps, and hands crews to it in
  // pick order, which is not necessarily the best pairing once crews differ.
  let best: Placement | undefined
  let bestCost = Number.POSITIVE_INFINITY
  starts.forEach((start) => {
    const polished = localImprove(slots, crews, orderedShiftIds, start)
    const cost = scorePlacements(
      slots,
      crews,
      polished.dayOffsets,
      polished.shiftSteps,
      orderedShiftIds
    )
    if (cost < bestCost - 1e-9) {
      bestCost = cost
      best = polished
    }
  })

  return best ?? starts[0]
}

// --- warnings --------------------------------------------------------------

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
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

// Longest run of consecutive worked cycle days, measured twice around so a
// run wrapping the end of the cycle is counted whole.
function longestWorkRun(
  byDay: Map<number, string[]>,
  cycleLength: number
): number {
  if (cycleLength === 0) return 0
  if (byDay.size >= cycleLength) return Number.POSITIVE_INFINITY

  let longest = 0
  let run = 0
  for (let i = 0; i < cycleLength * 2; i++) {
    if (!byDay.get(i % cycleLength)?.length) {
      run = 0
      continue
    }
    run += 1
    longest = Math.max(longest, run)
  }
  return Math.min(longest, cycleLength)
}

function buildWeekdayWarnings(
  crews: CoverageCrew[],
  cycleLength: number,
  options: AnalysisOptions
): SuggestionWarning[] {
  const { startDate } = options
  if (!startDate) return []

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
      message: `The cycle starts on a ${WEEKDAY_NAMES[startDay]}, so day 1 always falls on a ${WEEKDAY_NAMES[startDay]}. Start the schedule on a Monday if the pattern is meant to be read Monday-first.`,
    })
  }

  const weekendDays = options.weekendDays ?? DEFAULT_WEEKEND_DAYS
  const weekendLoads = crews.map((crew) => {
    let worked = 0
    for (let day = 0; day < cycleLength; day++) {
      if (!weekendDays.includes((startDay + day) % 7)) continue
      if (crew.byDay.get(day)?.length) worked += 1
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
        message: `Weekend load is uneven — crews work between ${min} and ${max} weekend days per cycle. Suggesting an assignment can usually even this out.`,
      })
    }
  }

  return warnings
}

function buildWarnings(
  crews: CoverageCrew[],
  coverage: CoverageDay[],
  orderedShiftIds: string[],
  cycleLength: number,
  options: AnalysisOptions
): SuggestionWarning[] {
  const warnings: SuggestionWarning[] = []
  const shiftName = (id: string) => options.shiftLabels?.get(id) ?? 'One shift'

  if (cycleLength === 0) {
    return [
      {
        code: 'no-positions',
        severity: 'error',
        message:
          'Build the pattern first — there are no cycle days to assign anyone to.',
      },
    ]
  }

  if (crews.length === 0) {
    return [
      {
        code: 'no-crews',
        severity: 'error',
        message:
          'Nobody is on this rotation yet. Pick teams or employees above, then suggest an assignment.',
      },
    ]
  }

  const crewCount = crews.length
  const shiftCount = orderedShiftIds.length
  const crewDays = crews.reduce((sum, crew) => sum + crew.byDay.size, 0)
  // Below one crew-day per cell the grid cannot be filled by anyone, whatever
  // they are asked to do — that is the pattern and the crew count talking,
  // not a bad assignment, so it must not read as something to go and fix.
  const fillable = crewDays >= cycleLength * shiftCount
  const maxWorkDays = crews.reduce(
    (most, crew) => Math.max(most, crew.byDay.size),
    0
  )
  const recommendedCrews = maxWorkDays
    ? Math.ceil((cycleLength * shiftCount) / maxWorkDays)
    : 0
  const remedy =
    recommendedCrews > crewCount
      ? ` ${plural(recommendedCrews, 'crew')} on this pattern would cover every shift every day.`
      : ''

  const emptyDays = coverage.filter((day) => day.onDuty === 0)
  if (emptyDays.length > 0) {
    const list = emptyDays.map((day) => day.index + 1).join(', ')
    warnings.push({
      code: 'coverage-gap',
      severity: fillable ? 'warning' : 'info',
      message: fillable
        ? `Nobody at all is working on ${plural(emptyDays.length, 'day')} of the cycle (${list}), and there are enough crews to cover them. Suggest an assignment to close the gap.`
        : `Nobody works on ${plural(emptyDays.length, 'day')} of the cycle (${list}). With ${plural(crewCount, 'crew')} that is what this pattern is shaped to do — expected for an office week, worth adding crews if it is meant to run continuously.${remedy}`,
    })
  }

  orderedShiftIds.forEach((shiftId) => {
    const uncovered = coverage.filter((day) =>
      day.uncoveredShiftIds.includes(shiftId)
    )
    if (uncovered.length === 0) return

    const list = uncovered.map((day) => day.index + 1).join(', ')
    warnings.push({
      code: 'uncovered-shift',
      severity: fillable ? 'warning' : 'info',
      message: fillable
        ? `${shiftName(shiftId)} has nobody on it on ${plural(uncovered.length, 'day')} of the cycle (${list}), and there are enough crews to cover it. Suggest an assignment to close the gap.`
        : `${shiftName(shiftId)} has nobody on it on ${plural(uncovered.length, 'day')} of the cycle (${list}). ${plural(crewCount, 'crew')} working ${plural(maxWorkDays, 'day')} each cannot fill ${cycleLength} day(s) × ${plural(shiftCount, 'shift')}, so no arrangement covers it.${remedy}`,
    })
  })

  const onDutyCounts = coverage.map((day) => day.onDuty)
  const minOnDuty = Math.min(...onDutyCounts)
  const maxOnDuty = Math.max(...onDutyCounts)
  if (emptyDays.length === 0 && maxOnDuty - minOnDuty > 1) {
    warnings.push({
      code: 'uneven-coverage',
      severity: 'warning',
      message: `Crews on duty swings between ${minOnDuty} and ${maxOnDuty} across the cycle. Suggesting an assignment will flatten it as far as the pattern allows.`,
    })
  }

  // Only reachable by hand — the search never produces it — but free cell
  // editing makes it one click away, and it is silent everywhere else.
  const doubleBooked = crews.filter((crew) =>
    [...crew.byDay.values()].some((shiftIds) => shiftIds.length > 1)
  )
  if (doubleBooked.length > 0) {
    warnings.push({
      code: 'crew-double-booked',
      severity: 'warning',
      message: `${doubleBooked.map((crew) => crew.label).join(', ')} ${doubleBooked.length === 1 ? 'is' : 'are'} on more than one shift on the same day. Remove one of them.`,
    })
  }

  const longestRun = crews.reduce(
    (most, crew) => Math.max(most, longestWorkRun(crew.byDay, cycleLength)),
    0
  )
  if (longestRun === Number.POSITIVE_INFINITY) {
    warnings.push({
      code: 'long-work-run',
      severity: 'warning',
      message:
        'At least one crew works every day of the cycle, so it never gets a day off.',
    })
  } else if (longestRun > 7) {
    warnings.push({
      code: 'long-work-run',
      severity: 'warning',
      message: `A crew works ${longestRun} days back to back. Most working-time rules cap this at 6 or 7.`,
    })
  }

  warnings.push(...buildWeekdayWarnings(crews, cycleLength, options))

  return warnings
}

// --- entry points ----------------------------------------------------------

// Grades the stored matrix — what the form panel calls on every keystroke, so
// it reflects hand edits rather than the last suggestion.
export function analyzeDayCoverage(
  crews: CoverageCrew[],
  orderedShiftIds: string[],
  cycleLength: number,
  options: AnalysisOptions = {}
): RotationAnalysis {
  const coverage = buildCoverage(crews, orderedShiftIds, cycleLength)
  const crewDays = crews.reduce((sum, crew) => sum + crew.byDay.size, 0)

  return {
    coverage,
    warnings: buildWarnings(
      crews,
      coverage,
      orderedShiftIds,
      cycleLength,
      options
    ),
    cost: scoreCoverage(coverage, orderedShiftIds, crews.length, crewDays),
  }
}

// Places every crew against the pattern so that as many (day, shift) cells as
// possible are staffed, then grades the result. Deterministic: the same
// slots, crews and shift order always produce the same placements, so
// re-running never shuffles a roster the user has looked at.
export function suggestRotationCoverage(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[],
  orderedShiftIds: string[],
  options: AnalysisOptions = {}
): RotationSuggestion {
  const { dayOffsets, shiftSteps } = choosePlacement(
    slots,
    crews,
    orderedShiftIds
  )
  const placements: CrewPlacement[] = crews.map((crew, k) => ({
    crew,
    dayOffset: dayOffsets[k] ?? 0,
    shiftStep: shiftSteps[k] ?? 0,
  }))

  return {
    placements,
    ...analyzeDayCoverage(
      placementsToCoverageCrews(slots, placements, orderedShiftIds),
      orderedShiftIds,
      slots.length,
      options
    ),
  }
}
