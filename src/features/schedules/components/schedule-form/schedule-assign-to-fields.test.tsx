import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { defaultSchedules } from '../../data/schedules'
import { ScheduleAssignToFields } from './schedule-assign-to-fields'

// The "Assign to" step is the only place a rotation's roster can be set (see
// the component's own comment and
// `features/schedule-rotation/utils.ts#getRotationRoster`), so it's worth
// checking it really renders one assignable row per cycle position — the off
// position included, since that's the one with no shift behind it.

const rotation = defaultSchedules.find((s) => s.id === 'sched-rotation')!

// The off position's crew is echoed into the DOM so a pick can be asserted
// on as form state rather than as a rendered chip.
function OffPositionCrew() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = useWatch<any>({ name: 'pattern.3.employee_ids' }) as
    | string[]
    | undefined
  return <output data-testid='off-crew'>{(value ?? []).join(',')}</output>
}

function Harness() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({ defaultValues: rotation })
  return (
    <FormProvider {...form}>
      <ScheduleAssignToFields />
      <OffPositionCrew />
    </FormProvider>
  )
}

describe('ScheduleAssignToFields', () => {
  it('renders one row per cycle position, off included', async () => {
    const screen = await render(<Harness />)

    for (const label of ['Morning', 'Afternoon', 'Night', 'Off']) {
      await expect
        .element(screen.getByText(label, { exact: true }))
        .toBeVisible()
    }
    for (let i = 1; i <= 4; i++) {
      await expect.element(screen.getByText(`Position ${i}`)).toBeVisible()
    }
  })

  it('shows the crew each position is already assigned', async () => {
    const screen = await render(<Harness />)

    // Rendered from `pattern[].employee_ids` through the employees store, so
    // this covers the id -> full name resolution as well as the binding.
    await expect.element(screen.getByText('Amir Nabil Haddad')).toBeVisible()
    await expect.element(screen.getByText('Dana Leila Salameh')).toBeVisible()
  })

  it('writes a pick on the off position back to the pattern', async () => {
    const screen = await render(<Harness />)

    // Two selects per row (Employees, Teams), so the fourth row's employee
    // picker is index 6.
    const offRowEmployees = screen.getByRole('combobox').nth(6)
    await userEvent.click(offRowEmployees)
    await userEvent.fill(offRowEmployees, 'Bilal')
    await userEvent.keyboard('{Enter}')

    await expect
      .element(screen.getByTestId('off-crew'))
      .toHaveTextContent('emp-d,emp-b')
  })
})
