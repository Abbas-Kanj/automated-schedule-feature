import { z } from 'zod'

// A stored `employee_ids` id that no longer matches an employee is skipped
// when rendering, not treated as an error.
const teamFieldsSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(60),
  description: z.string().max(200).optional(),
  employee_ids: z.array(z.string()).default([]),
})

export const teamFormSchema = teamFieldsSchema
export const teamSchema = z.object({ id: z.string() }).and(teamFieldsSchema)

export type Team = z.infer<typeof teamSchema>
export type TeamFormValues = z.infer<typeof teamFormSchema>
