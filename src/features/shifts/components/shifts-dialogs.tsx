import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ShiftFormDialog } from './shift-form-dialog'
import { ShiftPolicyDrawer } from './shift-policy-drawer'
import { useShiftsStore } from '../stores/shifts-store'
import { useShifts } from './shifts-provider'

export function ShiftsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useShifts()
  const deleteShift = useShiftsStore((s) => s.deleteShift)

  return (
    <>
      <ShiftFormDialog
        key='shift-create'
        open={open === 'create'}
        onOpenChange={() => setOpen('create')}
      />

      {currentRow && (
        <>
          <ShiftFormDialog
            key={`shift-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <ConfirmDialog
            key='shift-delete'
            destructive
            open={open === 'delete'}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            handleConfirm={() => {
              deleteShift(currentRow.id)
              setOpen(null)
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
              toast.success(`Shift "${currentRow.name}" has been deleted.`)
            }}
            className='max-w-md'
            title={`Delete this shift: ${currentRow.name} ?`}
            desc={
              <>
                You are about to delete the shift{' '}
                <strong>{currentRow.name}</strong>. <br />
                This action cannot be undone.
              </>
            }
            confirmText='Delete'
          />

          <ShiftPolicyDrawer
            key={`shift-policy-${currentRow.id}`}
            shift={currentRow}
            open={open === 'policy'}
            onOpenChange={() => {
              setOpen('policy')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
          />
        </>
      )}
    </>
  )
}
