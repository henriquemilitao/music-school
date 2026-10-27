import { ReactNode } from 'react';
import { View } from 'react-native';

// Cartão branco padrão das telas de autenticação.
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <View
      className="bg-white rounded-2xl p-5 gap-4"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}
