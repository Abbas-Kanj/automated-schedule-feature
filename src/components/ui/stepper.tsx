import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StepperStep = {
  id: string
  label: string
}

type StepperProps = {
  steps: StepperStep[]
  currentStep: number
  className?: string
}

function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <ol className={cn('flex w-full items-start', className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isActive = index === currentStep

        return (
          <li
            key={step.id}
            className='flex flex-1 items-center last:flex-none'
          >
            <div className='flex flex-col items-center gap-1.5'>
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors',
                  isCompleted &&
                    'border-primary bg-primary text-primary-foreground',
                  isActive && 'border-primary text-primary',
                  !isCompleted &&
                    !isActive &&
                    'border-border text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className='size-4' /> : index + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  isCompleted || isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-px flex-1 bg-border transition-colors',
                  isCompleted && 'bg-primary'
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

export { Stepper }
