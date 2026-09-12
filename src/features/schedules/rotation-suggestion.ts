// Works out who works which shift on which day of a rotate schedule's cycle,
// and grades the result.
//
// The pattern is a *template* — one crew's journey through the cycle — and
// `shift_ids` is what must actually run: every selected shift, every day. Two
// numbers place a crew against the template: `dayOffset` (which card it stands
// on) and `shiftStep` (how far its journey is transposed through the shift
// list, ordered by start time).
//
// What the schedule stores is the resolved (cycle day x shift) -> crews matrix,
// not these placements, so the two halves here meet in the middle:
// `suggestRotationCoverage` searches placements, `analyzeDayCoverage` grades a
// matrix. Nothing here imports the schema or a store — see `rotation-crews.ts`.
//
// See `docs/ROTATION_ALGORITHM.md` for the model, the scoring rules and the
// cases that shaped them.
import { plural } from '@/lib/plural'

// One card of the cycle. `index` is 0-based; the schema's `position` is 1-based.
export type SuggestionSlot = {
  index: number
  shiftId?: string
  isOff: boolean
}

// One unit that rotates together: a whole team, or a single employee.
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

// A crew as the *matrix* describes it. An array per day rather than one id
// because free cell editing can put a crew on two shifts the same day — worth
// naming as a mistake, not silently dropping.
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
  | 'quick-turnaround'
  | 'weekend-imbalance'
  | 'weekday-drift'
  | 'weekday-anchor'

export type SuggestionWarning = {
  code: SuggestionWarningCode
  // Severity is about *fixability*, never about how bad the outcome looks:
  // `error` = nothing to work with, `warning` = a different assignment would
  // genuinely help, `info` = a property of the pattern and crew count that no
  // assignment can change. Treating "not enough crews to fill the grid" as a
  // bad assignment flags textbook-correct rosters as broken.
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
  // Only needed for the weekday/weekend checks; without it they are skipped.
  startDate?: Date
  // JS `getDay()` values. Defaults to Saturday + Sunday.
  weekendDays?: number[]
  // Shift id -> display name, so warnings can name the shift.
  shiftLabels?: Map<string, string>
  // What `crewRequirement` says this pattern needs, which decides whether a
  // hole reads as fixable or structural. Only callers holding the pattern can
  // work it out; without it this falls back to a looser crew-day count.
  minimumCrews?: number
  // Clock hours per shift, so rest between consecutive shifts can be measured
  // rather than guessed. Without it the quick-turnaround check is skipped —
  // list position is not enough, since Night -> Morning steps one place
  // *forward* through a list ordered by start time.
  shiftHours?: Map<string, ShiftHours>
  // Hours between clocking off and back on, below which a transition is
  // flagged. Defaults to the EU Working Time Directive's 11.
  minRestHours?: number
}

// A shift's span in minutes from midnight on the day it starts. `endMinutes`
// runs past 1440 for an overnight shift, so subtracting it from the next day's
// start gives real rest hours with no special case at the call site.
export type ShiftHours = {
  startMinutes: number
  endMinutes: number
}

const DEFAULT_WEEKEND_DAYS = [0, 6]

const DEFAULT_MIN_REST_HOURS = 11

// Above this many candidates the exhaustive pass is skipped for a seeded local
// search. Sized so real rosters stay exhaustive: DuPont (28 cards, 4 crews) is
// 2,925 candidates; a 28-day cycle with 6 crews is 80,730.
const EXHAUSTIVE_LIMIT = 100_000

const MAX_LOCAL_ROUNDS = 60

// Breaks exact ties only, pulling equally-good answers toward the evenly spaced
// one a human would have picked.
const EVEN_SPACING_TIEBREAK = 1e-4

// An order of magnitude above the spacing tie-break and far below anything the
// coverage score can reach: rest decides between rosters that are otherwise
// equally covered, and never buys a flatter rota at the cost of an unstaffed
// shift. Only ever added when the caller supplied `shiftHours`.
const QUICK_TURNAROUND_TIEBREAK = 1e-3

