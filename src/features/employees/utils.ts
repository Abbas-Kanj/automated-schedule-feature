import { type Employee } from './data/schema'

// Full display name for an employee — "First Middle Last", skipping any
// blank part. Used wherever an employee is shown by name (e.g. the Team
// Management member picker and table).
export function getEmployeeFullName(employee: Employee): string {
  return [employee.firstname, employee.middlename, employee.lastname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
}
