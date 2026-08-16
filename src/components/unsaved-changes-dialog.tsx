import { ConfirmDialog } from './confirm-dialog'

type UnsavedChangesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

// Reusable "discard unsaved changes?" confirmation for any form dialog.
// Pair it with a dirty check in the owning dialog's own `onOpenChange`:
// intercept the `state === false` case (fired by an outside click,
// Escape, or the built-in close button — Radix's Dialog routes all three
// through the same callback) and, if the form is dirty, open this instead
// of closing directly; only call the real close once the user confirms.
// See `ShiftFormDialog` for the reference wiring.
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
