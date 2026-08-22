import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'

const CONFIRM_WORD = 'DELETE'

type Props<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<TData>
}

export function OfficialHolidaysMultiDeleteDialog<TData>({
  open,
  onOpenChange,
  table,
}: Props<TData>) {
  const [value, setValue] = useState('')
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const handleDelete = () => {
    if (value.trim() !== CONFIRM_WORD) return
    onOpenChange(false)
    toast.promise(sleep(1000), {
      loading: 'Deleting official holidays...',
      success: () => {
        setValue('')
        table.resetRowSelection()
        return `Deleted ${selectedRows.length} official holiday${selectedRows.length === 1 ? '' : 's'}`
      },
      error: 'Error deleting official holidays',
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='official-holidays-multi-delete-form'
      disabled={value.trim() !== CONFIRM_WORD}
      title={
        <span className='text-destructive'>
          <AlertTriangle className='me-1 inline-block' size={18} />
          Delete {selectedRows.length} official holiday
          {selectedRows.length === 1 ? '' : 's'}
        </span>
      }
      desc={
        <form
          id='official-holidays-multi-delete-form'
          onSubmit={(event) => {
            event.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p>This action cannot be undone.</p>
          <Label className='flex flex-col items-start gap-1.5'>
            Confirm by typing "{CONFIRM_WORD}":
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
            />
          </Label>
          <Alert variant='destructive'>
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
              The selected holidays will be permanently removed.
            </AlertDescription>
          </Alert>
        </form>
      }
      confirmText='Delete'
      destructive
    />
  )
}
