import { useState } from 'react'
import { z } from 'zod'
import { format } from 'date-fns'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
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
import { type PublicHoliday } from '../data/schema'
import { usePublicHolidaysStore } from '../stores/public-holidays-store'
import { nextHolidayId } from '../utils'
import { usePublicHolidays } from './public-holidays-provider'

const formSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  holiday_dates: z
    .array(z.object({ value: z.string().min(1, 'Date is required.') }))
    .min(1, 'At least one holiday date is required.'),
})

type HolidayForm = z.infer<typeof formSchema>

// The calendar works in local Date objects but the form field holds
// "yyyy-MM-dd" strings, so a date is only ever compared as text — no
// timezone drift.
const toDateInputValue = (date: Date) => format(date, 'yyyy-MM-dd')
const fromDateInputValue = (value: string) => new Date(`${value}T00:00:00`)

type Props = {
  currentRow?: PublicHoliday
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PublicHolidaysActionDialog({
  currentRow,
  open,
  onOpenChange,
}: Props) {
  const isEdit = !!currentRow
  const { selectedYear } = usePublicHolidays()
  const holidays = usePublicHolidaysStore((s) => s.holidays)
  const saveHoliday = usePublicHolidaysStore((s) => s.saveHoliday)
  const holidayYear = currentRow?.year ?? selectedYear
  const [calendarOpen, setCalendarOpen] = useState(false)

  const form = useForm<HolidayForm>({
    resolver: zodResolver(formSchema),
    defaultValues: currentRow
      ? {
          name: currentRow.name,
          holiday_dates: currentRow.holiday_dates.map((date) => ({
            value: toDateInputValue(date),
          })),
        }
      : { name: '', holiday_dates: [] },
  })

  const holidayDates =
    useWatch({ control: form.control, name: 'holiday_dates' }) ?? []
  const selectedDates = holidayDates
    .filter(({ value }) => value)
    .map(({ value }) => fromDateInputValue(value))

  // The calendar owns the field: whatever is selected there is the holiday's
  // date list, de-duplicated and kept in order.
  const updateSelectedDates = (dates: Date[] | undefined) => {
    const uniqueDates = [...new Set((dates ?? []).map(toDateInputValue))]
      .sort()
      .map((value) => ({ value }))

    form.setValue('holiday_dates', uniqueDates, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const removeDate = (dateToRemove: string) => {
    form.setValue(
      'holiday_dates',
      holidayDates.filter(({ value }) => value !== dateToRemove),
      { shouldDirty: true, shouldValidate: true }
    )
  }

  const onSubmit = (values: HolidayForm) => {
    const holiday: PublicHoliday = {
      // Editing keeps the record's id; a new one continues the year's
      // sequence, so two holidays can never collide on it.
      id: currentRow?.id ?? nextHolidayId(holidays, holidayYear),
      name: values.name,
      year: holidayYear,
      holiday_dates: values.holiday_dates.map(({ value }) =>
        fromDateInputValue(value)
      ),
      // Only the seeded calendar-date holidays are fixed; anything entered
      // by hand moves, so it is not.
      fixed: currentRow?.fixed ?? false,
    }
    saveHoliday(holiday)
    toast.success(
      isEdit
        ? `Public holiday "${holiday.name}" has been updated.`
        : `Public holiday "${holiday.name}" has been added.`
    )
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        setCalendarOpen(false)
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader className='text-start'>
          <DialogTitle>
            {isEdit ? 'Edit public holiday' : 'Add public holiday'}
          </DialogTitle>
          <DialogDescription>
            Pick every day the holiday covers in {holidayYear}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='public-holiday-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='max-h-[65vh] space-y-4 overflow-y-auto px-1 py-1'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder='Public holiday name' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='holiday_dates'
              render={() => (
                <FormItem>
                  <FormLabel>
                    Dates ({selectedDates.length} day
                    {selectedDates.length === 1 ? '' : 's'})
                  </FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type='button'
                          variant='outline'
                          className='w-full justify-start font-normal'
                        >
                          <CalendarDays />
                          Select one or more dates
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className='w-auto p-0' align='start'>
                      <Calendar
                        mode='multiple'
                        selected={selectedDates}
                        onSelect={updateSelectedDates}
                        defaultMonth={new Date(holidayYear, 0)}
                        startMonth={new Date(holidayYear, 0)}
                        endMonth={new Date(holidayYear, 11)}
                        disabled={(date) => date.getFullYear() !== holidayYear}
                      />
                    </PopoverContent>
                  </Popover>
                  <div className='flex flex-wrap gap-2'>
                    {holidayDates
                      .filter(({ value }) => value)
                      .map(({ value }) => (
                        <Badge
                          key={value}
                          variant='secondary'
                          className='gap-1 py-1'
                        >
                          {format(fromDateInputValue(value), 'dd MMM yyyy')}
                          <button
                            type='button'
                            onClick={() => removeDate(value)}
                            className='rounded-full hover:text-destructive'
                            aria-label={`Remove ${value}`}
                          >
                            <X className='size-3' />
                          </button>
                        </Badge>
                      ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button
            variant='outline'
            type='button'
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type='submit' form='public-holiday-form'>
            {isEdit ? 'Save changes' : 'Add holiday'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
