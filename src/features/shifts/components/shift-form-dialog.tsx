import { useEffect, useState } from 'react'
import { type Resolver, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog'
import {
  type Shift,
  type ShiftFormValues,
  shiftFormSchema,
} from '../data/schema'
import { useShiftsStore } from '../stores/shifts-store'
import { buildDefaultDays, deriveShortCode, generateId } from '../utils'
import { AssignToTab } from './shift-form/assign-to-tab'
import { GeneralTab } from './shift-form/general-tab'
import { RepeatTab } from './shift-form/repeat-tab'
import { ShiftPolicyTab } from './shift-form/shift-policy-tab'
import { ShiftTimesTab } from './shift-form/shift-times-tab'

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
  // All 7 days start off — the "Shift times" tab's day toggles are opt-in,
  // not a pre-filled default week.
  days: buildDefaultDays(
    {
      from_time: '09:00',
      to_time: '17:00',
      overnight: false,
    },
    false
  ),
  break_enabled: false,
  break_type: undefined,
  breaks: [],
  description: '',
  is_active: true,
  policy_type: undefined,
  status: 'tentative',
  time_slot_type: 'regular',
  repeat_enabled: false,
  // "Days" (frequency: 'daily') and "Never ends" are the Repeat tab's
  // defaults — pre-selected even while the tab's disabled, rather than
  // starting blank.
  repeat: { frequency: 'daily', end_type: 'never' },
  assign_to_enabled: false,
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
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema) as Resolver<ShiftFormValues>,
    defaultValues: isEdit ? currentRow : emptyValues,
  })
  // react-hook-form only computes `isDirty` if something reads it during
  // render — it's gated behind a Proxy subscription for performance, so
  // reading it only inside an event handler (as `requestClose` below
  // does) leaves it permanently stuck at its initial `false`. Destructure
  // it here, at render time, to actually arm the subscription.
  const { isDirty } = form.formState

  // Resets the form back to its defaults/currentRow and actually closes.
  // Only ever called once we know it's safe to discard whatever's typed —
  // either the form wasn't dirty, or the user confirmed the discard.
  const resetAndClose = () => {
    form.reset(isEdit ? currentRow : emptyValues)
    onOpenChange(false)
  }

  // Radix's Dialog routes every dismiss path (outside click, Escape, the
  // built-in close button) through this one `onOpenChange(false)` call —
  // intercept it and, if there's something to lose, confirm first instead
  // of discarding silently. See `UnsavedChangesDialog`.
  const requestClose = () => {
    if (isDirty) {
      setConfirmCloseOpen(true)
    } else {
      resetAndClose()
    }
  }

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
      work_type_group: values.assign_to_enabled
        ? values.work_type_group
        : undefined,
      service_resource: values.assign_to_enabled
        ? values.service_resource
        : undefined,
      service_territory: values.assign_to_enabled
        ? values.service_territory
        : undefined,
    }

    if (isEdit) {
      updateShift(currentRow.id, { id: currentRow.id, ...submitValues })
      toast.success(`Shift "${values.name}" has been updated.`)
    } else {
      const newShift = { id: generateId(), ...submitValues }
      // No backend wired up yet — log the payload so it's easy to inspect
      // and copy out during development.
      // eslint-disable-next-line no-console
      console.log(
        'Shift form submitted — JSON payload:',
        JSON.stringify(newShift, null, 2)
      )
      addShift(newShift)
      toast.success(`Shift "${values.name}" has been created.`)
    }
    onOpenChange(false)
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(state) => {
          if (!state) {
            requestClose()
            return
          }
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
                  <TabsTrigger value='shift-times'>Shift times</TabsTrigger>
                  <TabsTrigger value='shift-policy'>Shift policy</TabsTrigger>
                  <TabsTrigger value='repeat'>Repeat</TabsTrigger>
                  <TabsTrigger value='assign-to'>Assign to</TabsTrigger>
                </TabsList>

                <TabsContent value='general' className={TAB_CONTENT_CLASSNAME}>
                  <GeneralTab />
                </TabsContent>

                <TabsContent
                  value='shift-times'
                  className={TAB_CONTENT_CLASSNAME}
                >
                  <ShiftTimesTab />
                </TabsContent>

                <TabsContent
                  value='shift-policy'
                  className={TAB_CONTENT_CLASSNAME}
                >
                  <ShiftPolicyTab />
                </TabsContent>

                <TabsContent value='repeat' className={TAB_CONTENT_CLASSNAME}>
                  <RepeatTab />
                </TabsContent>

                <TabsContent
                  value='assign-to'
                  className={TAB_CONTENT_CLASSNAME}
                >
                  <AssignToTab />
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
      <UnsavedChangesDialog
        open={confirmCloseOpen}
        onOpenChange={setConfirmCloseOpen}
        onConfirm={() => {
          setConfirmCloseOpen(false)
          resetAndClose()
        }}
      />
    </>
  )
}
