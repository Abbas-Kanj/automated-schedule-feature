import { useRef, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { CheckIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import { useTimeFormat } from '@/lib/time-format'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ShiftDaysTable } from '@/features/shifts/components/shift-days-table'
import { ShiftFormDialog } from '@/features/shifts/components/shift-form-dialog'
import { ShiftSwatch } from '@/features/shifts/components/shift-swatch'
import { SHIFT_ICON_COMPONENTS } from '@/features/shifts/data/data'
import { type Shift } from '@/features/shifts/data/schema'
import { useShiftsStore } from '@/features/shifts/stores/shifts-store'

type ShiftPickerFieldProps = {
  disabled?: boolean
  onDialogOpenChange?: (open: boolean) => void
  // UI hint only — the real gate is the schema's superRefine on `shift_ids`.
  minSelection?: number
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
  // Snapshot of the shifts store's ids when "Add new shift" is clicked, to
  // detect which shift the create dialog just added.
  const idsBeforeCreateRef = useRef<string[]>([])

  const normalizedQuery = query.trim().toLowerCase()
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
    // Clear the search but leave the dropdown open so multiple shifts can be
    // picked in one go.
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

    // Diff the store's ids against the snapshot taken on open to find what
    // was just created, then select it automatically.
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
                      // Catches Radix-initiated closes (Escape, outside
                      // click) — our own trigger click handles opening.
                      setIsOpen(open)
                      if (!open) setQuery('')
                    }}
                  >
                    <PopoverTrigger asChild>
                      <div
                        className='relative flex-1'
                        onClick={(e) => {
                          // PopoverTrigger toggles on every click by default;
                          // swallow it once open so clicking back into the
                          // input doesn't close the dropdown.
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
                            return (
                              <Button
                                key={shift.id}
                                type='button'
                                variant='ghost'
                                onClick={() =>
                                  selectShift(shift.id, field.onChange)
                                }
                                disabled={disabled}
                                className={cn(
                                  'h-auto w-full justify-start gap-3 rounded-sm px-3 py-2 text-start font-normal',
                                  isSelected && 'bg-primary/5'
                                )}
                              >
                                <ShiftSwatch shift={shift} size='lg' />
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
                              </Button>
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
                      return (
                        <Card key={shift.id} className='gap-0 py-3'>
                          <CardContent className='flex items-start gap-3 px-4'>
                            <div className='min-w-0 flex-1 space-y-1'>
                              <div className='flex items-center gap-2'>
                                <ShiftSwatch shift={shift} size='md' />
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
                              onClick={() =>
                                removeShift(shift.id, field.onChange)
                              }
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
