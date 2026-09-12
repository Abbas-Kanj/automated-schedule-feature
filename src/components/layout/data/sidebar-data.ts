import {
  CalendarClock,
  CalendarDays,
  AudioWaveform,
  Clock,
  Command,
  GalleryVerticalEnd,
  RotateCw,
  ShoppingCart,
  Timer,
  Users,
  UsersRound,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'satnaing',
    email: 'satnaingdev@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Shadcn Admin',
      logo: Command,
      plan: 'Vite + ShadcnUI',
    },
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
    {
      name: 'Acme Corp.',
      logo: AudioWaveform,
      plan: 'Startup',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Time Track',
          icon: Clock,
          items: [
            {
              title: 'Schedules',
              icon: CalendarClock,
              items: [
                { title: 'General schedule', url: '/schedules' },
                { title: 'Flexible schedule', url: '/schedules' },
                { title: 'Schedule rotation', url: '/schedule-rotation' },
                { title: 'Schedule templates', url: '/schedule-templates' },
              ],
            },
            {
              title: 'Shift management',
              icon: Timer,
              items: [
                { title: 'Shifts', url: '/shifts' },
                { title: 'Shift policies', url: '/shift-policies' },
              ],
            },
          ],
        },
        {
          title: 'Schedule Rotation',
          url: '/schedule-rotation',
          icon: RotateCw,
        },
        {
          title: 'Employee Management',
          url: '/employees-list',
          icon: Users,
        },
        {
          title: 'Team Management',
          url: '/teams',
          icon: UsersRound,
        },
        {
          title: 'Public holidays',
          url: '/public-holidays',
          icon: CalendarDays,
        },
        {
          title: 'POS',
          url: '#',
          icon: ShoppingCart,
        },
      ],
    },
  ],
}
