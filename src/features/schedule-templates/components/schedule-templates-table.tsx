import { DataTable } from '@/components/data-table'
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '../data/data'
import { type ScheduleTemplate } from '../data/schema'
import { scheduleTemplatesColumns } from './schedule-templates-columns'

type ScheduleTemplatesTableProps = {
  data: ScheduleTemplate[]
}

export function ScheduleTemplatesTable({ data }: ScheduleTemplatesTableProps) {
  return (
    <DataTable
      columns={scheduleTemplatesColumns}
      data={data}
      searchPlaceholder='Search templates...'
      // Name and description — a template is as often remembered by what it
      // does as by what it is called.
      globalFilterFn={(row, _columnId, filterValue) => {
        const needle = String(filterValue).toLowerCase()
        return (
          row.original.name.toLowerCase().includes(needle) ||
          row.original.description.toLowerCase().includes(needle)
        )
      }}
      filters={[
        {
          columnId: 'status',
          title: 'Status',
          options: STATUS_OPTIONS.map(({ label, value }) => ({
            label,
            value,
          })),
        },
        {
          columnId: 'priority',
          title: 'Priority',
          options: PRIORITY_OPTIONS.map(({ label, value }) => ({
            label,
            value,
          })),
        },
      ]}
    />
  )
}
