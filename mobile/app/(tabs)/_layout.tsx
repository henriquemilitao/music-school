import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, CalendarDays, Wallet } from 'lucide-react-native';
import { TopBar } from '../../components/TopBar';
import { StudentProvider } from '../../context/StudentContext';
import { StudentSwitcher } from '../../components/StudentSwitcher';

// TabsLayoutInner fica DENTRO do StudentProvider,
// então StudentSwitcher consegue acessar o contexto
function TabsLayoutInner() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => (
          <View>
            <TopBar />
            <StudentSwitcher />
          </View>
        ),
        tabBarActiveTintColor: '#1A1A1A',
        tabBarInactiveTintColor: '#B0AA9C',
        tabBarStyle: {
          backgroundColor: '#F5F1EA',
          borderTopColor: 'rgba(0,0,0,0.06)',
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size ?? 20} />
          ),
        }}
      />
      <Tabs.Screen
        name="lessons"
        options={{
          title: 'Aulas',
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size ?? 20} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Pagamentos',
          tabBarIcon: ({ color, size }) => (
            <Wallet color={color} size={size ?? 20} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <StudentProvider>
      <TabsLayoutInner />
    </StudentProvider>
  );
}
