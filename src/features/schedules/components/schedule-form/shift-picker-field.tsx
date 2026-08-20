import { useRef, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { CheckIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimeFormat } from '@/lib/time-format'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ShiftFormDialog } from '@/features/shifts/components/shift-form-dialog'
import {
  DAY_LABELS,
  SHIFT_BADGE_COLOR_OPTIONS,
  SHIFT_ICON_COMPONENTS,
} from '@/features/shifts/data/data'
import { type DayTimeEntry, type Shift } from '@/features/shifts/data/schema'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'

type ShiftPickerFieldProps = {
  disabled?: boolean
  onDialogOpenChange?: (open: boolean) => void
  // Rotate needs >=2 shifts to actually rotate between; fixed/flexible are
  // fine with just one. Purely a UI hint — the real gate is the schema's
  // own superRefine on `shift_ids` (see `data/schema.ts`).
  minSelection?: number
}

// A shift's enabled days as a "Day | Times" table, with consecutive days
// sharing the exact same times collapsed into a single row (e.g.
// "Mon → Fri  09:00–17:00") instead of N identical rows.
function ShiftDaysTable({
  days,
  formatTime,
}: {
  days: DayTimeEntry[]
  formatTime: (time: string) => string
}) {
  const rows: { days: DayTimeEntry[]; key: string }[] = []
  for (const day of days) {
    const key = day.times
      .map((t) => `${t.from_time}–${t.to_time}`)
      .join(', ')
    const last = rows[rows.length - 1]
    if (last && last.key === key) {
      last.days.push(day)
    } else {
      rows.push({ days: [day], key })
    }
  }

  return (
    <div className='overflow-hidden rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow className='hover:bg-transparent'>
            <TableHead className='h-8'>Day</TableHead>
            <TableHead className='h-8'>Times</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const first = row.days[0]
            const lastDay = row.days[row.days.length - 1]
            const label =
              first.day === lastDay.day
                ? DAY_LABELS[first.day]
                : `${DAY_LABELS[first.day]} → ${DAY_LABELS[lastDay.day]}`
            const times = row.days[0].times
              .map((t) => `${formatTime(t.from_time)}–${formatTime(t.to_time)}`)
              .join(', ')
            return (
              <TableRow key={i} className='hover:bg-transparent'>
                <TableCell className='py-1.5 text-muted-foreground whitespace-nowrap'>
                  {label}
                </TableCell>
                <TableCell className='py-1.5 whitespace-normal text-muted-foreground'>
                  {times}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function ShiftPickerField({
  disabled,
  onDialogOpenChange,
  minSelection = 1,
}: ShiftPickerFieldProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { control, setValue } = useFormContext<any>()
  const shifts = useShiftsStore((s) => s.shifts)
  const formatTime = useTimeFormat()

  const selectedIds = useWatch({ control, name: 'shift_ids' }) as
    | string[]
    | undefined

  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  // Snapshot of the shifts store's ids at the moment "Add new shift" is
  // clicked — used to detect which shift the create dialog just added.
  const idsBeforeCreateRef = useRef<string[]>([])

  const normalizedQuery = query.trim().toLowerCase()
  // Empty query shows every shift — the dropdown opens on click, not just
  // once you start typing, so there needs to be something to show.
  const filteredShifts = normalizedQuery
    ? shifts.filter((s) => s.name.toLowerCase().includes(normalizedQuery))
    : shifts

  const selectedShifts = (selectedIds ?? [])
    .map((id) => shifts.find((s) => s.id === id))
    .filter((shift): shift is Shift => shift !== undefined)

  const selectShift = (id: string, onChange: (value: string[]) => void) => {
    if (disabled) return
    const current = selectedIds ?? []
    if (!current.includes(id)) onChange([...current, id])
    // Selecting finishes that search — clear it so the list resets to
    // showing everything for the next pick, but leave the dropdown open so
    // multiple shifts can be picked in one go.
    setQuery('')
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
            {minSelection > 1 && (
              <p className='-mt-2 text-sm text-muted-foreground'>
                Select at least {minSelection} shifts to build a rotation.
              </p>
            )}
            <FormControl>
              <div className='space-y-4'>
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                  <Popover
                    open={isOpen}
                    onOpenChange={(open) => {
                      // Fires for Radix-initiated opens/closes (Escape,
                      // outside click). Our own trigger click below handles
                      // opening explicitly, so this mainly catches closes.
                      setIsOpen(open)
                      if (!open) setQuery('')
                    }}
                  >
                    <PopoverTrigger asChild>
                      <div
                        className='relative flex-1'
                        onClick={(e) => {
                          // PopoverTrigger toggles open/closed on every
                          // click by default. Once open, clicking back into
                          // the input (e.g. to reposition the cursor while
                          // typing) shouldn't close the dropdown — only
                          // swallow the toggle when it would close it.
                          if (disabled || isOpen) e.preventDefault()
                        }}
                      >
                        <SearchIcon className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                        <Input
                          type='text'
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder='Search shifts by name...'
                          disabled={disabled}
                          className='ps-9'
                          autoComplete='off'
                        />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      className='w-(--radix-popover-trigger-width) p-1'
                      align='start'
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      {filteredShifts.length ? (
                        <div className='max-h-64 space-y-0.5 overflow-y-auto'>
                          {filteredShifts.map((shift) => {
                            const isSelected = (field.value ?? []).includes(
                              shift.id
                            )
                            const Icon = SHIFT_ICON_COMPONENTS[shift.icon]
                            const color = SHIFT_BADGE_COLOR_OPTIONS.find(
                              (o) => o.value === shift.badge_color
                            )
                            return (
                              <button
                                key={shift.id}
                                type='button'
                                onClick={() =>
                                  selectShift(shift.id, field.onChange)
                                }
                                disabled={disabled}
                                className={cn(
                                  'flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors',
                                  disabled
                                    ? 'cursor-not-allowed opacity-60'
                                    : 'cursor-pointer hover:bg-accent',
                                  isSelected && 'bg-primary/5'
                                )}
                              >
                                <span
                                  className={cn(
                                    'size-2.5 shrink-0 rounded-full',
                                    color?.swatchClassName
                                  )}
                                />
                                {Icon && (
                                  <Icon className='size-4 shrink-0 text-muted-foreground' />
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
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <p className='px-3 py-2 text-sm text-muted-foreground'>
                          {normalizedQuery
                            ? 'No shifts match your search.'
                            : 'No shifts yet — add one to get started.'}
                        </p>
                      )}
                    </PopoverContent>
                  </Popover>
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
                              </div>
                              {enabledDays.length ? (
                                <ShiftDaysTable
                                  days={enabledDays}
                                  formatTime={formatTime}
                                />
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