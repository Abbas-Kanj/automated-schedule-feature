import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { isRotateSchedule } from '@/features/schedule-rotation/utils'
import { sampleSchedules } from '../../data/schedules.fixtures'
import { type Schedule } from '../../data/schema'
import { ScheduleForm } from './schedule-form'

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('@/lib/show-submitted-data', () => ({ showSubmittedData: vi.fn() }))

// A fixed schedule complete up to "Assign to", so the wizard can be walked
// forward with Next alone.
const fixed = {
  id: 'fixed-form',
  name: 'Front desk',
  description: '',
  parent_type: 'regular',
  type: 'fixed',
  shift_ids: ['shift-morning'],
  temporary_schedule: false,
  start_date: '2026-01-05',
  end_settings: { end_type: 'never' },
  shift_occurrences: [
    {
      shift_id: 'shift-morning',
      frequency: 'weekly',
      interval: 1,
      weekdays: ['mon', 'tue'],
    },
  ],
  occurrence_exceptions: { public_holiday: false, sick_leave: false },
  crew_kind: 'team',
  shift_assignments: [
    { shift_id: 'shift-morning', employee_ids: [], team_ids: ['team-a'] },
  ],
} as Schedule

type Screen = Awaited<ReturnType<typeof render>>

const tab = (screen: Screen, label: string) =>
  screen.getByRole('navigation').getByRole('button', { name: label })

async function next(screen: Screen, times: number) {
  for (let i = 0; i < times; i++) {
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  }
}

describe('ScheduleForm — going back', () => {
  it('orders fixed steps with Start & End before Assign to, and no Work step', async () => {
    const screen = await render(
      <ScheduleForm defaultValues={fixed} onSubmit={vi.fn()} />
    )
    const labels = await screen
      .getByRole('navigation')
      .getByRole('button')
      .all()
    const text = await Promise.all(labels.map((l) => l.element().textContent))
    expect(text.map((t) => t?.replace(/^\d/, ''))).toEqual([
      'Basics',
      'Shifts',
      'Occurrence',
      'Start & End',
      'Assign to',
      'Summary',
    ])
  })

  // Stepping back to re-read an earlier answer is not an edit. Resetting on
  // the navigation itself discarded every later answer, and because the step
  // landed on still showed its own data the loss only surfaced on the way
  // forward again.
  it('keeps later steps when creating and nothing is edited', async () => {
    const screen = await render(
      <ScheduleForm
        defaultValues={fixed}
        onSubmit={vi.fn()}
        resetLaterStepsOnChange
      />
    )

    await next(screen, 4)
    const card = screen.getByTestId('assign-shift-shift-morning')
    await expect.element(card.getByText('Team A')).toBeVisible()

    await userEvent.click(tab(screen, 'Occurrence'))
    await expect.element(tab(screen, 'Start & End')).toBeEnabled()
    await expect.element(tab(screen, 'Assign to')).toBeEnabled()

    await next(screen, 2)
    await expect
      .element(
        screen.getByTestId('assign-shift-shift-morning').getByText('Team A')
      )
      .toBeVisible()
  }, 45_000)

  it('clears and relocks every later step once an earlier one is edited', async () => {
    const screen = await render(
      <ScheduleForm
        defaultValues={fixed}
        onSubmit={vi.fn()}
        resetLaterStepsOnChange
      />
    )

    await next(screen, 4)
    await expect
      .element(
        screen.getByTestId('assign-shift-shift-morning').getByText('Team A')
      )
      .toBeVisible()

    // Back to Occurrence and actually change it — Wed joins Mon/Tue.
    await userEvent.click(tab(screen, 'Occurrence'))
    await userEvent.click(screen.getByRole('button', { name: 'Wed' }))
    await expect
      .element(screen.getByRole('button', { name: 'Wed' }))
      .toHaveAttribute('aria-pressed', 'true')

    // The edit only takes effect on the way out, so the later steps are still
    // reachable until Next is pressed.
    await next(screen, 1)
    await expect.element(tab(screen, 'Assign to')).toBeDisabled()

    await next(screen, 1)
    await expect
      .element(
        screen
          .getByTestId('assign-shift-shift-morning')
          .getByText('Nobody is on this shift yet.')
      )
      .toBeVisible()
  }, 45_000)

  it('keeps later steps when editing', async () => {
    const screen = await render(
      <ScheduleForm defaultValues={fixed} onSubmit={vi.fn()} />
    )

    await next(screen, 4)
    await userEvent.click(tab(screen, 'Occurrence'))
    await expect.element(tab(screen, 'Assign to')).toBeEnabled()

    await next(screen, 2)
    await expect
      .element(
        screen.getByTestId('assign-shift-shift-morning').getByText('Team A')
      )
      .toBeVisible()
  }, 45_000)

  it('warns when one crew is on more than one shift', async () => {
    const twoShifts = {
      ...fixed,
      shift_ids: ['shift-morning', 'shift-night'],
      shift_occurrences: [
        ...(fixed as Extract<Schedule, { type: 'fixed' }>).shift_occurrences,
        { shift_id: 'shift-night', frequency: 'daily', interval: 1 },
      ],
      shift_assignments: [
        { shift_id: 'shift-morning', employee_ids: [], team_ids: ['team-a'] },
        { shift_id: 'shift-night', employee_ids: [], team_ids: ['team-a'] },
      ],
    } as Schedule
    const screen = await render(
      <ScheduleForm defaultValues={twoShifts} onSubmit={vi.fn()} />
    )

    await next(screen, 4)
    await expect
      .element(screen.getByTestId('multi-shift-warning'))
      .toHaveTextContent('1 team is assigned to more than one shift.')
  }, 45_000)
})

