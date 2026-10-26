import { View } from 'react-native';
import { withLayoutContext } from 'expo-router';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, CalendarClock } from 'lucide-react-native';
import { AdminTopBar } from '../../components/AdminTopBar';

const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  any
>(Navigator);

export default function AdminTabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <View>
        <AdminTopBar />
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
          name="students"
          options={{
            title: 'Alunos',
            tabBarIcon: ({ color }) => <Users color={color} size={20} />,
          }}
        />
        <MaterialTopTabs.Screen
          name="schedule"
          options={{
            title: 'Agenda',
            tabBarIcon: ({ color }) => (
              <CalendarClock color={color} size={20} />
            ),
          }}
        />
      </MaterialTopTabs>
    </View>
  );
}
