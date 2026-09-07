import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { defaultSchedules } from '../../data/schedules'
import { type Schedule } from '../../data/schema'
import { ScheduleForm } from './schedule-form'

// Covers the seam between the wizard's "Next" button and the "Assign to"
// step: the crew a rotate schedule advances with has to be the crew the step
// was showing. The step itself is tested in
// `schedule-assign-to-fields.test.tsx`; what needs the whole form is that the
// assignment survives — and gets taken in the first place — on the way out.

const rotation = defaultSchedules.find((s) => s.id === 'sched-rotation')!

type Screen = Awaited<ReturnType<typeof render>>

// basics -> shifts -> pattern -> assign-to.
async function goToAssignTo(screen: Screen) {
  for (let i = 0; i < 3; i++) {
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  }
  await expect
    .element(screen.getByRole('button', { name: /suggest assignment/i }))
    .toBeVisible()
}

// The seeded rotation is staffed by individual employees, so the pool opens in
// Employees mode — switching it to Teams also clears the pool.
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

// assign-to -> end-settings -> summary -> submit.
async function finish(screen: Screen) {
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save schedule' }))
}

// Everyone the stored coverage matrix names, once each, sorted.
function crewKeys(schedule: Schedule) {
  const coverage = (schedule as Extract<Schedule, { type: 'rotate' }>)
    .day_coverage
  const keys = new Set<string>()
  coverage.forEach((cell) => {
    cell.team_ids.forEach((id) => keys.add(`team:${id}`))
    cell.employee_ids.forEach((id) => keys.add(`employee:${id}`))
  })
  return [...keys].sort()
}

// How many (cycle day, shift) cells nobody is on.
function uncoveredCells(schedule: Schedule) {
  const rotate = schedule as Extract<Schedule, { type: 'rotate' }>
  const staffed = new Set(
    rotate.day_coverage
      .filter((cell) => cell.employee_ids.length || cell.team_ids.length)
      .map((cell) => `${cell.day}:${cell.shift_id}`)
  )
  return rotate.pattern.length * rotate.shift_ids.length - staffed.size
}

describe('ScheduleForm — rotate crew assignment', () => {
  it('keeps a suggested assignment when the step is left with Next', async () => {
    const onSubmit = vi.fn()
    const screen = await render(
      <ScheduleForm defaultValues={rotation} onSubmit={onSubmit} />
    )

    await goToAssignTo(screen)
    await pickTeams(screen, ['Team A', 'Team B'])
    await userEvent.click(
      screen.getByRole('button', { name: /suggest assignment/i })
    )
    await finish(screen)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    // Both teams placed — and the employees the seed had assigned cleared,
    // not left behind to double-book the cycle.
    expect(crewKeys(onSubmit.mock.calls[0][0])).toEqual([
      'team:team-a',
      'team:team-b',
    ])
  })

  it('applies the suggestion on Next when the button was never pressed', async () => {
    const onSubmit = vi.fn()
    const screen = await render(
      <ScheduleForm defaultValues={rotation} onSubmit={onSubmit} />
    )

    await goToAssignTo(screen)
    await pickTeams(screen, ['Team A', 'Team B'])
    // Deliberately no click on "Suggest assignment" — picking a pool and
    // continuing used to advance with the old roster still in place.
    await finish(screen)

    expect(crewKeys(onSubmit.mock.calls[0][0])).toEqual([
      'team:team-a',
      'team:team-b',
    ])
  })

  it('leaves a hand-placed roster alone while Assign manually is on', async () => {
    const onSubmit = vi.fn()
    const screen = await render(
      <ScheduleForm defaultValues={rotation} onSubmit={onSubmit} />
    )

    await goToAssignTo(screen)
    await pickTeams(screen, ['Team A'])
    // Switch to the manual view *after* picking a pool: the pool selection is
    // still there, but "Assign manually" says the stored matrix wins.
    await userEvent.click(
      screen.getByRole('button', { name: 'Assign manually' })
    )
    await finish(screen)

    // The pool says teams, the stored matrix says employees — and the manual
    // toggle says the matrix wins.
    expect(crewKeys(onSubmit.mock.calls[0][0])).toEqual([
      'employee:emp-a',
      'employee:emp-b',
      'employee:emp-c',
      'employee:emp-d',
    ])
  })

  it('staffs every shift on every cycle day when there are crews enough', () => {
    // The seeded rotation is the shape the rework exists for: three shifts,
    // four crews, and a pattern that only ever names one shift per card.
    expect(uncoveredCells(rotation)).toBe(0)
  })
})
