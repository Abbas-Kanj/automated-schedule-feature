import { DataTable } from '@/components/data-table'
import { type Schedule } from '../data/schema'
import { schedulesColumns } from './schedules-columns'

type SchedulesTableProps = {
  data: Schedule[]
}

export function SchedulesTable({ data }: SchedulesTableProps) {
  return <DataTable columns={schedulesColumns} data={data} />
}
