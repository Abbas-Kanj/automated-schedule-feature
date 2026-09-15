import { type DefaultValues } from 'react-hook-form'
import { type ShiftPolicyFormValues } from './schema'

// Rules start empty; `PolicyRulesField` seeds the first one on mount.
export const emptyShiftPolicyFormValues: DefaultValues<ShiftPolicyFormValues> =
  {
    name: '',
    description: '',
    rules: [],
  }
