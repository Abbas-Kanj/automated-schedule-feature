import { z } from 'zod'
import { create } from 'zustand'
import { readSeeded, writeSeeded } from '@/lib/seed-store'
import { defaultShiftPolicies } from '../data/policies'
import { type ShiftPolicy, shiftPolicySchema } from '../data/schema'

const STORAGE_KEY = 'shift-policies'

function persist(policies: ShiftPolicy[]) {
  writeSeeded(STORAGE_KEY, policies)
}

interface PoliciesState {
  policies: ShiftPolicy[]
  addPolicy: (policy: ShiftPolicy) => void
  updatePolicy: (id: string, policy: ShiftPolicy) => void
  deletePolicy: (id: string) => void
}

const initialPolicies = readSeeded(
  STORAGE_KEY,
  z.array(shiftPolicySchema),
  defaultShiftPolicies
)

export const usePoliciesStore = create<PoliciesState>()((set) => ({
  policies: initialPolicies,
  addPolicy: (policy) =>
    set((state) => {
      const policies = [...state.policies, policy]
      persist(policies)
      return { policies }
    }),
  updatePolicy: (id, policy) =>
    set((state) => {
      const policies = state.policies.map((p) => (p.id === id ? policy : p))
      persist(policies)
      return { policies }
    }),
  deletePolicy: (id) =>
    set((state) => {
      const policies = state.policies.filter((p) => p.id !== id)
      persist(policies)
      return { policies }
    }),
}))
