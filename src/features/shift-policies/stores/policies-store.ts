import { z } from 'zod'
import { create } from 'zustand'
import { defaultShiftPolicies } from '../data/policies'
import { type ShiftPolicy, shiftPolicySchema } from '../data/schema'

const STORAGE_KEY = 'shift-policies'

function readStoredPolicies(): ShiftPolicy[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultShiftPolicies

  try {
    const result = z.array(shiftPolicySchema).safeParse(JSON.parse(raw))
    return result.success ? result.data : defaultShiftPolicies
  } catch {
    return defaultShiftPolicies
  }
}

function persist(policies: ShiftPolicy[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(policies))
}

interface PoliciesState {
  policies: ShiftPolicy[]
  addPolicy: (policy: ShiftPolicy) => void
  updatePolicy: (id: string, policy: ShiftPolicy) => void
  deletePolicy: (id: string) => void
}

const initialPolicies = readStoredPolicies()
if (!localStorage.getItem(STORAGE_KEY)) {
  persist(initialPolicies)
}

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
