import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { type Resolver, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Form } from '@/components/ui/form'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog'
import { ShiftFormTabs } from '../../components/shift-form/shift-form-tabs'
import { emptyShiftFormValues } from '../../data/defaults'
import { type ShiftFormValues, shiftFormSchema } from '../../data/schema'
import { useDeriveShortCode } from '../../hooks/use-derive-short-code'
import { useShiftsStore } from '../../stores/shifts-store'
import { generateId, normalizeShiftFormValues } from '../../utils'

// Full-page "Create shift" screen, replacing the old create dialog (see
// `shift-form-dialog.tsx`, now edit-only). Mirrors `schedules`'
// `ScheduleCreatePage` — own header/back link instead of dialog chrome,
// same tab body via the shared `ShiftFormTabs`.
export function ShiftCreatePage() {
  const navigate = useNavigate()
  const addShift = useShiftsStore((s) => s.addShift)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema) as Resolver<ShiftFormValues>,
    defaultValues: emptyShiftFormValues,
  })
  const { isDirty } = form.formState
  useDeriveShortCode(form)

  const goBack = () => navigate({ to: '/shifts' })

  // Same "confirm before discarding" guard the old create dialog had —
  // routed through a plain button instead of a `Link` so a dirty form can
  // intercept it (see `UnsavedChangesDialog`).
  const handleBack = () => {
    if (isDirty) {
      setConfirmLeaveOpen(true)
    } else {
      goBack()
    }
  }

  const onSubmit = (values: ShiftFormValues) => {
    const submitValues = normalizeShiftFormValues(values)
    addShift({ id: generateId(), ...submitValues })
    toast.success(`Shift "${values.name}" has been created.`)
    goBack()
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div>
          <Button
            variant='ghost'
            size='sm'
            className='-ms-3 mb-1'
            onClick={handleBack}
          >
            <ArrowLeft className='size-4' /> Back to shifts
          </Button>
          <h2 className='text-2xl font-bold tracking-tight'>Create shift</h2>
          <p className='text-muted-foreground'>
            Define a reusable shift with its name, time range and look.
          </p>
        </div>

        <Form {...form}>
          <form
            id='shift-create-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'
          >
            <ShiftFormTabs contentClassName='w-full py-1' />
          </form>
        </Form>

        <div className='flex justify-end gap-2'>
          <Button type='button' variant='outline' onClick={handleBack}>
            Cancel
          </Button>
          <Button type='submit' form='shift-create-form'>
            Create shift
          </Button>
        </div>
      </Main>

      <UnsavedChangesDialog
        open={confirmLeaveOpen}
        onOpenChange={setConfirmLeaveOpen}
        onConfirm={() => {
          setConfirmLeaveOpen(false)
          goBack()
        }}
      />
    </>
  )
}
