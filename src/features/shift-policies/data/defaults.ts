import { type DefaultValues } from 'react-hook-form'
import { type ShiftPolicyFormValues } from './schema'

// Starting point for a brand-new policy. Rules start empty and
// `PolicyRulesField` seeds the first one on mount — the type now lives on
// each rule, so there is nothing policy-wide left to pick.
export const emptyShiftPolicyFormValues: DefaultValues<ShiftPolicyFormValues> =
  {
    name: '',
    description: '',
    rules: [],
  }
