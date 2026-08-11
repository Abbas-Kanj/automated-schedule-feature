import { Link, useSearch } from '@tanstack/react-router'
import { Logo } from '@/assets/logo'
import { ClockIllustration } from './assets/clock-illustration'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn2() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  return (
    <div className='relative container grid h-svh flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <div className='relative h-full overflow-hidden bg-primary max-lg:hidden'>
        <ClockIllustration className='absolute top-1/2 left-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 text-primary-foreground/15' />
        <div className='relative z-10 flex h-full flex-col justify-end p-10 text-primary-foreground'>
          <p className='text-lg font-medium'>Track time, on your schedule.</p>
        </div>
      </div>

      <div className='lg:p-8'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:w-120 sm:p-8'>
          <div className='mb-4 flex items-center justify-center'>
            <Logo className='me-2' />
            <h1 className='text-xl font-medium'>Shadcn Admin</h1>
          </div>
        </div>
        <div className='mx-auto flex w-full max-w-sm flex-col justify-center space-y-2'>
          <div className='flex flex-col space-y-2 text-start'>
            <h2 className='text-lg font-semibold tracking-tight'>Sign in</h2>
            <p className='text-sm text-muted-foreground'>
              Enter your email and password below to log into{' '}
              <br className='max-sm:hidden' /> your account. Don't have an
              account?{' '}
              <Link
                to='/sign-up'
                className='text-nowrap underline underline-offset-4 hover:text-primary'
              >
                Sign Up
              </Link>
            </p>
          </div>
          <UserAuthForm redirectTo={redirect} />
          <p className='px-8 text-center text-sm text-muted-foreground'>
            By clicking sign in, you agree to our{' '}
            <a
              href='/terms'
              className='underline underline-offset-4 hover:text-primary'
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href='/privacy'
              className='underline underline-offset-4 hover:text-primary'
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
