import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useScheduleTemplatesStore } from '../stores/schedule-templates-store'
import { ScheduleTemplateActionDialog } from './schedule-template-action-dialog'
import { useScheduleTemplates } from './schedule-templates-provider'

export function ScheduleTemplatesDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useScheduleTemplates()
  const deleteTemplate = useScheduleTemplatesStore((s) => s.deleteTemplate)

  return (
    <>
      <ScheduleTemplateActionDialog
        key='schedule-template-create'
        open={open === 'create'}
        onOpenChange={(state) => setOpen(state ? 'create' : null)}
      />

      {currentRow && (
        <>
          <ScheduleTemplateActionDialog
            key={`schedule-template-edit-${currentRow.id}`}
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
            key='schedule-template-delete'
            destructive
            open={open === 'delete'}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            handleConfirm={() => {
              deleteTemplate(currentRow.id)
              setOpen(null)
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
              toast.success(
                `Schedule template "${currentRow.name}" has been deleted.`
              )
            }}
            className='max-w-md'
            title={`Delete this template: ${currentRow.name} ?`}
            desc={
              <>
                You are about to delete the schedule template{' '}
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
