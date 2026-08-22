import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import EmployeesPage from '@/features/employees'

// `/employees` doubles as the add and the edit screen — the row menu in
// `/employees-list` links here with `?action=edit&employeeId=...`.
const employeesSearchSchema = z.object({
  action: z.enum(['edit']).optional().catch(undefined),
  employeeId: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/employees')({
  validateSearch: employeesSearchSchema,
  component: EmployeesPage,
})
