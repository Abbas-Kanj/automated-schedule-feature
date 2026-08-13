import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { type Resolver, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { type Shift, type ShiftFormValues, shiftFormSchema } from '../data/schema'
import { useShiftsStore } from '../stores/shifts-store'
import { deriveShortCode, generateId } from '../utils'
import { BadgeColorField } from './shift-form/badge-color-field'
import { IconPickerField } from './shift-form/icon-picker-field'

const emptyValues: ShiftFormValues = {
  name: '',
  short_code: '',
  badge_color: 'blue',
  icon: 'clock',
  from_time: '09:00',
  to_time: '17:00',
  overnight: false,
  description: '',
}

type ShiftFormDialogProps = {
  currentRow?: Shift
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShiftFormDialog({
  currentRow,
  open,
  onOpenChange,
}: ShiftFormDialogProps) {
  const isEdit = !!currentRow
  const addShift = useShiftsStore((s) => s.addShift)
  const updateShift = useShiftsStore((s) => s.updateShift)

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema) as Resolver<ShiftFormValues>,
    defaultValues: isEdit ? currentRow : emptyValues,
  })

  const name = useWatch({ control: form.control, name: 'name' })
  useEffect(() => {
    form.setValue('short_code', deriveShortCode(name ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  const onSubmit = (values: ShiftFormValues) => {
    if (isEdit) {
      updateShift(currentRow.id, { id: currentRow.id, ...values })
      toast.success(`Shift "${values.name}" has been updated.`)
    } else {
      addShift({ id: generateId(), ...values })
      toast.success(`Shift "${values.name}" has been created.`)
    }
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        form.reset(isEdit ? currentRow : emptyValues)
        onOpenChange(state)
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? 'Edit Shift' : 'Create Shift'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this shift definition.'
              : 'Define a reusable shift with its name, time range and look.'}
          </DialogDescription>
        </DialogHeader>
        <div className='h-105 w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'>
          <Form {...form}>
            <form
              id='shift-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-4 px-0.5'
            >
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='e.g. Morning shift'
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='short_code'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short code</FormLabel>
                    <FormControl>
                      <Input
                        disabled
                        readOnly
                        placeholder='Auto filled from the first letters of the name'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid gap-3 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='badge_color'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Badge color</FormLabel>
                      <FormControl>
                        <BadgeColorField
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='icon'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <FormControl>
                        <IconPickerField
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='flex items-start gap-2'>
                <FormField
                  control={form.control}
                  name='from_time'
                  render={({ field }) => (
                    <FormItem className='flex-1'>
                      <FormLabel>From</FormLabel>
                      <FormControl>
                        <Input type='time' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <span className='text-muted-foreground pt-8 text-sm'>to</span>
                <FormField
                  control={form.control}
                  name='to_time'
                  render={({ field }) => (
                    <FormItem className='flex-1'>
                      <FormLabel>To</FormLabel>
                      <FormControl>
                        <Input type='time' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='overnight'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-md border p-3'>
                    <FormLabel className='cursor-pointer'>
                      Ends the next day (overnight)
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
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
                        placeholder='Optional notes about this shift'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button type='submit' form='shift-form'>
            {isEdit ? 'Save changes' : 'Create shift'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
