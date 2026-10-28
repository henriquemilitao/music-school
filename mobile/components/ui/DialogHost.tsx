import { useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
} from 'lucide-react-native';
import {
  currentDialog,
  settleDialog,
  subscribeToDialogs,
  type DialogRequest,
  type DialogTone,
} from '../../lib/dialog';
import { Button } from './Button';

type ToneVisual = {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  bg: string;
};

const TONES: Record<DialogTone | 'question' | 'danger', ToneVisual> = {
  info: { icon: Info, color: '#B08D57', bg: '#F3EADD' },
  success: { icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4' },
  warning: { icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB' },
  error: { icon: AlertCircle, color: '#DC2626', bg: '#FEF2F2' },
  question: { icon: HelpCircle, color: '#B08D57', bg: '#F3EADD' },
  danger: { icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
};

function toneOf(request: DialogRequest) {
  if (request.kind === 'alert') return TONES[request.options.tone ?? 'info'];
  return request.options.destructive ? TONES.danger : TONES.question;
}

// Desenha os diálogos pedidos por lib/dialog.ts. Fica uma vez só, no layout
// raiz, por cima de qualquer tela.
export function DialogHost() {
  const active = useSyncExternalStore(
    subscribeToDialogs,
    currentDialog,
    currentDialog,
  );

  // Guarda o último diálogo para o conteúdo não sumir no meio da animação de
  // fechar (o Modal ainda está desaparecendo quando a fila já esvaziou).
  const [lastShown, setLastShown] = useState<DialogRequest | undefined>(active);
  if (active && active !== lastShown) setLastShown(active);

  const request = active ?? lastShown;
  if (!request) return null;

  const tone = toneOf(request);
  const Icon = tone.icon;
  const dismiss = () => settleDialog(request.id, false);

  return (
    <Modal
      visible={!!active}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Pressable
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={dismiss}
        accessibilityLabel="Fechar aviso"
      >
        {/* Pressable interno: tocar no cartão não fecha */}
        <Pressable
          className="w-full bg-white rounded-3xl px-6 pt-6 pb-5 items-center"
          style={{
            maxWidth: 380,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 18,
            elevation: 8,
          }}
          onPress={() => {}}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <View
            className="w-14 h-14 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: tone.bg }}
          >
            <Icon size={26} color={tone.color} />
          </View>

          <Text
            className="text-xl text-center"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            {request.options.title}
          </Text>
          {request.options.message ? (
            <Text className="text-sm text-gray-500 text-center leading-5 mt-2">
              {request.options.message}
            </Text>
          ) : null}

          <View className="flex-row gap-3 mt-6 w-full">
            {request.kind === 'confirm' ? (
              <>
                <Button
                  label={request.options.cancelText ?? 'Voltar'}
                  variant="secondary"
                  onPress={dismiss}
                />
                <Button
                  label={request.options.confirmText}
                  variant={request.options.destructive ? 'danger' : 'primary'}
                  onPress={() => settleDialog(request.id, true)}
                />
              </>
            ) : (
              <Button
                label={request.options.okText ?? 'Entendi'}
                onPress={dismiss}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
