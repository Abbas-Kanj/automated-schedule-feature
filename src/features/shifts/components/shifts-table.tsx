import { DataTable } from '@/components/data-table'
import { type Shift } from '../data/schema'
import { shiftsColumns } from './shifts-columns'

type ShiftsTableProps = {
  data: Shift[]
}

export function ShiftsTable({ data }: ShiftsTableProps) {
  return <DataTable columns={shiftsColumns} data={data} />
}
