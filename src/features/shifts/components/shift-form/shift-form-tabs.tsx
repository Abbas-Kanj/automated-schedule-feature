import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GeneralTab } from './general-tab'
import { ShiftPolicyTab } from './shift-policy-tab'
import { ShiftTimesTab } from './shift-times-tab'

const DEFAULT_TAB_CONTENT_CLASSNAME =
  'max-h-[60vh] w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'

type ShiftFormTabsProps = {
  // The dialog version caps tab content at 60vh with its own scrollbar; the
  // full-page create screen has no such constraint and just lets the page
  // scroll.
  contentClassName?: string
}

// "Repeat" and "Assign to" tabs are parked (components + schema fields kept
// but not shown) — their fields stay optional/gated behind their own
// enabled toggles, so an existing shift keeps its values through an edit.
export function ShiftFormTabs({
  contentClassName = DEFAULT_TAB_CONTENT_CLASSNAME,
}: ShiftFormTabsProps) {
  return (
    <Tabs defaultValue='general'>
      <TabsList variant='line' className='w-full'>
        <TabsTrigger value='general'>General</TabsTrigger>
        <TabsTrigger value='shift-times'>Shift times</TabsTrigger>
        <TabsTrigger value='shift-policy'>Shift policy</TabsTrigger>
      </TabsList>

      <TabsContent value='general' className={contentClassName}>
        <GeneralTab />
      </TabsContent>

      <TabsContent value='shift-times' className={contentClassName}>
        <ShiftTimesTab />
      </TabsContent>

      <TabsContent value='shift-policy' className={contentClassName}>
        <ShiftPolicyTab />
      </TabsContent>
    </Tabs>
  )
}
