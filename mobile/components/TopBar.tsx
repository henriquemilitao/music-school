import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Music, Menu, X, LogOut, Trash2 } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function getInitials(name: string) {
  const parts = name.trim().split(' ');
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export type TopBarMenuLink = {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
};

type TopBarProps = {
  menuLinks: TopBarMenuLink[];
  /** Se true, mostra o botão "Excluir conta" no menu (padrão: aluno). */
  showDeleteAccount?: boolean;
  /**
   * Função de match de rota ativa. Recebe o pathname atual e o link.
   * Se não for passada, usa startsWith/igualdade simples (comportamento do aluno).
   */
  isActive?: (pathname: string, link: TopBarMenuLink) => boolean;
};

function defaultIsActive(pathname: string, link: TopBarMenuLink) {
  return link.path === '/' ? pathname === '/' : pathname.startsWith(link.path);
}

export function TopBar({
  menuLinks,
  showDeleteAccount = false,
  isActive = defaultIsActive,
}: TopBarProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();

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

        <TouchableOpacity onPress={() => setMenuOpen(true)}>
          <Menu size={25} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
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
              <View className="flex-row items-center justify-between mb-6">
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
                  <X size={22} color="#9CA3AF" />
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
                const active = isActive(pathname, item);
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

            <View
              className="p-3 border-t border-gray-100"
              style={{ paddingBottom: Math.max(12, insets.bottom + 12) }}
            >
              {showDeleteAccount && (
                <TouchableOpacity
                  className="flex-row items-center gap-3 px-3 py-3 rounded-xl"
                  onPress={() => {
                    setMenuOpen(false);
                    router.push('/delete-account');
                  }}
                >
                  <Trash2 size={18} color="#9CA3AF" />
                  <Text className="text-sm font-medium text-gray-500">
                    Excluir conta
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="flex-row items-center gap-3 px-3 py-3 rounded-xl"
                onPress={async () => {
                  setMenuOpen(false);
                  await signOut();
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
