import { type Resolver, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { generateId } from '@/lib/id'
import { emptyShiftFormValues } from '../data/defaults'
import {
  type Shift,
  type ShiftFormValues,
  shiftFormSchema,
} from '../data/schema'
import { useShiftsStore } from '../stores/shifts-store'
import { normalizeShiftFormValues } from '../utils'
import { useDeriveShortCode } from './use-derive-short-code'

// The create/edit form shared by the shift page and the quick-create dialog:
// seeding, short-code derivation, and saving to the store. Each caller owns
// its own chrome and what "done" means (`onSaved`).
export function useShiftForm(
  currentShift: Shift | undefined,
  onSaved: () => void
) {
  const addShift = useShiftsStore((s) => s.addShift)
  const updateShift = useShiftsStore((s) => s.updateShift)

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema) as Resolver<ShiftFormValues>,
    defaultValues: currentShift ?? emptyShiftFormValues,
  })
  // react-hook-form's `isDirty` is gated behind a Proxy subscription that
  // only arms if read during render — reading it only in an event handler
  // leaves it stuck at `false`.
  const { isDirty } = form.formState
  useDeriveShortCode(form)

  const onSubmit = form.handleSubmit((values) => {
    const submitValues = normalizeShiftFormValues(values)
    if (currentShift) {
      updateShift(currentShift.id, { id: currentShift.id, ...submitValues })
      toast.success(`Shift "${values.name}" has been updated.`)
    } else {
      addShift({ id: generateId(), ...submitValues })
      toast.success(`Shift "${values.name}" has been created.`)
    }
    onSaved()
  })

  return { form, isDirty, isEdit: !!currentShift, onSubmit }
}
