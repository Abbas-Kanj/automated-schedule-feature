import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { OfficialHolidaysMultiDeleteDialog } from './official-holidays-multi-delete-dialog'

export function DataTableBulkActions<TData>({
  table,
}: {
  table: Table<TData>
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  return (
    <>
      <BulkActionsToolbar table={table} entityName='official holiday'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              className='size-8'
              onClick={() => setShowDeleteConfirm(true)}
              aria-label='Delete selected official holidays'
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete selected official holidays</TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>
      <OfficialHolidaysMultiDeleteDialog
        table={table}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      />
    </>
  )
}