const rotationSeed = sampleSchedules.find((s) => s.id === 'sched-rotation')!
if (!isRotateSchedule(rotationSeed)) {
  throw new Error('Seed is not a rotate schedule')
}
const rotation = rotationSeed

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

// Everyone the submitted coverage matrix names, once each, sorted.
function submittedCrewKeys(onSubmit: ReturnType<typeof vi.fn>): string[] {
  const saved = onSubmit.mock.calls[0][0] as Extract<
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

// Basics → Shifts → Pattern → Start & End → Assign to.
const TO_ROTATE_ASSIGN = 4

describe('ScheduleForm — rotate assignment', () => {
  it('orders rotate steps with Start & End before Assign to', async () => {
    const screen = await render(
      <ScheduleForm defaultValues={rotation} onSubmit={vi.fn()} />
    )
    const labels = await screen
      .getByRole('navigation')
      .getByRole('button')
      .all()
    const text = await Promise.all(labels.map((l) => l.element().textContent))
    expect(text.map((t) => t?.replace(/^\d/, ''))).toEqual([
      'Basics',
      'Shifts',
      'Pattern',
      'Start & End',
      'Assign to',
      'Summary',
    ])
  })

  it('keeps a suggested assignment through to submit', async () => {
    const onSubmit = vi.fn()
    const screen = await render(
      <ScheduleForm defaultValues={rotation} onSubmit={onSubmit} />
    )

    await next(screen, TO_ROTATE_ASSIGN)
    await pickTeams(screen, ['Team A', 'Team B'])
    await userEvent.click(
      screen.getByRole('button', { name: /suggest assignment/i })
    )
    await next(screen, 1)
    await userEvent.click(screen.getByRole('button', { name: 'Save schedule' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    // Both teams placed — and the employees the seed had assigned cleared,
    // not left behind to double-book the cycle.
    expect(submittedCrewKeys(onSubmit)).toEqual(['team:team-a', 'team:team-b'])
  }, 45_000)

  it('applies a pending suggestion on Next when the button was never pressed', async () => {
    const onSubmit = vi.fn()
    const screen = await render(
      <ScheduleForm defaultValues={rotation} onSubmit={onSubmit} />
    )

    await next(screen, TO_ROTATE_ASSIGN)
    await pickTeams(screen, ['Team A', 'Team B'])
    await next(screen, 1)
    await userEvent.click(screen.getByRole('button', { name: 'Save schedule' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(submittedCrewKeys(onSubmit)).toEqual(['team:team-a', 'team:team-b'])
  }, 45_000)

  it('leaves a hand-placed roster alone while Assign manually is on', async () => {
    const onSubmit = vi.fn()
    const screen = await render(
      <ScheduleForm defaultValues={rotation} onSubmit={onSubmit} />
    )

    await next(screen, TO_ROTATE_ASSIGN)
    await userEvent.click(
      screen.getByRole('button', { name: 'Assign manually' })
    )
    await next(screen, 1)
    await userEvent.click(screen.getByRole('button', { name: 'Save schedule' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(submittedCrewKeys(onSubmit)).toEqual([
      'employee:emp-a',
      'employee:emp-b',
      'employee:emp-c',
      'employee:emp-d',
    ])
  }, 45_000)
})
