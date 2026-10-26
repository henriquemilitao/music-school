import { ReactNode } from 'react';
import { View } from 'react-native';

// Card branco das telas de detalhe — mesma sombra que lesson/[id] e
// student/[id] já usavam. `className` serve pra espaçamento interno
// (ex: "gap-4"); o padding padrão é p-5.
export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`bg-white rounded-2xl p-5 ${className}`}
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
