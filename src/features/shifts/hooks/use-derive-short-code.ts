import { useEffect } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { type ShiftFormValues } from '../data/schema'
import { deriveShortCode } from '../utils'

// Keeps `short_code` in sync with `name` as it's typed — shared by both the
// "Create shift" page and the "Edit shift" dialog (see
// `pages/create/shift-create-page.tsx` / `shift-form-dialog.tsx`).
export function useDeriveShortCode(form: UseFormReturn<ShiftFormValues>) {
  const name = useWatch({ control: form.control, name: 'name' })
  useEffect(() => {
    form.setValue('short_code', deriveShortCode(name ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])
}
