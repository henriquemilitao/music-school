import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { withLayoutContext } from 'expo-router';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { useNavigationState } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, CalendarDays, Wallet } from 'lucide-react-native';
import { TopBar } from '../../components/TopBar';
import { StudentProvider } from '../../context/StudentContext';
import { StudentSwitcher } from '../../components/StudentSwitcher';
import { dashboardKeys } from '../../lib/queryKeys';

const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  any
>(Navigator);

const TAB_ICONS: Record<
  string,
  React.ComponentType<{ color?: string; size?: number }>
> = {
  index: Home,
  lessons: CalendarDays,
  payments: Wallet,
};

const TAB_LABELS: Record<string, string> = {
  index: 'Início',
  lessons: 'Aulas',
  payments: 'Pagamentos',
};

// Mapeia cada aba pra quais queryKeys ela precisa invalidar quando
// se torna a aba ativa. Existe porque o material-top-tabs mantém
// as telas montadas o tempo todo (é um carrossel, não uma pilha de
// navegação de verdade) — então useFocusEffect não dispara de forma
// confiável em cada tela individual. Centralizamos aqui, escutando
// a troca de aba direto no navigator.
const TAB_QUERY_KEYS: Record<string, unknown[][]> = {
  index: [[...dashboardKeys.all]],
  lessons: [['lessons']],
  payments: [['payments']],
};

function TabFocusInvalidator() {
  const queryClient = useQueryClient();
  const routeName = useNavigationState((state) => {
    if (!state) return undefined;
    return state.routes[state.index]?.name;
  });
  const lastRouteRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!routeName || routeName === lastRouteRef.current) return;
    lastRouteRef.current = routeName;

    const keysToInvalidate = TAB_QUERY_KEYS[routeName];
    if (!keysToInvalidate) return;

    keysToInvalidate.forEach((queryKey) => {
      queryClient.invalidateQueries({ queryKey });
    });
  }, [routeName, queryClient]);

  return null;
}

function TabsLayoutInner() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <TabFocusInvalidator />

      <View>
        <TopBar />
        <StudentSwitcher />
      </View>

      <MaterialTopTabs
        tabBarPosition="bottom"
        screenOptions={{
          swipeEnabled: true,
          tabBarShowLabel: true,
          tabBarShowIcon: true,
          tabBarActiveTintColor: '#1A1A1A',
          tabBarInactiveTintColor: '#B0AA9C',
          tabBarIndicatorStyle: { height: 0 },
          tabBarStyle: {
            backgroundColor: '#F5F1EA',
            borderTopWidth: 1,
            borderTopColor: 'rgba(0,0,0,0.06)',
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 6,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            textTransform: 'none',
          },
          tabBarIcon: () => null,
        }}
      >
        <MaterialTopTabs.Screen
          name="index"
          options={{
            title: TAB_LABELS.index,
            tabBarIcon: ({ color }) => {
              const Icon = TAB_ICONS.index;
              return <Icon color={color} size={20} />;
            },
          }}
        />
        <MaterialTopTabs.Screen
          name="lessons"
          options={{
            title: TAB_LABELS.lessons,
            tabBarIcon: ({ color }) => {
              const Icon = TAB_ICONS.lessons;
              return <Icon color={color} size={20} />;
            },
          }}
        />
        <MaterialTopTabs.Screen
          name="payments"
          options={{
            title: TAB_LABELS.payments,
            tabBarIcon: ({ color }) => {
              const Icon = TAB_ICONS.payments;
              return <Icon color={color} size={20} />;
            },
          }}
        />
      </MaterialTopTabs>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <StudentProvider>
      <TabsLayoutInner />
    </StudentProvider>
  );
}
