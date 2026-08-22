import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import {
  createPredefinedHolidays,
  officialHolidays as initialHolidays,
} from '../data/official-holidays'
import { type HolidayYear, type OfficialHoliday } from '../data/schema'

type OfficialHolidaysDialogType = 'add' | 'edit' | 'delete'

type OfficialHolidaysContextType = {
  open: OfficialHolidaysDialogType | null
  setOpen: (value: OfficialHolidaysDialogType | null) => void
  currentRow: OfficialHoliday | null
  setCurrentRow: React.Dispatch<React.SetStateAction<OfficialHoliday | null>>
  holidays: OfficialHoliday[]
  years: HolidayYear[]
  selectedYear: number
  setSelectedYear: React.Dispatch<React.SetStateAction<number>>
  openYear: () => void
  saveHoliday: (holiday: OfficialHoliday) => void
  deleteHoliday: (id: string) => void
}

const OfficialHolidaysContext =
  React.createContext<OfficialHolidaysContextType | null>(null)

export function OfficialHolidaysProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<OfficialHolidaysDialogType>(null)
  const [currentRow, setCurrentRow] = useState<OfficialHoliday | null>(null)
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [years, setYears] = useState<HolidayYear[]>(
    Array.from({ length: 5 }, (_, index) => ({
      year: currentYear + 4 - index,
      isOpen: currentYear + 4 - index === currentYear,
    }))
  )
  const [holidays, setHolidays] = useState<OfficialHoliday[]>(initialHolidays)

  const openYear = () => {
    const selected = years.find((item) => item.year === selectedYear)
    if (!selected || selected.isOpen) return

    setHolidays((current) => [
      ...current,
      ...createPredefinedHolidays(selectedYear),
    ])
    setYears((current) =>
      current.map((item) =>
        item.year === selectedYear ? { ...item, isOpen: true } : item
      )
    )
  }

  const saveHoliday = (holiday: OfficialHoliday) => {
    setHolidays((current) => {
      const exists = current.some((item) => item.id === holiday.id)
      return exists
        ? current.map((item) => (item.id === holiday.id ? holiday : item))
        : [...current, holiday]
    })
  }

  const deleteHoliday = (id: string) => {
    setHolidays((current) => current.filter((item) => item.id !== id))
  }

  return (
    <OfficialHolidaysContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        holidays,
        years,
        selectedYear,
        setSelectedYear,
        openYear,
        saveHoliday,
        deleteHoliday,
      }}
    >
      {children}
    </OfficialHolidaysContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useOfficialHolidays = () => {
  const context = React.useContext(OfficialHolidaysContext)
  if (!context) {
    throw new Error(
      'useOfficialHolidays must be used within <OfficialHolidaysProvider>'
    )
  }
  return context
}
