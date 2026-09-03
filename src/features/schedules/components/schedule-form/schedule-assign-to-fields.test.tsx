import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { defaultSchedules } from '../../data/schedules'
import { ScheduleAssignToFields } from './schedule-assign-to-fields'

// The "Assign to" step is the only place a rotation's roster can be set (see
// the component's own comment and
// `features/schedule-rotation/utils.ts#getRotationRoster`). Two paths through
// it are worth locking: the suggestion writing offsets back into the pattern,
// and the manual grid behind its toggle — including that it offers one cycle
// day per pattern card, the off day included.

const rotation = defaultSchedules.find((s) => s.id === 'sched-rotation')!

// Crew per position is echoed into the DOM so a pick can be asserted on as
// form state rather than as a rendered chip.
function PatternCrew() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pattern = useWatch<any>({ name: 'pattern' }) as
    | { employee_ids?: string[]; team_ids?: string[] }[]
    | undefined
  return (
    <>
      <output data-testid='off-crew'>
        {(pattern?.[3]?.employee_ids ?? []).join(',')}
      </output>
      <output data-testid='all-teams'>
        {(pattern ?? [])
          .map((entry) => (entry.team_ids ?? []).join('+') || '-')
          .join(',')}
      </output>
    </>
  )
}

function Harness() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({ defaultValues: rotation })
  return (
    <FormProvider {...form}>
      <ScheduleAssignToFields />
      <PatternCrew />
    </FormProvider>
  )
}

// The manual grid is behind a toggle — off by default, since suggesting is
// the intended path.
async function enableManual(
  screen: ReturnType<typeof render> extends Promise<infer T> ? T : never
) {
  await userEvent.click(screen.getByRole('switch'))
}

describe('ScheduleAssignToFields', () => {
  it('hides the manual grid until its toggle is turned on', async () => {
    const screen = await render(<Harness />)

    await expect
      .element(screen.getByTestId('assign-day-0'))
      .not.toBeInTheDocument()
    await enableManual(screen)
    await expect.element(screen.getByTestId('assign-day-0')).toBeVisible()
  })

  it('renders one day card per cycle position, off included', async () => {
    const screen = await render(<Harness />)
    await enableManual(screen)

    for (let i = 0; i < 4; i++) {
      await expect.element(screen.getByTestId(`assign-day-${i}`)).toBeVisible()
    }
    for (let i = 1; i <= 4; i++) {
      await expect.element(screen.getByText(`Day ${i}`)).toBeVisible()
    }
  })

  it('shows the shift as a disabled field on each day card', async () => {
    const screen = await render(<Harness />)
    await enableManual(screen)

    // The pattern owns the shift — this step only decides who works it.
    await expect
      .element(screen.getByTestId('assign-day-0').getByRole('combobox').first())
      .toBeDisabled()
  })

  it('shows the crew each position is already assigned', async () => {
    const screen = await render(<Harness />)
    await enableManual(screen)

    // Rendered from `pattern[].employee_ids` through the employees store, so
    // this covers the id -> full name resolution as well as the binding.
    // Scoped to the card: a crew name also appears in the pool picker and the
    // coverage grid.
    await expect
      .element(
        screen.getByTestId('assign-day-0').getByText('Amir Nabil Haddad')
      )
      .toBeVisible()
    await expect
      .element(
        screen.getByTestId('assign-day-3').getByText('Dana Leila Salameh')
      )
      .toBeVisible()
  })

  it('offers only the crew kind already in use, not both', async () => {
    const screen = await render(<Harness />)
    await enableManual(screen)

    // The seed staffs positions with `employee_ids`, so the cards offer
    // employees only — the old two-picker (Employees *and* Teams) row is gone.
    const card = screen.getByTestId('assign-day-0')
    await expect.element(card.getByText('Team A')).not.toBeInTheDocument()
    await expect.element(card.getByText('Amir Nabil Haddad')).toBeVisible()
  })

  it('writes a pick on the off day back to the pattern', async () => {
    const screen = await render(<Harness />)
    await enableManual(screen)

    // First combobox on a card is the disabled shift; the crew picker follows.
    const offDayCrew = screen
      .getByTestId('assign-day-3')
      .getByRole('combobox')
      .nth(1)
    await userEvent.click(offDayCrew)
    await userEvent.fill(offDayCrew, 'Bilal')
    await userEvent.keyboard('{Enter}')

    await expect
      .element(screen.getByTestId('off-crew'))
      .toHaveTextContent('emp-d,emp-b')
  })

  it('suggests an assignment that spreads the pool across the cycle', async () => {
    const screen = await render(<Harness />)

    // The seeded rotation is staffed by individual employees, so the pool
    // opens in Employees mode — switch it before picking teams.
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    // Pool picker is the step's first combobox, above the manual toggle.
    const pool = screen.getByRole('combobox').first()
    for (const team of ['Team A', 'Team B']) {
      await userEvent.click(pool)
      await userEvent.fill(pool, team)
      await userEvent.keyboard('{Enter}')
    }
    // The menu stays open over the button otherwise, and swallows the click.
    await userEvent.keyboard('{Escape}')

    await userEvent.click(screen.getByRole('button', { name: /suggest/i }))

    await expect
      .element(screen.getByTestId('all-teams'))
      .toHaveTextContent('team-a')

    const positions = (
      screen.getByTestId('all-teams').element().textContent ?? ''
    ).split(',')

    // Both teams placed, each on its own position, and the rest left empty —
    // i.e. the suggestion staggered them rather than piling them onto one card.
    expect(positions).toHaveLength(4)
    expect(positions.filter((slot) => slot !== '-')).toHaveLength(2)
    expect(positions.indexOf('team-a')).toBeGreaterThanOrEqual(0)
    expect(positions.indexOf('team-b')).toBeGreaterThanOrEqual(0)
    expect(positions.indexOf('team-a')).not.toBe(positions.indexOf('team-b'))
  })
})
