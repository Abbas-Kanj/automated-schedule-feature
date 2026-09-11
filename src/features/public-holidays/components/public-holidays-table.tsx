import { DataTable } from '@/components/data-table'
import { FIXED_OPTIONS } from '../data/data'
import { type PublicHoliday } from '../data/schema'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { publicHolidaysColumns } from './public-holidays-columns'

type PublicHolidaysTableProps = {
  data: PublicHoliday[]
}

export function PublicHolidaysTable({ data }: PublicHolidaysTableProps) {
  return (
    <DataTable
      columns={publicHolidaysColumns}
      data={data}
      searchPlaceholder='Search holidays...'
      searchKey='name'
      filters={[
        {
          columnId: 'fixed',
          title: 'Fixed',
          options: FIXED_OPTIONS.map(({ label, value }) => ({ label, value })),
        },
      ]}
      bulkActions={(table) => <DataTableBulkActions table={table} />}
    />
  )
}
