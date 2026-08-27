import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usePublicHolidaysStore } from '../stores/public-holidays-store'
import { PublicHolidaysActionDialog } from './public-holidays-action-dialog'
import { usePublicHolidays } from './public-holidays-provider'

export function PublicHolidaysDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = usePublicHolidays()
  const deleteHoliday = usePublicHolidaysStore((s) => s.deleteHoliday)

  return (
    <>
      <PublicHolidaysActionDialog
        key='public-holiday-create'
        open={open === 'create'}
        onOpenChange={(state) => setOpen(state ? 'create' : null)}
      />

      {currentRow && (
        <>
          <PublicHolidaysActionDialog
            key={`public-holiday-edit-${currentRow.id}`}
            currentRow={currentRow}
            open={open === 'edit'}
            onOpenChange={(state) => {
              setOpen(state ? 'edit' : null)
              if (!state) {
                setTimeout(() => {
                  setCurrentRow(null)
                }, 500)
              }
            }}
          />

          <ConfirmDialog
            key='public-holiday-delete'
            destructive
            open={open === 'delete'}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            handleConfirm={() => {
              deleteHoliday(currentRow.id)
              setOpen(null)
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
              toast.success(
                `Public holiday "${currentRow.name}" has been deleted.`
              )
            }}
            className='max-w-md'
            title={`Delete this holiday: ${currentRow.name} ?`}
            desc={
              <>
                You are about to delete <strong>{currentRow.name}</strong> and
                the {currentRow.holiday_dates.length} day
                {currentRow.holiday_dates.length === 1 ? '' : 's'} it covers.{' '}
                <br />
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
