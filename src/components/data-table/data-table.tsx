import { useState } from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Table as TableInstance,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from './pagination'
import { DataTableToolbar } from './toolbar'

type DataTableProps<TData> = {
  columns: ColumnDef<TData>[]
  data: TData[]
  searchPlaceholder?: string
  // Search a single column instead of the whole row. Leave unset for the
  // default global search (see `globalFilterFn`); set it when the column's
  // own `filterFn` is what should decide, as the holidays table does.
  searchKey?: string
  // Faceted dropdown filters rendered next to the search box. Each entry
  // targets a column that declares a `filterFn` — see `PublicHolidaysTable`.
  filters?: {
    columnId: string
    title: string
    options: { label: string; value: string }[]
  }[]
  // Defaults to a case-insensitive match on the row's `name` column, which
  // is what every table in this app searches by. Pass one to search more
  // than that (see `PoliciesTable`, which also matches the type label).
  globalFilterFn?: FilterFn<TData>
  // Render prop for a selection toolbar. Passing it is what turns row
  // selection on — the `select` checkbox column still has to be in
  // `columns` (see `publicHolidaysColumns`).
  bulkActions?: (table: TableInstance<TData>) => React.ReactNode
  pageSize?: number
  className?: string
}

// Case-insensitive contains-match on the `name` column.
function filterByName<TData>(): FilterFn<TData> {
  return (row, _columnId, filterValue) =>
    String(row.getValue('name'))
      .toLowerCase()
      .includes(String(filterValue).toLowerCase())
}

// The sortable/filterable/paginated table shell shared by the schedules,
// shifts, shift-policies, public-holidays and schedule-templates tables —
// toolbar on top, pagination pinned to the bottom. Everything
// table-specific arrives through `columns`, `filters` and `globalFilterFn`;
// the markup itself lives here once.
export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = 'Filter by name...',
  searchKey,
  filters,
  globalFilterFn,
  bulkActions,
  pageSize = 10,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
      rowSelection,
    },
    enableRowSelection: !!bulkActions,
    globalFilterFn: globalFilterFn ?? filterByName<TData>(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Only walked when a faceted filter asks for its option counts.
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
  })

  return (
    <div className={cn('flex flex-1 flex-col gap-4', className)}>
      <DataTableToolbar
        table={table}
        searchPlaceholder={searchPlaceholder}
        searchKey={searchKey}
        filters={filters}
      />
      <div className='overflow-hidden rounded-md border'>
        <Table className='min-w-xl'>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      header.column.columnDef.meta?.className,
                      header.column.columnDef.meta?.thClassName
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
      {bulkActions?.(table)}
    </div>
  )
}
