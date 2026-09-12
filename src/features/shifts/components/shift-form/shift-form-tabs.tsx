import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GeneralTab } from './general-tab'
import { ShiftPolicyTab } from './shift-policy-tab'
import { ShiftTimesTab } from './shift-times-tab'

const DEFAULT_TAB_CONTENT_CLASSNAME =
  'max-h-[60vh] w-[calc(100%+0.75rem)] overflow-y-auto py-1 pe-3'

type ShiftFormTabsProps = {
  // The dialog version caps tab content at 60vh with its own scrollbar so
  // the dialog chrome stays put; the full-page create screen has no such
  // constraint and just lets the page scroll — see
  // `pages/create/shift-create-page.tsx`.
  contentClassName?: string
}

// Shared tab layout for both the "Edit shift" dialog (`shift-form-dialog.tsx`)
// and the "Create shift" page (`pages/create/shift-create-page.tsx`) — every
// tab reads/writes through `useFormContext`, so this component itself takes
// no form props.
//
// "Repeat" and "Assign to" are deliberately not offered. Their components
// (`repeat-tab.tsx`, `assign-to-tab.tsx`) and their schema fields are kept:
// the fields are optional-or-defaulted and their validation is gated behind
// `repeat_enabled` / `assign_to_enabled`, so an existing shift that has them
// set keeps its values through an edit — `normalizeShiftFormValues` only
// blanks a field when its own toggle reads false, and nothing here changes a
// toggle. Same arrangement `service_resource` / `service_territory` have
// already had: schema field, no UI.
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
