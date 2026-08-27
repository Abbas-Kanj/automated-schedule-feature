import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type PublicHoliday } from '../data/schema'

export type PublicHolidaysDialogType = 'create' | 'edit' | 'delete'

type PublicHolidaysContextType = {
  open: PublicHolidaysDialogType | null
  setOpen: (str: PublicHolidaysDialogType | null) => void
  currentRow: PublicHoliday | null
  setCurrentRow: React.Dispatch<React.SetStateAction<PublicHoliday | null>>
  selectedYear: number
  setSelectedYear: React.Dispatch<React.SetStateAction<number>>
}

const PublicHolidaysContext =
  React.createContext<PublicHolidaysContextType | null>(null)

// Dialog state plus the year the screen is looking at. The holidays
// themselves live in `usePublicHolidaysStore`.
export function PublicHolidaysProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<PublicHolidaysDialogType>(null)
  const [currentRow, setCurrentRow] = useState<PublicHoliday | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  return (
    <PublicHolidaysContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        selectedYear,
        setSelectedYear,
      }}
    >
      {children}
    </PublicHolidaysContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePublicHolidays = () => {
  const publicHolidaysContext = React.useContext(PublicHolidaysContext)

  if (!publicHolidaysContext) {
    throw new Error(
      'usePublicHolidays has to be used within <PublicHolidaysContext>'
    )
  }

  return publicHolidaysContext
}
