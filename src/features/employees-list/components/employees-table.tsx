import { DataTable } from '@/components/data-table'
import { type Employee } from '@/features/employees/data/schema'
import { getEmployeeFullName } from '@/features/employees/utils'
import { employeesColumns } from './employees-columns'

type EmployeesTableProps = {
  data: Employee[]
}

export function EmployeesTable({ data }: EmployeesTableProps) {
  return (
    <DataTable
      columns={employeesColumns}
      data={data}
      searchPlaceholder='Search employees...'
      // There's no single `name` column to fall back on, so search across the
      // things someone actually knows an employee by.
      globalFilterFn={(row, _columnId, filterValue) => {
        const needle = String(filterValue).toLowerCase()
        const employee = row.original
        return (
          getEmployeeFullName(employee).toLowerCase().includes(needle) ||
          (employee.punch_code ?? '').toLowerCase().includes(needle) ||
          (employee.schedule ?? '').toLowerCase().includes(needle) ||
          employee.position.label.toLowerCase().includes(needle) ||
          employee.organization_unit.label.toLowerCase().includes(needle)
        )
      }}
    />
  )
}
