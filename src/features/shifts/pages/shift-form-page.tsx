import { useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { generateId } from '@/lib/id'
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
import { emptyShiftFormValues } from '../data/defaults'
import {
  type Shift,
  type ShiftFormValues,
  shiftFormSchema,
} from '../data/schema'
import { useDeriveShortCode } from '../hooks/use-derive-short-code'
import { useShiftsStore } from '../stores/shifts-store'
import { normalizeShiftFormValues } from '../utils'

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
  const isEdit = !!currentShift
  const navigate = useNavigate()
  const addShift = useShiftsStore((s) => s.addShift)
  const updateShift = useShiftsStore((s) => s.updateShift)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema) as Resolver<ShiftFormValues>,
    defaultValues: currentShift ?? emptyShiftFormValues,
  })
  const { isDirty } = form.formState
  useDeriveShortCode(form)

  const goBack = () => navigate({ to: '/shifts' })

  // A plain button instead of a `Link`, so a dirty form can intercept it.
  const handleBack = () => {
    if (isDirty) {
      setConfirmLeaveOpen(true)
    } else {
      goBack()
    }
  }

  const onSubmit = (values: ShiftFormValues) => {
    const submitValues = normalizeShiftFormValues(values)
    if (currentShift) {
      updateShift(currentShift.id, { id: currentShift.id, ...submitValues })
      toast.success(`Shift "${values.name}" has been updated.`)
    } else {
      addShift({ id: generateId(), ...submitValues })
      toast.success(`Shift "${values.name}" has been created.`)
    }
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
