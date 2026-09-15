import { type Employee } from './data/schema'

// "First Middle Last", skipping any blank part.
export function getEmployeeFullName(employee: Employee): string {
  return [employee.firstname, employee.middlename, employee.lastname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
}
