import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type PublicHoliday } from '../data/schema'
import { usePublicHolidaysStore } from '../stores/public-holidays-store'

const CONFIRM_WORD = 'DELETE'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<PublicHoliday>
}

export function PublicHolidaysMultiDeleteDialog({
  open,
  onOpenChange,
  table,
}: Props) {
  const [value, setValue] = useState('')
  const deleteHolidays = usePublicHolidaysStore((s) => s.deleteHolidays)
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const count = selectedRows.length

  const handleDelete = () => {
    if (value.trim() !== CONFIRM_WORD) return
    deleteHolidays(selectedRows.map((row) => row.original.id))
    table.resetRowSelection()
    setValue('')
    onOpenChange(false)
    toast.success(`Deleted ${count} public holiday${count === 1 ? '' : 's'}.`)
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='public-holidays-multi-delete-form'
      disabled={value.trim() !== CONFIRM_WORD}
      title={
        <span className='text-destructive'>
          <AlertTriangle className='me-1 inline-block' size={18} />
          Delete {count} public holiday{count === 1 ? '' : 's'}
        </span>
      }
      desc={
        <form
          id='public-holidays-multi-delete-form'
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
