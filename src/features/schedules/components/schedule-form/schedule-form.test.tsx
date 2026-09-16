import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
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

  it('clears and relocks every later step when creating', async () => {
    const screen = await render(
      <ScheduleForm
        defaultValues={fixed}
        onSubmit={vi.fn()}
        resetLaterStepsOnBack
      />
    )

    await next(screen, 4)
    const card = screen.getByTestId('assign-shift-shift-morning')
    await expect.element(card.getByText('Team A')).toBeVisible()

    await userEvent.click(tab(screen, 'Occurrence'))
    await expect.element(tab(screen, 'Start & End')).toBeDisabled()
    await expect.element(tab(screen, 'Assign to')).toBeDisabled()

    await next(screen, 2)
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
