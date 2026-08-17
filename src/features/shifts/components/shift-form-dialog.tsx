import { useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
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
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog'
import { emptyShiftFormValues } from '../data/defaults'
import { type Shift, type ShiftFormValues, shiftFormSchema } from '../data/schema'
import { useDeriveShortCode } from '../hooks/use-derive-short-code'
import { useShiftsStore } from '../stores/shifts-store'
import { generateId, normalizeShiftFormValues } from '../utils'
import { ShiftFormTabs } from './shift-form/shift-form-tabs'

type ShiftFormDialogProps = {
  currentRow?: Shift
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Edits an existing shift (`currentRow` set) or creates a new one inline
// (no `currentRow`) — the shifts feature's own "Create Shift" button no
// longer uses this (see `pages/create/shift-create-page.tsx`, wired from
// `features/shifts/index.tsx`), but `schedules`' shift picker still opens
// this dialog for its own "quick-create a shift while building a
// schedule" flow, so create support stays here for that consumer.
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
  // react-hook-form only computes `isDirty` if something reads it during
  // render — it's gated behind a Proxy subscription for performance, so
  // reading it only inside an event handler (as `requestClose` below
  // does) leaves it permanently stuck at its initial `false`. Destructure
  // it here, at render time, to actually arm the subscription.
  const { isDirty } = form.formState
  useDeriveShortCode(form)

  // Resets the form back to its defaults/currentRow and actually closes.
  // Only ever called once we know it's safe to discard whatever's typed —
  // either the form wasn't dirty, or the user confirmed the discard.
  const resetAndClose = () => {
    form.reset(isEdit ? currentRow : emptyShiftFormValues)
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
