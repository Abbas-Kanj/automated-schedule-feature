import { useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { generateId } from '@/lib/id'
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
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog'
import { emptyShiftFormValues } from '../data/defaults'
import {
  type Shift,
  type ShiftFormValues,
  shiftFormSchema,
} from '../data/schema'
import { useDeriveShortCode } from '../hooks/use-derive-short-code'
import { useShiftsStore } from '../stores/shifts-store'
import { normalizeShiftFormValues } from '../utils'
import { ShiftFormTabs } from './shift-form/shift-form-tabs'

type ShiftFormDialogProps = {
  currentRow?: Shift
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Edits an existing shift (`currentRow` set) or creates a new one inline —
// create support stays for `schedules`' shift picker, which quick-creates a
// shift while building a schedule.
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
    defaultValues: isEdit ? currentRow : emptyShiftFormValues,
  })
  // react-hook-form's `isDirty` is gated behind a Proxy subscription that
  // only arms if read during render — reading it only in an event handler
  // leaves it stuck at `false`.
  const { isDirty } = form.formState
  useDeriveShortCode(form)

  const resetAndClose = () => {
    form.reset(isEdit ? currentRow : emptyShiftFormValues)
    onOpenChange(false)
  }

  // Radix routes every dismiss path through this one `onOpenChange(false)`
  // call — intercept it to confirm before discarding unsaved changes.
  const requestClose = () => {
    if (isDirty) {
      setConfirmCloseOpen(true)
    } else {
      resetAndClose()
    }
  }

  const onSubmit = (values: ShiftFormValues) => {
    const submitValues = normalizeShiftFormValues(values)

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
              <ShiftFormTabs />
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
