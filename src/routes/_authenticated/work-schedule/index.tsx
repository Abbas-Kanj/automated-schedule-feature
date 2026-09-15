import { createFileRoute, redirect } from '@tanstack/react-router'

// "Work schedule" is only a group; its first sub-page stands in for it.
export const Route = createFileRoute('/_authenticated/work-schedule/')({
  beforeLoad: () => {
    throw redirect({ to: '/work-schedule/rotating' })
  },
})
