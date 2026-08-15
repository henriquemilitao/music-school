import { Tabs } from 'expo-router';
import { Users, Wallet, CalendarClock } from 'lucide-react-native';
import { AdminTopBar } from '../../components/AdminTopBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminTabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <AdminTopBar />,
        tabBarActiveTintColor: '#1A1A1A',
        tabBarInactiveTintColor: '#B0AA9C',
        tabBarStyle: {
          backgroundColor: '#F5F1EA',
          borderTopColor: 'rgba(0,0,0,0.06)',
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="students"
        options={{
          title: 'Alunos',
          tabBarIcon: ({ color, size }) => (
            <Users color={color} size={size ?? 20} />
          ),
        }}
      />
      {/* <Tabs.Screen
        name="finance"
        options={{
          title: 'Financeiro',
          tabBarIcon: ({ color, size }) => (
            <Wallet color={color} size={size ?? 20} />
          ),
        }}
      /> */}
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => (
            <CalendarClock color={color} size={size ?? 20} />
          ),
        }}
      />
    </Tabs>
  );
}
