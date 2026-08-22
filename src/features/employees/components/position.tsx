import { type UseFormReturn } from 'react-hook-form'
import { type Employee } from '../data/schema'

type Props = {
  form: UseFormReturn<Employee>
}

// Placeholder tab — the position fields aren't built out yet.
export const Position = (_props: Props) => {
  return <div>position</div>
}
