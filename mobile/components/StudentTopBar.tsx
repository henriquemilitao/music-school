import { Home, CalendarDays, CreditCard } from 'lucide-react-native';
import { TopBar, TopBarMenuLink } from './TopBar';

const menuLinks: TopBarMenuLink[] = [
  { path: '/', label: 'Início', icon: Home },
  { path: '/lessons', label: 'Aulas', icon: CalendarDays },
  { path: '/payments', label: 'Pagamentos', icon: CreditCard },
];

export function StudentTopBar() {
  return <TopBar menuLinks={menuLinks} showDeleteAccount />;
}
