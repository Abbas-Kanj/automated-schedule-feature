import { z } from 'zod'
import { format } from 'date-fns'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon } from 'lucide-react'
import { toast } from 'sonner'
import { generateId } from '@/lib/id'
import { cn } from '@/lib/utils'
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
import { Textarea } from '@/components/ui/textarea'
import { SelectDropdown } from '@/components/select-dropdown'
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '../data/data'
import {
  SCHEDULE_TEMPLATE_PRIORITIES,
  SCHEDULE_TEMPLATE_STATUSES,
  type ScheduleTemplate,
} from '../data/schema'
import { useScheduleTemplatesStore } from '../stores/schedule-templates-store'
import { formatDuration } from '../utils'
import { useScheduleTemplates } from './schedule-templates-provider'

const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Required')

const formSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(60),
    description: z.string().trim().min(1, 'Description is required.'),
    start_date: z.date({ message: 'Start date is required.' }),
    end_date: z.date({ message: 'End date is required.' }),
    from_time: timeStringSchema,
    to_time: timeStringSchema,
    status: z.enum(SCHEDULE_TEMPLATE_STATUSES),
    priority: z.enum(SCHEDULE_TEMPLATE_PRIORITIES),
  })
  .refine((values) => values.end_date >= values.start_date, {
    message: 'End date must be on or after the start date.',
    path: ['end_date'],
  })

type ScheduleTemplateForm = z.infer<typeof formSchema>

const DATE_FIELDS = [
  { name: 'start_date', label: 'Start date' },
  { name: 'end_date', label: 'End date' },
] as const

type Props = {
  currentRow?: ScheduleTemplate
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScheduleTemplateActionDialog({
  currentRow,
  open,
  onOpenChange,
}: Props) {
  const isEdit = !!currentRow
  const { setCurrentRow } = useScheduleTemplates()
  const addTemplate = useScheduleTemplatesStore((s) => s.addTemplate)
  const updateTemplate = useScheduleTemplatesStore((s) => s.updateTemplate)

  const form = useForm<ScheduleTemplateForm>({
    resolver: zodResolver(formSchema),
    defaultValues: currentRow
      ? {
          name: currentRow.name,
          description: currentRow.description,
          start_date: currentRow.start_date,
          end_date: currentRow.end_date,
          from_time: currentRow.from_time,
          to_time: currentRow.to_time,
          status: currentRow.status,
          priority: currentRow.priority,
        }
      : {
          name: '',
          description: '',
          start_date: undefined,
          end_date: undefined,
          from_time: '08:00',
          to_time: '16:00',
          status: 'upcoming',
          priority: 'medium',
        },
  })

  const fromTime = useWatch({ control: form.control, name: 'from_time' })
  const toTime = useWatch({ control: form.control, name: 'to_time' })
  const duration =
    timeStringSchema.safeParse(fromTime).success &&
    timeStringSchema.safeParse(toTime).success
      ? formatDuration(fromTime, toTime)
      : '—'

  const onSubmit = (values: ScheduleTemplateForm) => {
    if (currentRow) {
      updateTemplate(currentRow.id, { ...currentRow, ...values })
      toast.success(`Schedule template "${values.name}" has been updated.`)
    } else {
      addTemplate({ id: generateId(), ...values })
      toast.success(`Schedule template "${values.name}" has been added.`)
    }
    form.reset()
    setCurrentRow(null)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader className='text-start'>
          <DialogTitle>
            {isEdit ? 'Edit schedule template' : 'Add schedule template'}
          </DialogTitle>
          <DialogDescription>
            Set the period the template covers and the hours it puts people on.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='schedule-template-form'
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
                    <Input placeholder='Summer hours' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      className='min-h-20 resize-y'
                      placeholder='What this template changes, and why.'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid gap-4 sm:grid-cols-2'>
              {DATE_FIELDS.map(({ name, label }) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem className='flex flex-col'>
                      <FormLabel>{label}</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type='button'
                              variant='outline'
                              className={cn(
                                'justify-start text-start font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className='me-2 size-4' />
                              {field.value
                                ? format(field.value, 'dd MMM yyyy')
                                : 'Select date'}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className='w-auto p-0' align='start'>
                          <Calendar
                            mode='single'
                            selected={field.value}
                            onSelect={field.onChange}
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <div className='grid gap-4 sm:grid-cols-3'>
              <FormField
                control={form.control}
                name='from_time'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <FormControl>
                      <Input type='time' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='to_time'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <FormControl>
                      <Input type='time' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Duration</FormLabel>
                <div className='flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-medium'>
                  {duration}
                </div>
              </FormItem>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <SelectDropdown
                      isControlled
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      placeholder='Select status'
                      items={STATUS_OPTIONS.map(({ label, value }) => ({
                        label,
                        value,
                      }))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='priority'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <SelectDropdown
                      isControlled
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                      placeholder='Select priority'
                      items={PRIORITY_OPTIONS.map(({ label, value }) => ({
                        label,
                        value,
                      }))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
          <Button type='submit' form='schedule-template-form'>
            {isEdit ? 'Save changes' : 'Add template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
