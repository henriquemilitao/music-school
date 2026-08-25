import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Image,
  BackHandler,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  Menu,
  X,
  Users,
  Wallet,
  CalendarClock,
  LogOut,
  Music,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const logo = require('../assets/images/logo.png');

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

const menuLinks = [
  { path: '/(admin)/students', label: 'Alunos', icon: Users },
  // { path: '/(admin)/finance', label: 'Financeiro', icon: Wallet },
  { path: '/(admin)/schedule', label: 'Agenda', icon: CalendarClock },
];

export function AdminTopBar() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setMenuOpen(false);
        return true; // "true" diz pro Android que já tratamos o back, não deixa ele sair da tela
      },
    );

    return () => subscription.remove();
  }, [menuOpen]);

  function go(path: string) {
    setMenuOpen(false);
    router.push(path as any);
  }

  return (
    <View
      className="px-5 pt-14 pb-3 bg-[#F5F1EA]"
      style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' }}
    >
      <View className="flex-row items-center justify-between">
        <View>
          <View className="flex-row items-center gap-1.5">
            <Music size={18} color="#1A1A1A" />
            <Text
              className="text-lg"
              style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
            >
              Pianíssima
            </Text>
          </View>

          <Text className="text-[10px] tracking-[2px] text-[#B08D57]/70 font-semibold mt-1">
            AQUI TEM MÚSICA
          </Text>
        </View>

        <TouchableOpacity
          className="w-9 h-9 rounded-full bg-white items-center justify-center"
          style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}
          onPress={() => setMenuOpen(true)}
        >
          <Menu size={18} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade">
        <View className="flex-1">
          <TouchableOpacity
            className="absolute inset-0 bg-black/40"
            activeOpacity={1}
            onPress={() => setMenuOpen(false)}
          />
          <View
            className="absolute right-0 top-0 bottom-0 bg-white"
            style={{ width: 288 }}
          >
            <View className="px-5 pt-14 pb-6 border-b border-gray-100">
              <View className="flex-row items-start justify-between mb-6">
                <View>
                  <View className="flex-row items-center gap-1.5">
                    <Music size={16} color="#B08D57" />
                    <Text
                      className="text-base"
                      style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
                    >
                      Pianíssima
                    </Text>
                  </View>

                  <Text className="text-[10px] tracking-[2px] text-[#B08D57]/70 font-semibold mt-1">
                    AQUI TEM MÚSICA
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setMenuOpen(false)}>
                  <X size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center gap-3">
                <View className="w-11 h-11 rounded-full bg-[#B08D57] items-center justify-center">
                  <Text className="text-white font-bold">
                    {getInitials(user?.name ?? '?')}
                  </Text>
                </View>
                <View>
                  <Text className="font-semibold text-base">{user?.name}</Text>
                  {user?.email && (
                    <Text className="text-gray-400 text-xs mt-0.5">
                      {user.email}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View className="flex-1 p-3">
              {menuLinks.map((item) => {
                const active = pathname.includes(item.path.split('/').pop()!);
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.path}
                    onPress={() => go(item.path)}
                    className={`flex-row items-center gap-3 px-3 py-3 rounded-xl ${
                      active ? 'bg-[#F3EADD]' : ''
                    }`}
                  >
                    <Icon size={18} color={active ? '#B08D57' : '#1A1A1A'} />
                    <Text
                      className={`text-sm font-medium ${active ? 'text-[#B08D57]' : 'text-[#1A1A1A]'}`}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="p-3 border-t border-gray-100">
              <TouchableOpacity
                className="flex-row items-center gap-3 px-3 py-3 rounded-xl"
                onPress={() => {
                  setMenuOpen(false);
                  signOut();
                }}
              >
                <LogOut size={18} color="#DC2626" />
                <Text className="text-sm font-medium text-red-600">Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
