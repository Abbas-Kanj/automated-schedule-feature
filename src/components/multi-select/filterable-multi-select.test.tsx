import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { FilterableMultiSelect } from './filterable-multi-select'

type Option = { value: string; label: string }

const OPTIONS: Option[] = [
  { value: 'a1', label: 'Amir Haddad' },
  { value: 'a2', label: 'Aisha Karim' },
  { value: 'b1', label: 'Bob Chen' },
  { value: 'z1', label: 'Zara Okafor' },
]

// A controlled host, because the thing under test is what happens to an
// already-made selection when the option list narrows underneath it.
function Host({
  onLetterChange,
}: {
  onLetterChange?: (l: string | null) => void
}) {
  const [value, setValue] = useState<Option[]>([])
  return (
    <FilterableMultiSelect
      options={OPTIONS}
      value={value}
      onChange={(selected: Option[]) => setValue(selected ?? [])}
      onLetterChange={onLetterChange}
      isMulti
      placeholder='Select employees'
    />
  )
}

async function pick(screen: Awaited<ReturnType<typeof render>>, name: string) {
  const input = screen.getByRole('combobox').first()
  await userEvent.click(input)
  await userEvent.fill(input, name)
  await userEvent.keyboard('{Enter}')
}

describe('FilterableMultiSelect', () => {
  it('narrows the options to the chosen letter', async () => {
    const screen = await render(<Host />)

    await userEvent.click(screen.getByRole('button', { name: 'B' }))
    await userEvent.click(screen.getByRole('combobox').first())

    await expect.element(screen.getByText('Bob Chen')).toBeInTheDocument()
    expect(screen.getByText('Amir Haddad').elements()).toHaveLength(0)
  })

  it('keeps an already-selected name when a letter excludes it', async () => {
    const screen = await render(<Host />)

    await pick(screen, 'Amir Haddad')
    await userEvent.keyboard('{Escape}')
    // Z excludes Amir; narrowing options must not drop an already-chosen chip.
    await userEvent.click(screen.getByRole('button', { name: 'Z' }))

    await expect.element(screen.getByText('Amir Haddad')).toBeInTheDocument()
  })

  it('restores the full list on All', async () => {
    const screen = await render(<Host />)

    await userEvent.click(screen.getByRole('button', { name: 'B' }))
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    await userEvent.click(screen.getByRole('combobox').first())

    await expect.element(screen.getByText('Amir Haddad')).toBeInTheDocument()
    await expect.element(screen.getByText('Zara Okafor')).toBeInTheDocument()
  })

  it('disables letters no option starts with', async () => {
    const screen = await render(<Host />)

    await expect
      .element(screen.getByRole('button', { name: 'Q' }))
      .toBeDisabled()
    // `exact` matters: without it "A" also matches the "All" button.
    await expect
      .element(screen.getByRole('button', { name: 'A', exact: true }))
      .not.toBeDisabled()
  })

  it('reports the active letter, so an API can filter server-side later', async () => {
    const onLetterChange = vi.fn()
    const screen = await render(<Host onLetterChange={onLetterChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(onLetterChange).toHaveBeenLastCalledWith('B')

    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(onLetterChange).toHaveBeenLastCalledWith(null)
  })
})
