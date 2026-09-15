import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SPAN_OPTIONS } from '../data'
import { type TimelineSpan } from '../timeline'

// The Weekly/Monthly control. Rendered per view rather than once for the page:
// the grid and the table are asking different questions and are allowed to be
// set to different spans while you compare them.
export function SpanTabs({
  value,
  onChange,
  className,
}: {
  value: TimelineSpan
  onChange: (span: TimelineSpan) => void
  className?: string
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as TimelineSpan)}
      className={className}
    >
      <TabsList>
        {SPAN_OPTIONS.map((option) => (
          <TabsTrigger key={option.value} value={option.value}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
