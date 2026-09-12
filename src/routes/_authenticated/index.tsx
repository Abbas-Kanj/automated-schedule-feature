import { createFileRoute, redirect } from '@tanstack/react-router'

// The app has no landing dashboard — schedules are what it is for, so the root
// hands straight over to them.
export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: () => {
    throw redirect({ to: '/schedules' })
  },
})
