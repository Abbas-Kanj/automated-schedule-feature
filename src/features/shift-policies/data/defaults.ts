import { type DefaultValues } from 'react-hook-form'
import { type ShiftPolicyFormValues } from './schema'

// Starting point for a brand-new policy. `policy_type` is deliberately
// absent — the form starts with nothing selected (the rules section only
// appears once a type is picked) and the schema rejects a submit without
// one, which `DefaultValues` models without a cast.
export const emptyShiftPolicyFormValues: DefaultValues<ShiftPolicyFormValues> =
  {
    name: '',
    description: '',
    rules: [],
  }
