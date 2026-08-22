import { type UseFormReturn } from 'react-hook-form'
import { type Employee } from '../data/schema'

type Props = {
  form: UseFormReturn<Employee>
}

// Placeholder tab — the schedule fields aren't built out yet.
export const Schedule = (_props: Props) => {
  return <div>Schedule</div>
}
