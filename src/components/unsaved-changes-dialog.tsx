import { ConfirmDialog } from './confirm-dialog'

type UnsavedChangesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

// Pair with a dirty check in the owning dialog's `onOpenChange`: Radix routes
// outside-click, Escape and the close button all through `state === false`,
// so intercept that case and open this instead of closing when dirty.
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onConfirm,
}: UnsavedChangesDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={onConfirm}
      title='Discard unsaved changes?'
      desc='You have unsaved changes. Are you sure you want to close without saving?'
      cancelBtnText='Keep editing'
      confirmText='Discard changes'
      destructive
    />
  )
}
