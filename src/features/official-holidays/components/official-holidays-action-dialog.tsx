import { useState } from 'react'
import { z } from 'zod'
import { format } from 'date-fns'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays, Plus, X } from 'lucide-react'
import { showSubmittedData } from '@/lib/show-submitted-data'
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
import { SelectDropdown } from '@/components/select-dropdown'
import { rigidOptions } from '../data/data'
import { type OfficialHoliday } from '../data/schema'
import { useOfficialHolidays } from './official-holidays-provider'

const formSchema = z.object({
  id: z.string().trim().min(1, 'ID is required.'),
  name: z.string().trim().min(1, 'Name is required.'),
  holidayDates: z
    .array(z.object({ value: z.string().min(1, 'Date is required.') }))
    .min(1, 'At least one holiday date is required.')
    .refine(
      (dates) => new Set(dates.map((date) => date.value)).size === dates.length,
      'Holiday dates must be unique.'
    ),
  rigid: z.enum(['yes', 'no']),
})

type HolidayForm = z.infer<typeof formSchema>

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type Props = {
  currentRow?: OfficialHoliday
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OfficialHolidaysActionDialog({
  currentRow,
  open,
  onOpenChange,
}: Props) {
  const isEdit = !!currentRow
  const { selectedYear, saveHoliday } = useOfficialHolidays()
  const holidayYear = currentRow?.year ?? selectedYear
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const form = useForm<HolidayForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          id: currentRow.id,
          name: currentRow.name,
          holidayDates: currentRow.holidayDates.map((date) => ({
            value: toDateInputValue(date),
          })),
          rigid: currentRow.rigid ? 'yes' : 'no',
        }
      : { id: '', name: '', holidayDates: [], rigid: 'no' },
  })
  const holidayDates =
    useWatch({ control: form.control, name: 'holidayDates' }) ?? []

  const addSelectedDates = () => {
    if (!selectedDates.length) return

    const currentDates = holidayDates.map(({ value }) => value).filter(Boolean)
    const newDates = selectedDates.map(toDateInputValue)
    const uniqueDates = [...new Set([...currentDates, ...newDates])]
      .sort()
      .map((value) => ({ value }))

    form.setValue('holidayDates', uniqueDates, {
      shouldDirty: true,
      shouldValidate: true,
    })
    setSelectedDates([])
    setCalendarOpen(false)
  }

  const removeDate = (dateToRemove: string) => {
    form.setValue(
      'holidayDates',
      holidayDates.filter(({ value }) => value !== dateToRemove),
      { shouldDirty: true, shouldValidate: true }
    )
  }

  const onSubmit = (values: HolidayForm) => {
    const holiday: OfficialHoliday = {
      id: values.id,
      name: values.name,
      year: currentRow?.year ?? selectedYear,
      holidayDates: values.holidayDates.map(
        ({ value }) => new Date(`${value}T00:00:00`)
      ),
      rigid: isEdit ? values.rigid === 'yes' : false,
    }
    saveHoliday(holiday)
    showSubmittedData(
      holiday,
      isEdit ? 'Official holiday updated:' : 'Official holiday created:'
    )
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        setSelectedDates([])
        setCalendarOpen(false)
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader className='text-start'>
          <DialogTitle>
            {isEdit ? 'Edit Official Holiday' : 'Add Official Holiday'}
          </DialogTitle>
          <DialogDescription>
            Enter the holiday details and click save when you are done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='official-holiday-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='max-h-[65vh] space-y-4 overflow-y-auto px-1 py-1'
          >
            <FormField
              control={form.control}
              name='id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID</FormLabel>
                  <FormControl>
                    <Input placeholder='HOL-013' disabled={isEdit} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder='Official holiday name' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='space-y-2'>
              <FormLabel>
                Holiday Dates (
                {holidayDates.filter(({ value }) => value).length} day
                {holidayDates.filter(({ value }) => value).length === 1
                  ? ''
                  : 's'}
                )
              </FormLabel>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type='button'
                    variant='outline'
                    className='w-full justify-start font-normal'
                  >
                    <CalendarDays />
                    Select one or more dates
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0' align='start'>
                  <Calendar
                    mode='multiple'
                    selected={selectedDates}
                    onSelect={(dates) => setSelectedDates(dates ?? [])}
                    defaultMonth={new Date(holidayYear, 0)}
                    startMonth={new Date(holidayYear, 0)}
                    endMonth={new Date(holidayYear, 11)}
                    disabled={(date) => date.getFullYear() !== holidayYear}
                  />
                  <div className='flex items-center justify-between gap-3 border-t p-3'>
                    <span className='text-sm text-muted-foreground'>
                      {selectedDates.length} selected
                    </span>
                    <Button
                      type='button'
                      size='sm'
                      disabled={!selectedDates.length}
                      onClick={addSelectedDates}
                    >
                      <Plus />
                      Add date
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <FormField
                control={form.control}
                name='holidayDates'
                render={() => (
                  <FormItem>
                    <div className='flex flex-wrap gap-2'>
                      {holidayDates
                        .filter(({ value }) => value)
                        .map(({ value }) => (
                          <Badge
                            key={value}
                            variant='secondary'
                            className='gap-1 py-1'
                          >
                            {format(
                              new Date(`${value}T00:00:00`),
                              'dd MMM yyyy'
                            )}
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
            </div>
            {isEdit ? (
              <FormField
                control={form.control}
                name='rigid'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rigid</FormLabel>
                    <SelectDropdown
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      placeholder='Select Yes or No'
                      items={rigidOptions.map(({ label, value }) => ({
                        label,
                        value,
                      }))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormItem>
                <FormLabel>Rigid</FormLabel>
                <div className='rounded-md border bg-muted/50 px-3 py-2 text-sm'>
                  No
                </div>
                <p className='text-sm text-muted-foreground'>
                  New holidays are always created as non-rigid.
                </p>
              </FormItem>
            )}
          </form>
        </Form>
        <DialogFooter>
          <Button type='submit' form='official-holiday-form'>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
