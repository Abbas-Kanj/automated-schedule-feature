import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type Team } from '../data/schema'

export type TeamsDialogType = 'create' | 'edit' | 'delete'

type TeamsContextType = {
  open: TeamsDialogType | null
  setOpen: (str: TeamsDialogType | null) => void
  currentRow: Team | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Team | null>>
}

const TeamsContext = React.createContext<TeamsContextType | null>(null)

export function TeamsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<TeamsDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Team | null>(null)

  return (
    <TeamsContext value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </TeamsContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTeams = () => {
  const teamsContext = React.useContext(TeamsContext)

  if (!teamsContext) {
    throw new Error('useTeams has to be used within <TeamsContext>')
  }

  return teamsContext
}
