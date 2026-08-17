import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type Shift } from '../data/schema'

// 'create' isn't a dialog anymore — creating a shift navigates to its own
// page instead (see `pages/create/shift-create-page.tsx`).
export type ShiftsDialogType = 'edit' | 'delete' | 'policy'

type ShiftsContextType = {
  open: ShiftsDialogType | null
  setOpen: (str: ShiftsDialogType | null) => void
  currentRow: Shift | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Shift | null>>
}

const ShiftsContext = React.createContext<ShiftsContextType | null>(null)

export function ShiftsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<ShiftsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Shift | null>(null)

  return (
    <ShiftsContext value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </ShiftsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useShifts = () => {
  const shiftsContext = React.useContext(ShiftsContext)

  if (!shiftsContext) {
    throw new Error('useShifts has to be used within <ShiftsContext>')
  }

  return shiftsContext
}
