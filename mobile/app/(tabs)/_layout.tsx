import { View } from 'react-native';
import { withLayoutContext } from 'expo-router';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, CalendarDays, Wallet } from 'lucide-react-native';
import { TopBar } from '../../components/TopBar';
import { StudentProvider } from '../../context/StudentContext';
import { StudentSwitcher } from '../../components/StudentSwitcher';

// withLayoutContext "converte" um navigator do React Navigation
// (que normalmente não conhece o sistema de arquivos do Expo Router)
// num componente que o expo-router entende como rota — é assim que
// a doc oficial recomenda pra usar navigators fora dos padrões
// (Tabs, Stack) dentro do app/.
const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  any
>(Navigator);

// ícones que vamos plotar manualmente na barra customizada
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

function TabsLayoutInner() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <View>
        <TopBar />
        <StudentSwitcher />
      </View>

      <MaterialTopTabs
        // tabBarPosition: 'bottom' é a chave que faz a barra do
        // material-top-tabs (que por padrão renderiza no topo)
        // aparecer embaixo — mas o gesto de swipe continua ativo,
        // só a posição visual muda
        tabBarPosition="bottom"
        screenOptions={{
          swipeEnabled: true,
          tabBarShowLabel: true,
          tabBarShowIcon: true,
          tabBarActiveTintColor: '#1A1A1A',
          tabBarInactiveTintColor: '#B0AA9C',
          tabBarIndicatorStyle: { height: 0 }, // remove a barrinha indicadora padrão (underline)
          tabBarStyle: {
            backgroundColor: '#F5F1EA',
            borderTopWidth: 1,
            borderTopColor: 'rgba(0,0,0,0.06)',
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 6,
            elevation: 0, // remove sombra padrão do Android
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            textTransform: 'none',
          },
          tabBarIcon: ({ color, focused }) => {
            // route.name não vem direto aqui nessa versão da lib,
            // então pegamos via closure abaixo no Screen individual
            return null;
          },
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
