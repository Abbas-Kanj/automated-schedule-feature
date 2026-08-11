import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type VerticalTabsStep = {
  id: string
  label: string
}

type VerticalTabsProps = {
  steps: VerticalTabsStep[]
  currentStep: number
  onStepChange?: (index: number) => void
  className?: string
  /**
   * Furthest step index the user has validated their way to. Steps beyond
   * this are locked — clicking them is a no-op until earlier steps pass
   * validation, so users can't jump ahead of unfinished ones.
   */
  maxStepReached?: number
}

function VerticalTabs({
  steps,
  currentStep,
  onStepChange,
  className,
  maxStepReached = currentStep,
}: VerticalTabsProps) {
  return (
    <nav
      aria-label='Form sections'
      className={cn('flex w-full shrink-0 flex-col gap-0.5 sm:w-52', className)}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isActive = index === currentStep
        const isLocked = index > maxStepReached

        return (
          <button
            key={step.id}
            type='button'
            aria-current={isActive ? 'step' : undefined}
            aria-disabled={isLocked}
            disabled={isLocked}
            onClick={() => !isLocked && onStepChange?.(index)}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-start text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              isLocked && 'cursor-not-allowed opacity-50 hover:bg-transparent'
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                isCompleted &&
                  'border-primary bg-primary text-primary-foreground',
                isActive && !isCompleted && 'border-primary text-primary',
                !isCompleted &&
                  !isActive &&
                  'border-border text-muted-foreground'
              )}
            >
              {isCompleted ? <Check className='size-3' /> : index + 1}
            </span>
            {step.label}
          </button>
        )
      })}
    </nav>
  )
}

export { VerticalTabs }
