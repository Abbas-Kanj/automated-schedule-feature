import { type DefaultValues } from 'react-hook-form'
import { type TeamFormValues } from './schema'

// Starting point for a brand-new team — an empty name/description and no
// members yet.
export const emptyTeamFormValues: DefaultValues<TeamFormValues> = {
  name: '',
  description: '',
  employee_ids: [],
}
