import { useState } from 'react'
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
import { type Shift } from '../data/schema'
import { useShiftForm } from '../hooks/use-shift-form'
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
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const { form, isDirty, isEdit, onSubmit } = useShiftForm(currentRow, () =>
    onOpenChange(false)
  )

  const resetAndClose = () => {
    form.reset(currentRow ?? emptyShiftFormValues)
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
            <form id='shift-form' onSubmit={onSubmit} className='space-y-4'>
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
