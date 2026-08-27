import { z } from 'zod'
import { create } from 'zustand'
import { type Team, teamSchema } from '../data/schema'
import { defaultTeams } from '../data/teams'

const STORAGE_KEY = 'teams'

function readStoredTeams(): Team[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultTeams

  try {
    const result = z.array(teamSchema).safeParse(JSON.parse(raw))
    return result.success ? result.data : defaultTeams
  } catch {
    return defaultTeams
  }
}

function persist(teams: Team[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams))
}

interface TeamsState {
  teams: Team[]
  addTeam: (team: Team) => void
  updateTeam: (id: string, team: Team) => void
  deleteTeam: (id: string) => void
}

const initialTeams = readStoredTeams()
if (!localStorage.getItem(STORAGE_KEY)) {
  persist(initialTeams)
}

export const useTeamsStore = create<TeamsState>()((set) => ({
  teams: initialTeams,
  addTeam: (team) =>
    set((state) => {
      const teams = [...state.teams, team]
      persist(teams)
      return { teams }
    }),
  updateTeam: (id, team) =>
    set((state) => {
      const teams = state.teams.map((t) => (t.id === id ? team : t))
      persist(teams)
      return { teams }
    }),
  deleteTeam: (id) =>
    set((state) => {
      const teams = state.teams.filter((t) => t.id !== id)
      persist(teams)
      return { teams }
    }),
}))
