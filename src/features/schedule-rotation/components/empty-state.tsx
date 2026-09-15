import { type ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-12 text-center'>
      <div className='text-muted-foreground'>{icon}</div>
      <p className='font-medium'>{title}</p>
      <p className='max-w-sm text-sm text-muted-foreground'>{description}</p>
    </div>
  )
}