// What the search needs beyond the pattern. Optional throughout: with no
// context every candidate scores as it would without rest measurement.
type PlacementContext = {
  shiftHours?: Map<string, ShiftHours>
  minRestMinutes: number
}

function floorMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

// The shift a crew works on one card: the card decides *whether* it works, the
// crew's own step decides *what*. An unknown shift id (a since-deleted shift
// still named by the pattern) is passed through unrotated, so it stays visibly
// wrong instead of silently becoming a different shift.
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

// One crew's whole cycle: the shift it works each day, `undefined` where it is
// off. The primitive both halves of this module build on.
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

// --- crew requirement -------------------------------------------------------

// How many crews it takes to staff every selected shift on every cycle day,
// shown *before* the search runs so it can size the pool up front.
//
// Deliberately not crew-days over cells, and not the step-distribution bound
// either: neither can see day alignment. The answer is found by placing — start
// at the counting bound and run the real search for one more crew at a time —
// so the number means "the smallest pool Suggest can fully cover with".
export type CrewRequirement = {
  // Cycle cards one crew actually works. Explains the number to the user.
  workDaysPerCrew: number
  cellsPerCycle: number
  // What it would take if any crew could fill any gap. `minimumCrews` is often
  // larger, and the gap between them is the story the UI note has to tell:
  // below it the limit is arithmetic, above it the limit is the pattern's
  // shape, which is fixable by editing the pattern rather than by hiring.
  crewDayBound: number
  minimumCrews: number
  // Did a probe actually reach full coverage? False means the budget ran out,
  // so this is a lower bound and callers must not promise coverage at it.
  exact: boolean
}

// Does this many crews per step cover every shift for the whole cycle?
function stepGroupsCover(
  perStep: number[],
  cardsByShift: number[],
  cycleLength: number
): boolean {
  const n = cardsByShift.length
  for (let shift = 0; shift < n; shift++) {
    let covered = 0
    for (let step = 0; step < n; step++) {
      covered += perStep[step] * cardsByShift[floorMod(shift - step, n)]
    }
    if (covered < cycleLength) return false
  }
  return true
}

// Is there any split of `total` crews across the steps that covers everything?
// `n` is the selected shift count, so this stays in the tens of combinations.
function someSplitCovers(
  total: number,
  cardsByShift: number[],
  cycleLength: number
): boolean {
  const n = cardsByShift.length
  const perStep = new Array<number>(n).fill(0)

  const walk = (step: number, left: number): boolean => {
    if (step === n - 1) {
      perStep[step] = left
      return stepGroupsCover(perStep, cardsByShift, cycleLength)
    }
    for (let take = left; take >= 0; take--) {
      perStep[step] = take
      if (walk(step + 1, left - take)) return true
    }
    return false
  }

  return walk(0, total)
}

// Above this many selected shifts the composition search is skipped for the
// plain division. Nobody rotates through nine shifts, and a loose starting
// point only costs an extra probe.
const REQUIREMENT_EXACT_SHIFT_LIMIT = 8

// How many crew counts to place before giving up. The starting point is a real
// lower bound and the answer is normally it or one above, so this is slack
// rather than search width — each probe is a full search.
const REQUIREMENT_PROBE_LIMIT = 4

// Interchangeable stand-ins: the search only cares how many crews there are, so
// the pool does not have to be picked before this can answer.
function probeCrews(count: number): SuggestionCrew[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `probe:${index}`,
    kind: 'team' as const,
    label: `Crew ${index + 1}`,
    employeeIds: [],
  }))
}

function fullyCovered(coverage: CoverageDay[]): boolean {
  return coverage.every((day) => day.uncoveredShiftIds.length === 0)
}

// How many cards name each selected shift. Cards naming an unselected shift
// cover nothing — `shiftForCard` passes an unknown id through unrotated — so
// they are left out.
function cardsByShiftCount(
  slots: SuggestionSlot[],
  orderedShiftIds: string[]
): number[] {
  const shiftIndex = new Map(orderedShiftIds.map((id, index) => [id, index]))
  const counts = new Array<number>(orderedShiftIds.length).fill(0)
  slots.forEach((slot) => {
    if (slot.isOff || !slot.shiftId) return
    const index = shiftIndex.get(slot.shiftId)
    if (index !== undefined) counts[index] += 1
  })
  return counts
}

