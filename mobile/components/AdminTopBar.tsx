import { Users, CalendarClock } from 'lucide-react-native';
import { TopBar, TopBarMenuLink } from './TopBar';

const menuLinks: TopBarMenuLink[] = [
  { path: '/(admin)/students', label: 'Alunos', icon: Users },
  { path: '/(admin)/schedule', label: 'Agenda', icon: CalendarClock },
];

function isActive(pathname: string, link: TopBarMenuLink) {
  return pathname.includes(link.path.split('/').pop()!);
}

export function AdminTopBar() {
  return (
    <TopBar
      menuLinks={menuLinks}
      showDeleteAccount={false}
      isActive={isActive}
    />
  );
}
