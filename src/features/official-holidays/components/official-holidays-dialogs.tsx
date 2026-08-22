import { OfficialHolidaysActionDialog } from './official-holidays-action-dialog'
import { OfficialHolidaysDeleteDialog } from './official-holidays-delete-dialog'
import { useOfficialHolidays } from './official-holidays-provider'

export function OfficialHolidaysDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useOfficialHolidays()
  return (
    <>
      <OfficialHolidaysActionDialog
        key='official-holiday-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />
      {currentRow && (
        <>
          <OfficialHolidaysActionDialog
            key={`official-holiday-edit-${currentRow.id}`}
            open={open === 'edit'}
            currentRow={currentRow}
            onOpenChange={() => {
              setOpen('edit')
              setTimeout(() => setCurrentRow(null), 500)
            }}
          />
          <OfficialHolidaysDeleteDialog
            key={`official-holiday-delete-${currentRow.id}`}
            open={open === 'delete'}
            currentRow={currentRow}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => setCurrentRow(null), 500)
            }}
          />
        </>
      )}
    </>
  )
}
