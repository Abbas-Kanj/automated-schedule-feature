import employeeData from '@/features/employees/data/data.json'
import { type Employee } from '@/features/employees/data/schema'
import { getEmployeeFullName } from '@/features/employees/utils'

// The daily-schedule form's employee picker options. Derived from the one
// employee directory rather than kept as a parallel hand-written list, so
// the ids a saved schedule stores are the same ones every other feature
// (shifts' "Assign to", teams, the rotation roster) references.
export const employees = (employeeData as Employee[]).map((employee) => ({
  value: employee.id as string,
  label: getEmployeeFullName(employee),
}))