// Cells divided by the days one crew works — a true lower bound, and the number
// a person arrives at on their own.
export function crewDayLowerBound(
  slots: SuggestionSlot[],
  orderedShiftIds: string[]
): number {
  const cycleLength = slots.length
  const shiftCount = orderedShiftIds.length
  const coverableDays = cardsByShiftCount(slots, orderedShiftIds).reduce(
    (sum, count) => sum + count,
    0
  )
  if (cycleLength === 0 || shiftCount === 0 || coverableDays === 0) return 0
  return Math.ceil((cycleLength * shiftCount) / coverableDays)
}

// The counting-only lower bound the probe starts from, and falls back to.
function coverageLowerBound(
  slots: SuggestionSlot[],
  orderedShiftIds: string[]
): number {
  const cycleLength = slots.length
  const shiftCount = orderedShiftIds.length
  const cardsByShift = cardsByShiftCount(slots, orderedShiftIds)
  const coverableDays = cardsByShift.reduce((sum, count) => sum + count, 0)
  if (cycleLength === 0 || shiftCount === 0 || coverableDays === 0) return 0

  const crewDayBound = crewDayLowerBound(slots, orderedShiftIds)
  if (shiftCount > REQUIREMENT_EXACT_SHIFT_LIMIT) return crewDayBound

  // Giving every shift its own group of crews always satisfies the counting
  // constraints, so the scan is guaranteed to stop at or before this.
  const ceiling =
    Math.ceil(cycleLength / Math.max(...cardsByShift)) * shiftCount

  for (let total = crewDayBound; total < ceiling; total++) {
    if (someSplitCovers(total, cardsByShift, cycleLength)) return total
  }
  return ceiling
}

export function crewRequirement(
  slots: SuggestionSlot[],
  orderedShiftIds: string[]
): CrewRequirement {
  const workDaysPerCrew = slots.filter(
    (slot) => !slot.isOff && slot.shiftId
  ).length
  const cellsPerCycle = slots.length * orderedShiftIds.length
  const crewDayBound = crewDayLowerBound(slots, orderedShiftIds)
  const lowerBound = coverageLowerBound(slots, orderedShiftIds)
  const base = { workDaysPerCrew, cellsPerCycle, crewDayBound }

  // An all-off pattern, no selected shifts, or a pattern naming none of them:
  // nothing is coverable, so no crew count is enough. Reported as 0 rather than
  // infinity, and the UI drops the note.
  if (lowerBound === 0) return { ...base, minimumCrews: 0, exact: false }

  for (
    let count = lowerBound;
    count < lowerBound + REQUIREMENT_PROBE_LIMIT;
    count++
  ) {
    const { coverage } = suggestRotationCoverage(
      slots,
      probeCrews(count),
      orderedShiftIds
    )
    if (fullyCovered(coverage)) {
      return { ...base, minimumCrews: count, exact: true }
    }
  }

  return { ...base, minimumCrews: lowerBound, exact: false }
}

// --- matrix construction ----------------------------------------------------

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
      // A crew counts as at least one body even before its team is populated,
      // so an empty team does not read as free coverage.
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

// --- rest between shifts ----------------------------------------------------

// One crew stepping from a shift into another with too little rest between.
export type QuickTurnaround = {
  crewKey: string
  crewLabel: string
  // 0-based cycle day of the *first* of the two shifts.
  day: number
  fromShiftId: string
  toShiftId: string
  restMinutes: number
}

