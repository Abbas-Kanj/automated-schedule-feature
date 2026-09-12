import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { defaultSchedules } from '@/features/schedules/data/schedules'
import { useSchedulesStore } from '@/features/schedules/stores/schedules-store'
import { type RotateSchedule, isRotateSchedule } from '../utils'
import { RotationDatesDialog } from './rotation-dates-dialog'

// A rotation's start date and end frequency are edited here, not in the
// schedule wizard (see `getSteps` in `schedule-form.tsx`) — so this dialog is
// the only path to those two fields for a rotate schedule. What it has to do
// is write them through to the store; getting that wrong strands every
// rotation on its creation defaults with no other way to change them.

const rotation = defaultSchedules.find(
  (s): s is RotateSchedule => s.id === 'sched-rotation' && isRotateSchedule(s)
)!

// The store persists to localStorage, which outlives the test file — put the
// seeded schedule back so a later file doesn't inherit an edited one.
afterEach(() => {
  useSchedulesStore.getState().updateSchedule(rotation.id, rotation)
})

function storedSchedule() {
  const stored = useSchedulesStore
    .getState()
    .schedules.find((s) => s.id === rotation.id)!
  return stored as RotateSchedule
}

describe('RotationDatesDialog', () => {
  it('writes a changed end frequency through to the schedule', async () => {
    const onSaved = vi.fn()
    const screen = await render(
      <RotationDatesDialog
        schedule={rotation}
        open
        onOpenChange={() => {}}
        onSaved={onSaved}
      />
    )

    await userEvent.click(screen.getByRole('radio', { name: /end after/i }))
    const occurrences = screen.getByRole('spinbutton')
    await userEvent.fill(occurrences, '4')
    await userEvent.click(screen.getByRole('button', { name: 'Save dates' }))

    expect(storedSchedule().end_settings).toEqual({
      end_type: 'after_occurrences',
      end_occurrences: 4,
    })
    // The screen counts every date it draws from the start date, so it is
    // handed back the saved one to re-anchor on.
    expect(onSaved).toHaveBeenCalledWith(rotation.start_date)
  })

  it('keeps the rest of the schedule intact', async () => {
    const screen = await render(
      <RotationDatesDialog schedule={rotation} open onOpenChange={() => {}} />
    )

    await userEvent.click(screen.getByRole('radio', { name: /end after/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Save dates' }))

    const saved = storedSchedule()
    expect(saved.pattern).toEqual(rotation.pattern)
    expect(saved.day_coverage).toEqual(rotation.day_coverage)
    expect(saved.shift_ids).toEqual(rotation.shift_ids)
  })

  it('refuses to save an "end on" with no date', async () => {
    const onSaved = vi.fn()
    const screen = await render(
      <RotationDatesDialog
        schedule={rotation}
        open
        onOpenChange={() => {}}
        onSaved={onSaved}
      />
    )

    await userEvent.click(screen.getByRole('radio', { name: /end on/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Save dates' }))

    await expect.element(screen.getByText('Set the end date')).toBeVisible()
    expect(onSaved).not.toHaveBeenCalled()
    expect(storedSchedule().end_settings).toEqual(rotation.end_settings)
  })
})
