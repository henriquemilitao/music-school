import {
  Modal,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ActionMenuItem = {
  key: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  destructive?: boolean;
  onPress: () => void;
};

type ActionMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: ActionMenuItem[];
  title?: string;
};

// Menu de ações em folha inferior (o "⋯" do header). Toque fora fecha.
export function ActionMenu({
  visible,
  onClose,
  items,
  title,
}: ActionMenuProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onPress={onClose}
        accessibilityLabel="Fechar menu"
      >
        {/* Pressable interno impede que tocar na folha feche o menu */}
        <Pressable
          className="bg-white rounded-t-3xl px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 16 }}
          onPress={() => {}}
        >
          <View className="self-center w-10 h-1 rounded-full bg-gray-200 mb-3" />
          {title ? (
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
              {title}
            </Text>
          ) : null}
          {items.map((item, index) => {
            const Icon = item.icon;
            const color = item.destructive ? '#DC2626' : '#1A1A1A';
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => {
                  onClose();
                  // iOS não apresenta outro Modal (ex: um diálogo de
                  // confirmação) enquanto este ainda está fechando
                  if (Platform.OS === 'ios') setTimeout(item.onPress, 350);
                  else item.onPress();
                }}
                className="flex-row items-center gap-3 py-3.5"
                style={
                  index > 0
                    ? { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' }
                    : undefined
                }
                accessibilityRole="button"
              >
                {Icon ? (
                  <View
                    className="w-9 h-9 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: item.destructive ? '#FEF2F2' : '#F3EADD',
                    }}
                  >
                    <Icon
                      size={18}
                      color={item.destructive ? '#DC2626' : '#B08D57'}
                    />
                  </View>
                ) : null}
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold" style={{ color }}>
                    {item.label}
                  </Text>
                  {item.description ? (
                    <Text className="text-xs text-gray-500 mt-0.5">
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