// Every consecutive pair of worked days where the crew does not get
// `minRestMinutes` off between clocking out and clocking back in.
//
// Measured in hours, not list positions: Night -> Morning looks like a step
// *forward* through a list ordered by start time while being the textbook quick
// turnaround, so only the clock can tell them apart.
//
// Wraps the end of the cycle, since the cycle repeats. Where a hand edit has
// put a crew on two shifts the same day the tightest reading is used — latest
// finish into earliest start — so a double booking cannot hide a turnaround.
export function findQuickTurnarounds(
  crews: CoverageCrew[],
  cycleLength: number,
  shiftHours: Map<string, ShiftHours>,
  minRestMinutes: number
): QuickTurnaround[] {
  if (cycleLength === 0) return []
  const found: QuickTurnaround[] = []

  const pick = (
    shiftIds: string[],
    better: (candidate: ShiftHours, best: ShiftHours) => boolean
  ): { id: string; hours: ShiftHours } | undefined => {
    let best: { id: string; hours: ShiftHours } | undefined
    for (const id of shiftIds) {
      const hours = shiftHours.get(id)
      if (!hours) continue
      if (!best || better(hours, best.hours)) best = { id, hours }
    }
    return best
  }

  crews.forEach((crew) => {
    for (let day = 0; day < cycleLength; day++) {
      const worked = crew.byDay.get(day)
      const next = crew.byDay.get((day + 1) % cycleLength)
      if (!worked?.length || !next?.length) continue

      const from = pick(worked, (a, b) => a.endMinutes > b.endMinutes)
      const to = pick(next, (a, b) => a.startMinutes < b.startMinutes)
      if (!from || !to) continue

      // The next day's clock starts a full day after this one's.
      const restMinutes = 1440 + to.hours.startMinutes - from.hours.endMinutes
      if (restMinutes >= minRestMinutes) continue

      found.push({
        crewKey: crew.key,
        crewLabel: crew.label,
        day,
        fromShiftId: from.id,
        toShiftId: to.id,
        restMinutes,
      })
    }
  })

  return found
}

// --- scoring ----------------------------------------------------------------

// An unstaffed shift is categorically worse than a lumpy roster, so it is
// priced above everything else the score can reach rather than left to compete.
// Holes nobody can fill stay harmless: when there are not enough crew-days,
// every candidate pays the same number of these, and a constant added to every
// candidate cannot change which is smallest.
//
// The size is a bound, not a magic number — the largest total the rest of the
// score can reach, every squared term having both sides in [0, crewCount].
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

// Lower is better. Unstaffed cells first, then flat per-cell crew counts, then
// flat crews-on-duty. The spacing tie-break lives in the search, which is the
// only half holding offsets to space out.
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

function spacingTiebreak(
  dayOffsets: number[],
  crewCount: number,
  cycleLength: number
): number {
  const ideal = evenSpacedOffsets(cycleLength, crewCount)
  const sorted = dayOffsets.slice(0, crewCount).sort((a, b) => a - b)
  let cost = 0
  for (let k = 0; k < crewCount; k++) {
    cost += EVEN_SPACING_TIEBREAK * (sorted[k] - ideal[k]) ** 2
  }
  return cost
}

// --- the search's scorer ----------------------------------------------------

// Off, and on duty but working a shift the schedule did not select — the two
// cases that are not an index into `orderedShiftIds`. An unselected shift still
// occupies the crew (it counts toward on-duty and crew-days) while covering no
// cell, which is what `shiftForCard` passing it through unrotated means.
const JOURNEY_OFF = -1
const JOURNEY_UNSELECTED = -2

// Scores one crew -> (day offset, shift step) assignment. Lower is better. Only
// the first `crewCount` entries of each array are read, so a partial assignment
// can be scored without copying it.
type PlacementScorer = (
  crewCount: number,
  dayOffsets: number[],
  shiftSteps: number[]
) => number

