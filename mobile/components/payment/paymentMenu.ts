import { Ban, Check, Pencil, RotateCcw, Undo2 } from 'lucide-react-native';
import type { PaymentActions, PaymentRef } from '../../lib/adminPayments';
import type { ActionMenuItem } from '../ui/ActionMenu';

type Params = {
  payment: PaymentRef;
  actions: PaymentActions;
  onConfirm: () => void;
  onEdit: () => void;
  // Fatura paga junto com outras (pagamento agregado): o servidor não deixa
  // desfazer nem cancelar só ela, então nem oferecemos.
  bundlePaid?: boolean;
  // Chamado depois que uma ação (desfazer/cancelar/reativar) é concluída
  onDone?: (action: 'undo' | 'cancel' | 'reactivate') => void;
};

// Itens do menu "⋯" de uma fatura — o mesmo na lista do aluno e no detalhe,
// variando com a situação: em aberto → confirmar/editar/cancelar; paga →
// editar/desfazer/cancelar; cancelada → reativar.
export function buildPaymentMenuItems({
  payment,
  actions,
  onConfirm,
  onEdit,
  bundlePaid = false,
  onDone,
}: Params): ActionMenuItem[] {
  const edit: ActionMenuItem = {
    key: 'edit',
    label: 'Editar fatura',
    description: 'Valor, vencimento, período e data do pagamento',
    icon: Pencil,
    onPress: onEdit,
  };
  const cancel: ActionMenuItem = {
    key: 'cancel',
    label: 'Cancelar fatura',
    description: 'Deixa de cobrar e fica no histórico como cancelada',
    icon: Ban,
    destructive: true,
    onPress: () =>
      void actions.cancel(payment).then((ok) => ok && onDone?.('cancel')),
  };

  if (payment.status === 'CANCELLED') {
    return [
      {
        key: 'reactivate',
        label: 'Reativar fatura',
        description: 'Volta a ser cobrada',
        icon: RotateCcw,
        onPress: () =>
          void actions
            .reactivate(payment)
            .then((ok) => ok && onDone?.('reactivate')),
      },
    ];
  }

  if (payment.status === 'PAID') {
    return [
      edit,
      ...(bundlePaid
        ? []
        : [
            {
              key: 'undo',
              label: 'Desfazer pagamento',
              description: 'Volta para pendente ou atrasada',
              icon: Undo2,
              onPress: () =>
                void actions.undo(payment).then((ok) => ok && onDone?.('undo')),
            },
            cancel,
          ]),
    ];
  }

  return [
    {
      key: 'confirm',
      label: 'Confirmar pagamento',
      description: 'Registrar que foi pago, com a data',
      icon: Check,
      onPress: onConfirm,
    },
    edit,
    cancel,
  ];
}
