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

// One string per cycle position: the teams on it, then the employees.
function crewByPosition(schedule: Schedule) {
  const pattern = (schedule as Extract<Schedule, { type: 'rotate' }>).pattern
  return pattern.map(
    (entry) =>
      `${(entry.team_ids ?? []).join('+') || '-'}/${(entry.employee_ids ?? []).join('+') || '-'}`
  )
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
    const crew = crewByPosition(onSubmit.mock.calls[0][0])
    // Both teams placed, one per position, on their own cards — and the
    // employees the seed had on those positions cleared, not left to
    // double-book them.
    expect(crew.filter((slot) => slot !== '-/-')).toHaveLength(2)
    expect(crew).toContain('team-a/-')
    expect(crew).toContain('team-b/-')
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

    const crew = crewByPosition(onSubmit.mock.calls[0][0])
    expect(crew.filter((slot) => slot !== '-/-')).toHaveLength(2)
    expect(crew).toContain('team-a/-')
    expect(crew).toContain('team-b/-')
  })

  it('leaves a hand-placed roster alone while Assign manually is on', async () => {
    const onSubmit = vi.fn()
    const screen = await render(
      <ScheduleForm defaultValues={rotation} onSubmit={onSubmit} />
    )

    await goToAssignTo(screen)
    await userEvent.click(screen.getByRole('switch'))
    await pickTeams(screen, ['Team A'])
    await finish(screen)

    // The pool says teams, the pattern says employees — and the manual toggle
    // says the pattern wins.
    expect(crewByPosition(onSubmit.mock.calls[0][0])).toEqual([
      '-/emp-a',
      '-/emp-b',
      '-/emp-c',
      '-/emp-d',
    ])
  })
})