// The search scores the same handful of journeys tens of thousands of times, so
// every journey the pattern admits is resolved once up front: the shift worked
// on each cycle day, how many days that is, and how many quick turnarounds it
// contains (a per-crew property, so it never depends on who else is placed).
// Scoring a candidate is then a walk over `crewCount` rows of a typed array
// rather than rebuilding a matrix of maps.
function createScorer(
  slots: SuggestionSlot[],
  orderedShiftIds: string[],
  context?: PlacementContext
): PlacementScorer {
  const cycleLength = slots.length
  const shiftCount = orderedShiftIds.length
  const stepCount = Math.max(shiftCount, 1)
  const shiftIndex = new Map(orderedShiftIds.map((id, index) => [id, index]))

  const journeys: Int16Array[] = []
  const workDays: number[] = []
  const turnarounds: number[] = []

  for (let offset = 0; offset < cycleLength; offset++) {
    for (let step = 0; step < stepCount; step++) {
      const shiftIds = placementShifts(
        slots,
        { dayOffset: offset, shiftStep: step },
        orderedShiftIds
      )
      const row = new Int16Array(cycleLength)
      const byDay = new Map<number, string[]>()
      let worked = 0

      shiftIds.forEach((shiftId, day) => {
        if (!shiftId) {
          row[day] = JOURNEY_OFF
          return
        }
        worked += 1
        byDay.set(day, [shiftId])
        row[day] = shiftIndex.get(shiftId) ?? JOURNEY_UNSELECTED
      })

      journeys.push(row)
      workDays.push(worked)
      turnarounds.push(
        context?.shiftHours
          ? findQuickTurnarounds(
              [{ key: '', label: '', headcount: 1, byDay }],
              cycleLength,
              context.shiftHours,
              context.minRestMinutes
            ).length
          : 0
      )
    }
  }

  // Reused across candidates — the scorer is driven by a single-threaded hill
  // climb and is never re-entered.
  const cellCounts = new Int32Array(cycleLength * shiftCount)
  const onDuty = new Int32Array(cycleLength)

  return (crewCount, dayOffsets, shiftSteps) => {
    if (cycleLength === 0 || crewCount === 0) return 0

    cellCounts.fill(0)
    onDuty.fill(0)
    let crewDays = 0
    let turnaroundCount = 0

    for (let k = 0; k < crewCount; k++) {
      const journey =
        floorMod(dayOffsets[k], cycleLength) * stepCount +
        floorMod(shiftSteps[k], stepCount)
      const row = journeys[journey]
      crewDays += workDays[journey]
      turnaroundCount += turnarounds[journey]

      for (let day = 0; day < cycleLength; day++) {
        const shift = row[day]
        if (shift === JOURNEY_OFF) continue
        onDuty[day] += 1
        if (shift >= 0) cellCounts[day * shiftCount + shift] += 1
      }
    }

    let cost = 0
    if (shiftCount > 0) {
      const cellPenalty = uncoveredCellPenalty(
        cycleLength,
        crewCount,
        shiftCount
      )
      const meanPerCell = crewDays / (cycleLength * shiftCount)
      const meanOnDuty = crewDays / cycleLength

      for (let day = 0; day < cycleLength; day++) {
        for (let shift = 0; shift < shiftCount; shift++) {
          const count = cellCounts[day * shiftCount + shift]
          if (count === 0) cost += cellPenalty
          cost += (count - meanPerCell) ** 2
        }
        cost += (onDuty[day] - meanOnDuty) ** 2
      }
    }

    return (
      cost +
      spacingTiebreak(dayOffsets, crewCount, cycleLength) +
      QUICK_TURNAROUND_TIEBREAK * turnaroundCount
    )
  }
}

// --- search -----------------------------------------------------------------

function combinationCount(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1)
    if (result > EXHAUSTIVE_LIMIT) return Number.POSITIVE_INFINITY
  }
  return Math.round(result)
}

type Placement = { dayOffsets: number[]; shiftSteps: number[] }

