import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usePoliciesStore } from '../stores/policies-store'
import { usePolicies } from './policies-provider'
import { PolicyFormDialog } from './policy-form-dialog'

export function PoliciesDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = usePolicies()
  const deletePolicy = usePoliciesStore((s) => s.deletePolicy)

  return (
    <>
      <PolicyFormDialog
        key='policy-create'
        open={open === 'create'}
        onOpenChange={(state) => setOpen(state ? 'create' : null)}
      />

      {currentRow && (
        <>
          <PolicyFormDialog
            key={`policy-edit-${currentRow.id}`}
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
            key='policy-delete'
            destructive
            open={open === 'delete'}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            handleConfirm={() => {
              deletePolicy(currentRow.id)
              setOpen(null)
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
              toast.success(`Policy "${currentRow.name}" has been deleted.`)
            }}
            className='max-w-md'
            title={`Delete this policy: ${currentRow.name} ?`}
            desc={
              <>
                You are about to delete the policy{' '}
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
