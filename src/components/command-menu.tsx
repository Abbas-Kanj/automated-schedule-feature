import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, Laptop, Moon, Sun } from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { sidebarData } from './layout/data/sidebar-data'
import { type NavItem } from './layout/types'
import { ScrollArea } from './ui/scroll-area'

type CommandNavLink = {
  url: string
  // Every title from the top of the nav down to the link, so an entry reads
  // "Time Track > Schedules > Shift policies" rather than just "Shift policies".
  trail: string[]
}

// The nav is nested as deep as it likes, so the palette flattens it to its
// leaves rather than assuming a fixed depth — walking only one level down left
// every grandchild rendering as a branch title with no url to navigate to.
function flattenNavItems(
  items: NavItem[],
  trail: string[] = []
): CommandNavLink[] {
  return items.reduce<CommandNavLink[]>((links, item) => {
    const nextTrail = [...trail, item.title]
    if (item.url) return [...links, { url: item.url, trail: nextTrail }]
    return [...links, ...flattenNavItems(item.items ?? [], nextTrail)]
  }, [])
}

export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Type a command or search...' />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pe-1'>
          <CommandEmpty>No results found.</CommandEmpty>
          {sidebarData.navGroups.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {flattenNavItems(group.items).map(({ url, trail }, i) => (
                <CommandItem
                  key={`${url}-${i}`}
                  // Searchable by any level of the trail, not just the leaf.
                  value={trail.join(' ')}
                  onSelect={() => {
                    runCommand(() => navigate({ to: url }))
                  }}
                >
                  <div className='flex size-4 items-center justify-center'>
                    <ArrowRight className='size-2 text-muted-foreground/80' />
                  </div>
                  {trail.map((title, depth) => (
                    <React.Fragment key={title}>
                      {depth > 0 && <ChevronRight className='size-3' />}
                      {title}
                    </React.Fragment>
                  ))}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading='Theme'>
            <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <Sun /> <span>Light</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon className='scale-90' />
              <span>Dark</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop />
              <span>System</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
