import employeeData from '@/features/employees/data/data.json'
import { type Employee } from '@/features/employees/data/schema'
import { getEmployeeFullName } from '@/features/employees/utils'

// Derived from the one employee directory, not a parallel list, so a saved
// schedule's ids match every other feature referencing employees.
export const employees = (employeeData as Employee[]).map((employee) => ({
  value: employee.id as string,
  label: getEmployeeFullName(employee),
}))
