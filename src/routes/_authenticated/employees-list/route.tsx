import { createFileRoute } from '@tanstack/react-router'
import EmployeesListPage from '@/features/employees-list'

export const Route = createFileRoute('/_authenticated/employees-list')({
  component: EmployeesListPage,
})