// Hill-climbing over the crew -> (day offset, shift step) assignment. Each move
// type earns its keep: moving a crew's day explores rest staggers, moving its
// shift step explores which shift it fills, and swapping two crews' placements
// only matters once crews differ in size.
//
// Duplicate day offsets are deliberately allowed — two crews on the same rest
// rhythm working different shifts is the correct answer for an office 5-2 with
// a morning and a night shift.
function localImprove(
  crewCount: number,
  cycleLength: number,
  shiftCount: number,
  seed: Placement,
  score: PlacementScorer
): Placement {
  const dayOffsets = [...seed.dayOffsets]
  const shiftSteps = [...seed.shiftSteps]
  let bestCost = score(crewCount, dayOffsets, shiftSteps)

  // Trials mutate in place and roll back on a miss: a full climb scores
  // hundreds of thousands of candidates, and cloning two arrays per trial
  // dominated everything else.
  const keeps = (slot: number[], index: number, previous: number): boolean => {
    const cost = score(crewCount, dayOffsets, shiftSteps)
    if (cost < bestCost - 1e-9) {
      bestCost = cost
      return true
    }
    slot[index] = previous
    return false
  }

  for (let round = 0; round < MAX_LOCAL_ROUNDS; round++) {
    let improved = false

    for (let k = 0; k < crewCount; k++) {
      for (let day = 0; day < cycleLength; day++) {
        const previous = dayOffsets[k]
        if (previous === day) continue
        dayOffsets[k] = day
        if (keeps(dayOffsets, k, previous)) improved = true
      }
    }

    for (let k = 0; k < crewCount; k++) {
      for (let step = 0; step < shiftCount; step++) {
        const previous = shiftSteps[k]
        if (previous === step) continue
        shiftSteps[k] = step
        if (keeps(shiftSteps, k, previous)) improved = true
      }
    }

    for (let a = 0; a < crewCount; a++) {
      for (let b = a + 1; b < crewCount; b++) {
        if (
          dayOffsets[a] === dayOffsets[b] &&
          shiftSteps[a] === shiftSteps[b]
        ) {
          continue
        }
        const day = dayOffsets[a]
        const step = shiftSteps[a]
        dayOffsets[a] = dayOffsets[b]
        shiftSteps[a] = shiftSteps[b]
        dayOffsets[b] = day
        shiftSteps[b] = step

        const cost = score(crewCount, dayOffsets, shiftSteps)
        if (cost < bestCost - 1e-9) {
          bestCost = cost
          improved = true
        } else {
          dayOffsets[b] = dayOffsets[a]
          shiftSteps[b] = shiftSteps[a]
          dayOffsets[a] = day
          shiftSteps[a] = step
        }
      }
    }

    if (!improved) break
  }

  return { dayOffsets, shiftSteps }
}

// Places crews one at a time, each into the (day, shift step) that best
// completes what is already down. This is the start that rescues the cases
// where the hand-written seeds mislead — a DuPont pattern already spelling out
// its own day/night alternation wants every shift step at 0.
function greedyPlacement(
  crewCount: number,
  cycleLength: number,
  shiftCount: number,
  score: PlacementScorer
): Placement {
  const dayOffsets = new Array<number>(crewCount).fill(0)
  const shiftSteps = new Array<number>(crewCount).fill(0)

  // Crew 0 is pinned by the symmetries below — every choice is equivalent.
  for (let k = 1; k < crewCount; k++) {
    let bestDay = 0
    let bestStep = 0
    let bestCost = Number.POSITIVE_INFINITY

    for (let day = 0; day < cycleLength; day++) {
      for (let step = 0; step < shiftCount; step++) {
        dayOffsets[k] = day
        shiftSteps[k] = step
        const cost = score(k + 1, dayOffsets, shiftSteps)
        if (cost < bestCost - 1e-9) {
          bestCost = cost
          bestDay = day
          bestStep = step
        }
      }
    }

    dayOffsets[k] = bestDay
    shiftSteps[k] = bestStep
  }

  return { dayOffsets, shiftSteps }
}

// Exhaustive over day offsets against one fixed set of shift steps, crew 0
// pinned to offset 0. Walks the combinations in place rather than materialising
// each one — this body runs up to `EXHAUSTIVE_LIMIT` times.
function bestDayOffsetsFor(
  crewCount: number,
  cycleLength: number,
  shiftSteps: number[],
  score: PlacementScorer
): number[] {
  const dayOffsets = evenSpacedOffsets(cycleLength, crewCount)
  let best = [...dayOffsets]

  const pick = crewCount - 1
  const poolSize = cycleLength - 1
  if (pick > poolSize) return best

  // `indices` walks the combinations of the days 1..cycleLength-1.
  const indices = Array.from({ length: pick }, (_, i) => i)
  let bestCost = Number.POSITIVE_INFINITY
  dayOffsets[0] = 0

  for (;;) {
    for (let i = 0; i < pick; i++) dayOffsets[i + 1] = indices[i] + 1
    const cost = score(crewCount, dayOffsets, shiftSteps)
    if (cost < bestCost - 1e-9) {
      bestCost = cost
      best = [...dayOffsets]
    }

    let i = pick - 1
    while (i >= 0 && indices[i] === poolSize - pick + i) i--
    if (i < 0) return best
    indices[i] += 1
    for (let j = i + 1; j < pick; j++) indices[j] = indices[j - 1] + 1
  }
}

