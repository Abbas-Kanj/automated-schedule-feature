import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { type Resolver, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type Shift, type ShiftFormValues, shiftFormSchema } from '../data/schema'
import { useShiftsStore } from '../stores/shifts-store'
import { buildDefaultDays, deriveShortCode, generateId } from '../utils'
import { AdditionalInfoTab } from './shift-form/additional-info-tab'
import { GeneralTab } from './shift-form/general-tab'
import { RepeatTab } from './shift-form/repeat-tab'

const emptyValues: ShiftFormValues = {
  name: '',
  short_code: '',
  badge_color: 'blue',
  icon: 'clock',
  shift_type: 'fixed',
  category: 'regular',
  custom_category: '',
  timezone_mode: 'local',
  timezone: undefined,
  hours_mode: 'same',
  days: buildDefaultDays({
    from_time: '09:00',
    to_time: '17:00',
    overnight: false,
  }),
  break_enabled: false,
  break_type: undefined,
  breaks: [],
  description: '',
  is_active: true,
  policy_type: undefined,
  status: 'tentative',
  time_slot_type: 'regular',
  repeat_enabled: false,
  repeat: {},
  work_type_group: undefined,
  service_resource: undefined,
  service_territory: undefined,
}

type ShiftFormDialogProps = {
  currentRow?: Shift
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TAB_CONTENT_CLASSNAME =
  'max-h-[60vh] w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'

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
    // "Local" mode doesn't carry a chosen zone — the shift just follows
    // wherever it's viewed from, so we don't persist a stale snapshot.
    const submitValues: ShiftFormValues = {
      ...values,
      timezone: values.timezone_mode === 'local' ? undefined : values.timezone,
      custom_category:
        values.category === 'custom' ? values.custom_category : undefined,
      repeat: values.repeat_enabled ? values.repeat : {},
      breaks: values.break_enabled ? values.breaks : [],
    }

    if (isEdit) {
      updateShift(currentRow.id, { id: currentRow.id, ...submitValues })
      toast.success(`Shift "${values.name}" has been updated.`)
    } else {
      addShift({ id: generateId(), ...submitValues })
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
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader className='text-start'>
          <DialogTitle>{isEdit ? 'Edit Shift' : 'Create Shift'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this shift definition.'
              : 'Define a reusable shift with its name, time range and look.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='shift-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <Tabs defaultValue='general'>
              <TabsList variant='line' className='w-full'>
                <TabsTrigger value='general'>General</TabsTrigger>
                <TabsTrigger value='repeat'>Repeat shifts</TabsTrigger>
                <TabsTrigger value='additional'>Additional info</TabsTrigger>
              </TabsList>

              <TabsContent value='general' className={TAB_CONTENT_CLASSNAME}>
                <GeneralTab />
              </TabsContent>

              <TabsContent value='repeat' className={TAB_CONTENT_CLASSNAME}>
                <RepeatTab />
              </TabsContent>

              <TabsContent value='additional' className={TAB_CONTENT_CLASSNAME}>
                <AdditionalInfoTab />
              </TabsContent>
            </Tabs>
          </form>
        </Form>
        <DialogFooter>
          <Button type='submit' form='shift-form'>
            {isEdit ? 'Save changes' : 'Create shift'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
