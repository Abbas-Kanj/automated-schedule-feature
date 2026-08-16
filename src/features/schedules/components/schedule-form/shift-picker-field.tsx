import { useRef, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { CheckIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ShiftFormDialog } from '@/features/shifts/components/shift-form-dialog'
import {
  DAY_LABELS,
  SHIFT_BADGE_COLOR_OPTIONS,
  SHIFT_ICON_COMPONENTS,
} from '@/features/shifts/data/data'
import { type Shift } from '@/features/shifts/data/schema'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'

type ShiftPickerFieldProps = {
  disabled?: boolean
  onDialogOpenChange?: (open: boolean) => void
}

export function ShiftPickerField({
  disabled,
  onDialogOpenChange,
}: ShiftPickerFieldProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, setValue } = useFormContext<any>()
  const shifts = useShiftsStore((s) => s.shifts)

  const selectedIds = useWatch({ control, name: 'shift_ids' }) as
    | string[]
    | undefined

  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  // Snapshot of the shifts store's ids at the moment "Add new shift" is
  // clicked — used to detect which shift the create dialog just added.
  const idsBeforeCreateRef = useRef<string[]>([])

  const normalizedQuery = query.trim().toLowerCase()
  const filteredShifts = normalizedQuery
    ? shifts.filter((s) => s.name.toLowerCase().includes(normalizedQuery))
    : shifts

  const selectedShifts = (selectedIds ?? [])
    .map((id) => shifts.find((s) => s.id === id))
    .filter((shift): shift is Shift => shift !== undefined)

  const toggleShift = (id: string, onChange: (value: string[]) => void) => {
    if (disabled) return
    const current = selectedIds ?? []
    const next = current.includes(id)
      ? current.filter((s) => s !== id)
      : [...current, id]
    onChange(next)
  }

  const removeShift = (id: string, onChange: (value: string[]) => void) => {
    if (disabled) return
    const current = selectedIds ?? []
    onChange(current.filter((s) => s !== id))
  }

  const handleAddNewShift = () => {
    if (disabled) return
    idsBeforeCreateRef.current = shifts.map((s) => s.id)
    setCreateOpen(true)
    onDialogOpenChange?.(true)
  }

  const handleCreateDialogOpenChange = (open: boolean) => {
    setCreateOpen(open)
    onDialogOpenChange?.(open)
    if (open) return

    // The dialog closes itself on submit after calling `addShift`, which
    // appends the new Shift at the end of the store's array. Diff the
    // store's ids against the snapshot taken when the dialog was opened to
    // find what was just created, then select it automatically.
    const before = new Set(idsBeforeCreateRef.current)
    const newIds = useShiftsStore
      .getState()
      .shifts.map((s) => s.id)
      .filter((id) => !before.has(id))
    if (newIds.length === 1) {
      setValue('shift_ids', [...(selectedIds ?? []), newIds[0]])
    }
  }

  return (
    <>
      <FormField
        control={control}
        name='shift_ids'
        render={({ field }) => (
          <FormItem className='space-y-4'>
            <FormLabel>Shifts</FormLabel>
            <FormControl>
              <div className='space-y-4'>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                  <div className='relative flex-1'>
                    <SearchIcon className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder='Search shifts by name...'
                      disabled={disabled}
                      className='ps-9'
                    />
                  </div>
                  <Button
                    type='button'
                    variant='outline'
                    disabled={disabled}
                    onClick={handleAddNewShift}
                  >
                    <PlusIcon className='size-4' />
                    Add new shift
                  </Button>
                </div>

                {filteredShifts.length ? (
                  <div className='grid gap-2 sm:grid-cols-2'>
                    {filteredShifts.map((shift) => {
                      const isSelected = (field.value ?? []).includes(shift.id)
                      const Icon = SHIFT_ICON_COMPONENTS[shift.icon]
                      const color = SHIFT_BADGE_COLOR_OPTIONS.find(
                        (o) => o.value === shift.badge_color
                      )
                      return (
                        <Card
                          key={shift.id}
                          onClick={() => toggleShift(shift.id, field.onChange)}
                          className={cn(
                            'gap-0 py-3 transition-colors',
                            disabled
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer hover:border-primary/60',
                            isSelected && 'border-primary bg-primary/5'
                          )}
                        >
                          <CardContent className='flex items-center gap-3 px-4'>
                            <span
                              className={cn(
                                'size-3 shrink-0 rounded-full',
                                color?.swatchClassName
                              )}
                            />
                            {Icon && (
                              <Icon className='size-5 shrink-0 text-muted-foreground' />
                            )}
                            <span className='min-w-0 flex-1'>
                              <span className='block truncate text-sm font-medium'>
                                {shift.name}
                              </span>
                              <span className='block truncate text-xs text-muted-foreground'>
                                {shift.short_code}
                              </span>
                            </span>
                            {isSelected && (
                              <CheckIcon className='size-4 shrink-0 text-primary' />
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    No shifts match your search.
                  </p>
                )}

                {selectedShifts.length > 0 && (
                  <div className='space-y-2'>
                    <p className='text-sm font-medium text-foreground'>
                      Selected shifts
                    </p>
                    {selectedShifts.map((shift) => {
                      const enabledDays = shift.days.filter((d) => d.enabled)
                      const Icon = SHIFT_ICON_COMPONENTS[shift.icon]
                      const color = SHIFT_BADGE_COLOR_OPTIONS.find(
                        (o) => o.value === shift.badge_color
                      )
                      return (
                        <Card key={shift.id} className='gap-0 py-3'>
                          <CardContent className='flex items-start gap-3 px-4'>
                            <div className='min-w-0 flex-1 space-y-1'>
                              <div className='flex items-center gap-2'>
                                <span
                                  className={cn(
                                    'size-2 shrink-0 rounded-full',
                                    color?.swatchClassName
                                  )}
                                />
                                {Icon && (
                                  <Icon className='size-4 shrink-0 text-muted-foreground' />
                                )}
                                <span className='truncate text-sm font-medium'>
                                  {shift.name}
                                </span>
                                <span className='shrink-0 text-xs text-muted-foreground'>
                                  {shift.short_code}
                                </span>
                              </div>
                              {enabledDays.length ? (
                                <div className='flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground'>
                                  {enabledDays.map((day) => (
                                    <span key={day.day}>
                                      {DAY_LABELS[day.day]}:{' '}
                                      {day.times
                                        .map(
                                          (t) => `${t.from_time}–${t.to_time}`
                                        )
                                        .join(', ')}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className='text-sm text-muted-foreground'>
                                  No enabled days
                                </p>
                              )}
                            </div>
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='shrink-0'
                              disabled={disabled}
                              onClick={() => removeShift(shift.id, field.onChange)}
                              title={`Remove ${shift.name}`}
                            >
                              <XIcon className='size-4' />
                            </Button>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <ShiftFormDialog
        open={createOpen}
        onOpenChange={handleCreateDialogOpenChange}
      />
    </>
  )
}