import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { defaultSchedules } from '@/features/schedules/data/schedules'
import { type Schedule } from '@/features/schedules/data/schema'
import { type RotateSchedule, isRotateSchedule } from '../utils'
import { AssignCrewsDialog, AssignToPanel } from './assign-crews-dialog'

// Covers the seam between "Save" and the assignment UI it wraps, now that
// crew assignment lives here instead of on the wizard's "Next" button — see
// the equivalent seam that used to live in `schedule-form.test.tsx`. The
// assignment UI itself (`ScheduleAssignToFields`) is unchanged and stays
// covered by `schedule-assign-to-fields.test.tsx`; what's new here is that
// Save reads its final state and hands it to `updateSchedule` correctly.

const seed = defaultSchedules.find((s) => s.id === 'sched-rotation')!
if (!isRotateSchedule(seed)) throw new Error('Seed is not a rotate schedule')
const rotation = seed

const updateSchedule = vi.hoisted(() => vi.fn())
// Mutable so a test can decide what the picker has to choose between.
const store = vi.hoisted(() => ({ schedules: [] as unknown[] }))

vi.mock('@/features/schedules/stores/schedules-store', () => ({
  useSchedulesStore: (
    selector: (state: {
      updateSchedule: typeof updateSchedule
      schedules: typeof defaultSchedules
    }) => unknown
  ) => selector({ updateSchedule, schedules: store.schedules as never }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

type Screen = Awaited<ReturnType<typeof render>>

// The seeded rotation is staffed by individual employees, so the pool opens
// in Employees mode — switching it to Teams also clears the pool.
async function pickTeams(screen: Screen, names: string[]) {
  await userEvent.click(screen.getByRole('button', { name: 'Teams' }))
  const pool = screen.getByRole('combobox').first()
  for (const name of names) {
    await userEvent.click(pool)
    await userEvent.fill(pool, name)
    await userEvent.keyboard('{Enter}')
  }
  // The menu stays open over the buttons below otherwise, and swallows clicks.
  await userEvent.keyboard('{Escape}')
}

async function save(screen: Screen) {
  await userEvent.click(screen.getByRole('button', { name: 'Save assignment' }))
}

// Everyone the saved coverage matrix names, once each, sorted.
function crewKeys(): string[] {
  const saved = updateSchedule.mock.calls[0][1] as Extract<
    Schedule,
    { type: 'rotate' }
  >
  const keys = new Set<string>()
  saved.day_coverage.forEach((cell) => {
    cell.team_ids.forEach((id) => keys.add(`team:${id}`))
    cell.employee_ids.forEach((id) => keys.add(`employee:${id}`))
  })
  return [...keys].sort()
}

describe('AssignToPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps a suggested assignment when Save is pressed', async () => {
    const screen = await render(<AssignToPanel schedule={rotation} />)

    await pickTeams(screen, ['Team A', 'Team B'])
    await userEvent.click(
      screen.getByRole('button', { name: /suggest assignment/i })
    )
    await save(screen)

    expect(updateSchedule).toHaveBeenCalledTimes(1)
    expect(updateSchedule.mock.calls[0][0]).toBe(rotation.id)
    // Both teams placed — and the employees the seed had assigned cleared,
    // not left behind to double-book the cycle.
    expect(crewKeys()).toEqual(['team:team-a', 'team:team-b'])
  })

  it('applies a pending suggestion on Save when the button was never pressed', async () => {
    const screen = await render(<AssignToPanel schedule={rotation} />)

    await pickTeams(screen, ['Team A', 'Team B'])
    // Deliberately no click on "Suggest assignment" — picking a pool and
    // saving used to leave the old roster in place.
    await save(screen)

    expect(crewKeys()).toEqual(['team:team-a', 'team:team-b'])
  })

  it('leaves a hand-placed roster alone while Assign manually is on', async () => {
    const screen = await render(<AssignToPanel schedule={rotation} />)

    await pickTeams(screen, ['Team A'])
    // Switch to the manual view *after* picking a pool: the pool selection is
    // still there, but "Assign manually" says the stored matrix wins.
    await userEvent.click(
      screen.getByRole('button', { name: 'Assign manually' })
    )
    await save(screen)

    // The pool says teams, the stored matrix says employees — and the manual
    // toggle says the matrix wins.
    expect(crewKeys()).toEqual([
      'employee:emp-a',
      'employee:emp-b',
      'employee:emp-c',
      'employee:emp-d',
    ])
  })

  it('carries the start date and end settings through untouched', async () => {
    const screen = await render(<AssignToPanel schedule={rotation} />)

    await save(screen)

    const saved = updateSchedule.mock.calls[0][1] as Extract<
      Schedule,
      { type: 'rotate' }
    >
    expect(saved.start_date).toBe(rotation.start_date)
    expect(saved.end_settings).toEqual(rotation.end_settings)
  })

  it('saves an edited end frequency alongside the roster', async () => {
    const screen = await render(<AssignToPanel schedule={rotation} />)

    await userEvent.click(screen.getByRole('radio', { name: 'End after' }))
    const occurrences = screen.getByRole('spinbutton')
    await userEvent.fill(occurrences, '5')
    await save(screen)

    const saved = updateSchedule.mock.calls[0][1] as Extract<
      Schedule,
      { type: 'rotate' }
    >
    expect(saved.end_settings).toEqual({
      end_type: 'after_occurrences',
      end_occurrences: 5,
    })
  })
})

// The dialog around that panel. Its whole reason to exist is steering whoever
// opened it toward a schedule nobody has staffed yet, so that is what these
// pin down. Note every seeded rotate schedule *is* staffed — an unstaffed one
// has to be built here rather than found.
describe('AssignCrewsDialog', () => {
  const staffed = rotation
  const unstaffed: RotateSchedule = {
    ...rotation,
    id: 'sched-unstaffed',
    name: 'Aaa Unstaffed Rotation',
    day_coverage: [],
    crew_placements: [],
  }

  beforeEach(() => {
    store.schedules = [staffed, unstaffed]
  })

  it('opens on the unassigned schedule, not the one the screen was showing', async () => {
    const screen = await render(
      <AssignCrewsDialog open onOpenChange={vi.fn()} scheduleId={staffed.id} />
    )

    await expect
      .element(screen.getByRole('combobox').first())
      .toHaveTextContent(unstaffed.name)
  })

  it('falls back to the schedule the screen was showing once all are staffed', async () => {
    store.schedules = [staffed]

    const screen = await render(
      <AssignCrewsDialog open onOpenChange={vi.fn()} scheduleId={staffed.id} />
    )

    await expect
      .element(screen.getByRole('combobox').first())
      .toHaveTextContent(staffed.name)
  })

  it('labels each schedule with whether it is assigned yet', async () => {
    const screen = await render(
      <AssignCrewsDialog open onOpenChange={vi.fn()} scheduleId={staffed.id} />
    )

    await expect
      .element(screen.getByRole('combobox').first())
      .toHaveTextContent('Not yet assigned')
  })
})
