import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog'
import { ShiftFormTabs } from '../components/shift-form/shift-form-tabs'
import { type Shift } from '../data/schema'
import { useShiftForm } from '../hooks/use-shift-form'
import { useShiftsStore } from '../stores/shifts-store'

export function ShiftCreatePage() {
  return <ShiftFormPage />
}

export function ShiftEditPage() {
  const { shiftId } = useParams({
    from: '/_authenticated/shifts/$shiftId/edit/',
  })
  const shift = useShiftsStore((s) => s.shifts.find((sh) => sh.id === shiftId))

  // Keyed so switching between two shifts' edit URLs re-seeds the form.
  return <ShiftFormPage key={shiftId} currentShift={shift} missing={!shift} />
}

type ShiftFormPageProps = {
  currentShift?: Shift
  // An edit URL whose id isn't in the store (deleted, or a stale link).
  missing?: boolean
}

function ShiftFormPage({ currentShift, missing }: ShiftFormPageProps) {
  const navigate = useNavigate()
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)
  const goBack = () => navigate({ to: '/shifts' })
  const { form, isDirty, isEdit, onSubmit } = useShiftForm(currentShift, goBack)

  // A plain button instead of a `Link`, so a dirty form can intercept it.
  const handleBack = () => {
    if (isDirty) {
      setConfirmLeaveOpen(true)
    } else {
      goBack()
    }
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
          <h2 className='text-2xl font-bold tracking-tight'>
            {isEdit || missing ? 'Edit shift' : 'Create shift'}
          </h2>
          <p className='text-muted-foreground'>
            {isEdit
              ? 'Update this shift definition.'
              : missing
                ? 'This shift no longer exists.'
                : 'Define a reusable shift with its name, time range and look.'}
          </p>
        </div>

        {!missing && (
          <>
            <Form {...form}>
              <form
                id='shift-form-page'
                onSubmit={onSubmit}
                className='space-y-4'
              >
                <ShiftFormTabs contentClassName='w-full py-1' />
              </form>
            </Form>

            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={handleBack}>
                Cancel
              </Button>
              <Button type='submit' form='shift-form-page'>
                {isEdit ? 'Save changes' : 'Create shift'}
              </Button>
            </div>
          </>
        )}
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
