import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useTeamsStore } from '../stores/teams-store'
import { TeamFormDialog } from './team-form-dialog'
import { useTeams } from './teams-provider'

export function TeamsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useTeams()
  const deleteTeam = useTeamsStore((s) => s.deleteTeam)

  return (
    <>
      <TeamFormDialog
        key='team-create'
        open={open === 'create'}
        onOpenChange={(state) => setOpen(state ? 'create' : null)}
      />

      {currentRow && (
        <>
          <TeamFormDialog
            key={`team-edit-${currentRow.id}`}
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
            key='team-delete'
            destructive
            open={open === 'delete'}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            handleConfirm={() => {
              deleteTeam(currentRow.id)
              setOpen(null)
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
              toast.success(`Team "${currentRow.name}" has been deleted.`)
            }}
            className='max-w-md'
            title={`Delete this team: ${currentRow.name} ?`}
            desc={
              <>
                You are about to delete the team{' '}
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