function choosePlacement(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[],
  orderedShiftIds: string[],
  context?: PlacementContext
): Placement {
  const cycleLength = slots.length
  const crewCount = crews.length
  const shiftCount = Math.max(orderedShiftIds.length, 1)
  if (cycleLength === 0 || crewCount === 0) {
    return { dayOffsets: [], shiftSteps: [] }
  }

  const score = createScorer(slots, orderedShiftIds, context)
  const evenDays = evenSpacedOffsets(cycleLength, crewCount)

  // Both shift-step seeds are needed. All-zero is right whenever the pattern
  // already spells out the shift alternation itself (DDNNOO, DuPont);
  // round-robin is right whenever it names one shift over and over and the
  // crews have to be fanned out across the rest. Seeding only one leaves the
  // climb stuck in the other's basin.
  const stepSeeds: number[][] = [new Array<number>(crewCount).fill(0)]
  if (shiftCount > 1) {
    stepSeeds.push(Array.from({ length: crewCount }, (_, k) => k % shiftCount))
  }

  const starts: Placement[] = stepSeeds.map((shiftSteps) => ({
    dayOffsets: evenDays,
    shiftSteps,
  }))
  starts.push(greedyPlacement(crewCount, cycleLength, shiftCount, score))

  // Two free symmetries let crew 0 be pinned to day offset 0 and a whole
  // symmetry class be dropped: rotating every day offset by the same amount
  // rotates the coverage array without changing it, and rotating every shift
  // step cyclically permutes which shift is which — every term of the score is
  // a symmetric sum over shifts, so it is invariant under both.
  //
  // The budget is the *total* number of candidates scored, so a second
  // shift-step seed halves how long a cycle stays exhaustive.
  const candidates = combinationCount(cycleLength - 1, crewCount - 1)
  if (
    crewCount <= cycleLength &&
    candidates * stepSeeds.length <= EXHAUSTIVE_LIMIT
  ) {
    stepSeeds.forEach((shiftSteps) => {
      starts.push({
        dayOffsets: bestDayOffsetsFor(
          crewCount,
          cycleLength,
          shiftSteps,
          score
        ),
        shiftSteps,
      })
    })
  }

  // Always polish, from every start: the exhaustive pass only searches day
  // offsets against one fixed set of shift steps, and hands crews to it in pick
  // order, which is not the best pairing once crews differ.
  let best: Placement | undefined
  let bestCost = Number.POSITIVE_INFINITY
  starts.forEach((start) => {
    const polished = localImprove(
      crewCount,
      cycleLength,
      shiftCount,
      start,
      score
    )
    const cost = score(crewCount, polished.dayOffsets, polished.shiftSteps)
    if (cost < bestCost - 1e-9) {
      bestCost = cost
      best = polished
    }
  })

  return best ?? starts[0]
}

// --- warnings ---------------------------------------------------------------

// Rest is reported in hours because that is the unit working-time rules are
// written in. Half hours survive; anything finer is false precision.
function formatHours(minutes: number): string {
  const rounded = Math.round((minutes / 60) * 2) / 2
  const value = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)
  return `${value} hour${rounded === 1 ? '' : 's'}`
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

