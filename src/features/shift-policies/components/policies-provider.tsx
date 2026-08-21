import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type ShiftPolicy } from '../data/schema'

export type PoliciesDialogType = 'create' | 'edit' | 'delete'

type PoliciesContextType = {
  open: PoliciesDialogType | null
  setOpen: (str: PoliciesDialogType | null) => void
  currentRow: ShiftPolicy | null
  setCurrentRow: React.Dispatch<React.SetStateAction<ShiftPolicy | null>>
}

const PoliciesContext = React.createContext<PoliciesContextType | null>(null)

export function PoliciesProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<PoliciesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<ShiftPolicy | null>(null)

  return (
    <PoliciesContext value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </PoliciesContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePolicies = () => {
  const policiesContext = React.useContext(PoliciesContext)

  if (!policiesContext) {
    throw new Error('usePolicies has to be used within <PoliciesContext>')
  }

  return policiesContext
}
