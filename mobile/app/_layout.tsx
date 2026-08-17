// app/_layout.tsx
import '../global.css';
import { Stack, Redirect, usePathname } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View, Text } from 'react-native';
import {
  useFonts,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { useEffect } from 'react';
import { registerForPushNotificationsAsync } from '../lib/notifications';

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA]">
        <Text>Carregando...</Text>
      </View>
    );
  }

  if (!user && pathname !== '/login') {
    return <Redirect href="/login" />;
  }

  // Redireciona pro grupo certo baseado no role, se o usuário
  // estiver tentando acessar a raiz "/" (ex: logo após o login)
  if (user && pathname === '/') {
    if (user.role === 'ADMIN') {
      return <Redirect href="/(admin)/students" />;
    }
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // dentro do seu componente de layout raiz, adicione:
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        console.log('Expo Push Token:', token);
        // depois vamos mandar esse token pro backend aqui
      }
    });
  }, []);

  if (!fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA]">
        <Text>Carregando...</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  );
}
