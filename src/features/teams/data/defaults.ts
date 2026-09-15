import { type DefaultValues } from 'react-hook-form'
import { type TeamFormValues } from './schema'

export const emptyTeamFormValues: DefaultValues<TeamFormValues> = {
  name: '',
  description: '',
  employee_ids: [],
}
