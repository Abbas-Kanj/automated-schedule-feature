import { useEffect } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { type ShiftFormValues } from '../data/schema'
import { deriveShortCode } from '../utils'

// Keeps `short_code` in sync with `name` as it's typed. Leaves a stored code
// alone until the name actually changes — saved codes (e.g. "AFT" for
// "Afternoon") don't all follow the derivation rule, and re-deriving on open
// would rewrite them on the next save.
export function useDeriveShortCode(form: UseFormReturn<ShiftFormValues>) {
  const name = useWatch({ control: form.control, name: 'name' })
  useEffect(() => {
    if ((name ?? '') === (form.formState.defaultValues?.name ?? '')) return
    form.setValue('short_code', deriveShortCode(name ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])
}