// Longest run of consecutive worked days, measured twice around so a run
// wrapping the end of the cycle is counted whole.
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

  if (cycleLength % 7 !== 0) {
    return [
      {
        code: 'weekday-drift',
        severity: 'info',
        message: `A ${cycleLength}-day cycle is not a whole number of weeks, so each crew's working weekdays shift every time it repeats. That is normal for continuous operations — if the pattern is meant to read the same every week, use a cycle length that is a multiple of 7.`,
      },
    ]
  }

  const warnings: SuggestionWarning[] = []
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

  const warnings: SuggestionWarning[] = []
  const shiftName = (id: string) => options.shiftLabels?.get(id) ?? 'One shift'
  const crewCount = crews.length
  const shiftCount = orderedShiftIds.length
  const crewDays = crews.reduce((sum, crew) => sum + crew.byDay.size, 0)
  const maxWorkDays = crews.reduce(
    (most, crew) => Math.max(most, crew.byDay.size),
    0
  )

  // What it would actually take. `crewRequirement` places crews to find out;
  // the crew-day fallback only counts them, which understates.
  const recommendedCrews =
    options.minimumCrews ??
    (maxWorkDays ? Math.ceil((cycleLength * shiftCount) / maxWorkDays) : 0)
  // Would a different assignment of *these* crews close the hole? Below the
  // requirement nothing can, so it is the pattern and the crew count talking
  // and must not read as something to go and fix — getting this wrong tells
  // someone who has just pressed Suggest to press it again.
  const fillable =
    options.minimumCrews != null
      ? crewCount >= options.minimumCrews
      : crewDays >= cycleLength * shiftCount
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
        : `${shiftName(shiftId)} has nobody on it on ${plural(uncovered.length, 'day')} of the cycle (${list}). With ${plural(crewCount, 'crew')} on this pattern no arrangement covers every shift every day, so this is the pattern's shape rather than a bad assignment.${remedy}`,
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

  if (options.shiftHours) {
    const minRestHours = options.minRestHours ?? DEFAULT_MIN_REST_HOURS
    const turnarounds = findQuickTurnarounds(
      crews,
      cycleLength,
      options.shiftHours,
      minRestHours * 60
    )

    if (turnarounds.length > 0) {
      // One line, not one per occurrence: a rotation that breaks the rule
      // usually breaks it the same way for every crew, and a list of
      // near-identical paragraphs is how this panel stopped being read before.
      const worst = turnarounds.reduce((tightest, entry) =>
        entry.restMinutes < tightest.restMinutes ? entry : tightest
      )
      const others = turnarounds.length - 1
      warnings.push({
        code: 'quick-turnaround',
        severity: 'warning',
        message: `${worst.crewLabel} finishes ${shiftName(worst.fromShiftId)} on day ${worst.day + 1} and starts ${shiftName(worst.toShiftId)} on day ${((worst.day + 1) % cycleLength) + 1} with only ${formatHours(worst.restMinutes)} off in between — most working-time rules require ${minRestHours}.${others > 0 ? ` ${plural(others, 'other turnaround')} in this cycle ${others === 1 ? 'is' : 'are'} under the same limit.` : ''} Rotating forward through the day — mornings, then afternoons, then nights — avoids this.`,
      })
    }
  }

  warnings.push(...buildWeekdayWarnings(crews, cycleLength, options))

  return warnings
}

// --- entry points -----------------------------------------------------------

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
// possible are staffed, then grades the result. Deterministic: the same slots,
// crews and shift order always produce the same placements, so re-running never
// shuffles a roster the user has looked at.
export function suggestRotationCoverage(
  slots: SuggestionSlot[],
  crews: SuggestionCrew[],
  orderedShiftIds: string[],
  options: AnalysisOptions = {}
): RotationSuggestion {
  const { dayOffsets, shiftSteps } = choosePlacement(
    slots,
    crews,
    orderedShiftIds,
    // Only built when the caller can actually measure rest. `crewRequirement`
    // probes through here and deliberately passes nothing — what a pattern
    // *needs* is a fact about coverage, not about comfort.
    options.shiftHours
      ? {
          shiftHours: options.shiftHours,
          minRestMinutes: (options.minRestHours ?? DEFAULT_MIN_REST_HOURS) * 60,
        }
      : undefined
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
