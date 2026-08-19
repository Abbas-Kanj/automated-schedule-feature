import { create } from 'zustand'

const STORAGE_KEY = 'display-preferences'

export type TimeFormat = '12h' | '24h'

function readStoredTimeFormat(): TimeFormat {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === '12h' ? '12h' : '24h'
}

interface DisplayPreferencesState {
  // How clock times are rendered app-wide — 12-hour ("3:30 pm") or
  // 24-hour ("15:30"). Editing inputs stay native time pickers regardless.
  time_format: TimeFormat
  setTimeFormat: (format: TimeFormat) => void
}

export const useDisplayPreferencesStore = create<DisplayPreferencesState>()(
  (set) => ({
    time_format: readStoredTimeFormat(),
    setTimeFormat: (format) =>
      set(() => {
        localStorage.setItem(STORAGE_KEY, format)
        return { time_format: format }
      }),
  })
)
