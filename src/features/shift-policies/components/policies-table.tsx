import { DataTable } from '@/components/data-table'
import { getPolicyTypeLabel } from '../data/data'
import { type ShiftPolicy } from '../data/schema'
import { policiesColumns } from './policies-columns'

type PoliciesTableProps = {
  data: ShiftPolicy[]
}

export function PoliciesTable({ data }: PoliciesTableProps) {
  return (
    <DataTable
      columns={policiesColumns}
      data={data}
      searchPlaceholder='Search policies...'
      // Name and type label — the two things someone scanning this table
      // actually knows a policy by.
      globalFilterFn={(row, _columnId, filterValue) => {
        const needle = String(filterValue).toLowerCase()
        return (
          row.original.name.toLowerCase().includes(needle) ||
          getPolicyTypeLabel(row.original.policy_type)
            .toLowerCase()
            .includes(needle)
        )
      }}
    />
  )
}
