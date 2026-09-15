import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { sampleSchedules } from '../../data/schedules.fixtures'
import { type RotateDayCoverage } from '../../data/schema'
import { ScheduleAssignToFields } from './schedule-assign-to-fields'

// The "Assign to" step is the only place a rotation's roster can be set (see
// the component's own comment and
// `features/schedule-rotation/utils.ts#getRotationRoster`). Two paths through
// it are worth locking: the suggestion writing a whole coverage matrix, and
// the manual grid behind its toggle — which now offers one row per selected
// shift on every cycle day, so a hole is a visibly empty picker.

const rotation = sampleSchedules.find((s) => s.id === 'sched-rotation')!

// The stored matrix is echoed into the DOM so a pick can be asserted on as
// form state rather than as a rendered chip.
function CoverageState() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coverage = useWatch<any>({ name: 'day_coverage' }) as
    | RotateDayCoverage[]
    | undefined
  const cells = coverage ?? []
  return (
    <>
      <output data-testid='cells'>
        {cells
          .map(
            (cell) =>
              `${cell.day}:${cell.shift_id}=${[
                ...cell.team_ids,
                ...cell.employee_ids,
              ].join('+')}`
          )
          .sort()
          .join(' ')}
      </output>
      <output data-testid='crew-keys'>
        {[
          ...new Set(
            cells.flatMap((cell) => [
              ...cell.team_ids.map((id) => `team:${id}`),
              ...cell.employee_ids.map((id) => `employee:${id}`),
            ])
          ),
        ]
          .sort()
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
      <CoverageState />
    </FormProvider>
  )
}

type Screen = Awaited<ReturnType<typeof render>>

// The step shows one view at a time — "Suggest" by default, since that is the
// intended path. Switching to "Assign manually" swaps in the day grid.
async function enableManual(screen: Screen) {
  await userEvent.click(screen.getByRole('button', { name: 'Assign manually' }))
}

describe('ScheduleAssignToFields', () => {
  it('hides the manual grid until its view is selected', async () => {
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

  it('gives every selected shift its own picker on every day', async () => {
    const screen = await render(<Harness />)
    await enableManual(screen)

    // Three selected shifts, so three pickers per card — including on the
    // pattern's rest card, which the schedule still has to staff.
    for (const day of [0, 3]) {
      const card = screen.getByTestId(`assign-day-${day}`)
      expect(await card.getByRole('combobox').all()).toHaveLength(3)
      for (const name of ['Morning', 'Afternoon', 'Night']) {
        await expect.element(card.getByText(name)).toBeVisible()
      }
    }
  })

  it('shows the crew each cell is already assigned', async () => {
    const screen = await render(<Harness />)
    await enableManual(screen)

    // Rendered from `day_coverage` through the employees store, so this covers
    // the id -> full name resolution as well as the binding. Scoped to the
    // card: a crew name also appears in the pool picker and the coverage grid.
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

    // The seed staffs cells with `employee_ids`, so the cards offer employees
    // only — the old two-picker (Employees *and* Teams) row is gone.
    const card = screen.getByTestId('assign-day-0')
    await expect.element(card.getByText('Team A')).not.toBeInTheDocument()
    await expect.element(card.getByText('Amir Nabil Haddad')).toBeVisible()
  })

  it('writes a free cell edit straight to that one cell', async () => {
    const screen = await render(<Harness />)
    await enableManual(screen)

    // Day 4's Morning cell — seeded with Bilal. Adding Dana to it must not
    // disturb any other cell: no journey follows a crew around any more.
    const cell = screen
      .getByTestId('assign-day-3')
      .getByRole('combobox')
      .first()
    await userEvent.click(cell)
    await userEvent.fill(cell, 'Dana')
    await userEvent.keyboard('{Enter}')

    await expect
      .element(screen.getByTestId('cells'))
      .toHaveTextContent('3:shift-morning=emp-b+emp-d')
    // The rest of the matrix is untouched — Dana is still on her own cells.
    await expect
      .element(screen.getByTestId('cells'))
      .toHaveTextContent('1:shift-morning=emp-d')
  })

  it('drops a cell entirely once its last crew is removed', async () => {
    const screen = await render(<Harness />)
    await enableManual(screen)

    const cell = screen
      .getByTestId('assign-day-0')
      .getByRole('combobox')
      .first()
    await userEvent.click(cell)
    // Backspace on an empty input clears the last selected value in
    // react-select, which is what a user reaching for "remove" actually does.
    await userEvent.keyboard('{Backspace}')

    await expect
      .element(screen.getByTestId('cells'))
      .not.toHaveTextContent('0:shift-morning=')
  })

  it('suggests an assignment that covers every shift every day', async () => {
    const screen = await render(<Harness />)

    // The seeded rotation is staffed by individual employees, so the pool
    // opens in Employees mode — switch it before picking teams.
    await userEvent.click(screen.getByRole('button', { name: 'Teams' }))

    // Pool picker is the step's first combobox, part of the Suggest view.
    const pool = screen.getByRole('combobox').first()
    for (const team of ['Team A', 'Team B']) {
      await userEvent.click(pool)
      await userEvent.fill(pool, team)
      await userEvent.keyboard('{Enter}')
    }
    // The menu stays open over the button otherwise, and swallows the click.
    await userEvent.keyboard('{Escape}')

    await userEvent.click(
      screen.getByRole('button', { name: 'Suggest assignment' })
    )

    // The seeded employees are gone and both teams are placed — a whole-field
    // write, so nothing can be left behind to double-book a cell.
    await expect
      .element(screen.getByTestId('crew-keys'))
      .toHaveTextContent('team:team-a,team:team-b')
  })
})
