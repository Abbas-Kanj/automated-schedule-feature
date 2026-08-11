import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useSchedulesStore } from '../stores/schedules-store'
import { useSchedules } from './schedules-provider'

export function SchedulesDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useSchedules()
  const deleteSchedule = useSchedulesStore((s) => s.deleteSchedule)

  return (
    <>
      {currentRow && (
        <>
          <ConfirmDialog
            key='schedule-delete'
            destructive
            open={open === 'delete'}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            handleConfirm={() => {
              deleteSchedule(currentRow.id)
              setOpen(null)
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
              toast.success(`Schedule "${currentRow.name}" has been deleted.`)
            }}
            className='max-w-md'
            title={`Delete this schedule: ${currentRow.name} ?`}
            desc={
              <>
                You are about to delete the schedule{' '}
                <strong>{currentRow.name}</strong>. <br />
                This action cannot be undone.
              </>
            }
            confirmText='Delete'
          />
        </>
      )}
    </>
  )
}
