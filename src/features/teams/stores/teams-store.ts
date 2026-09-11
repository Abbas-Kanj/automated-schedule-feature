import { z } from 'zod'
import { create } from 'zustand'
import { readSeeded, writeSeeded } from '@/lib/seed-store'
import { type Team, teamSchema } from '../data/schema'
import { defaultTeams } from '../data/teams'

const STORAGE_KEY = 'teams'

function persist(teams: Team[]) {
  writeSeeded(STORAGE_KEY, teams)
}

interface TeamsState {
  teams: Team[]
  addTeam: (team: Team) => void
  updateTeam: (id: string, team: Team) => void
  deleteTeam: (id: string) => void
}

const initialTeams = readSeeded(STORAGE_KEY, z.array(teamSchema), defaultTeams)

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
