import { createFileRoute, redirect } from '@tanstack/react-router'

// The root redirects straight to schedules.
export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: () => {
    throw redirect({ to: '/schedules' })
  },
})
