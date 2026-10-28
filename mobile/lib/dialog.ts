// lib/dialog.ts
//
// Avisos e confirmações do app, no visual do app (DialogHost) em vez do
// Alert nativo do celular ou do window.confirm do navegador.
//
//   const ok = await confirmAsync({ title, message, confirmText });
//   await alertAsync({ title, message, tone: 'error' });
//
// Podem ser chamados de qualquer lugar (telas, hooks, libs): o DialogHost,
// montado uma vez no layout raiz, desenha o diálogo. Se vários forem pedidos
// ao mesmo tempo, aparecem em fila, um de cada vez.

export type DialogTone = 'info' | 'success' | 'warning' | 'error';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  // Ação sem volta (excluir, descartar...): botão vermelho
  destructive?: boolean;
};

export type AlertOptions = {
  title: string;
  message?: string;
  okText?: string;
  tone?: DialogTone;
};

export type DialogRequest =
  | {
      id: number;
      kind: 'confirm';
      options: ConfirmOptions;
      resolve: (confirmed: boolean) => void;
    }
  | {
      id: number;
      kind: 'alert';
      options: AlertOptions;
      resolve: () => void;
    };

type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

let queue: DialogRequest[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function enqueue(request: DistributiveOmit<DialogRequest, 'id'>) {
  queue = [...queue, { ...request, id: nextId++ } as DialogRequest];
  emit();
}

// ─── Usado pelo DialogHost ────────────────────────────────────────────

export function subscribeToDialogs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// O diálogo que está na tela (o primeiro da fila). A referência só muda
// quando a fila muda, como o useSyncExternalStore exige.
export function currentDialog(): DialogRequest | undefined {
  return queue[0];
}

export function settleDialog(id: number, confirmed: boolean) {
  const request = queue.find((item) => item.id === id);
  if (!request) return;
  queue = queue.filter((item) => item.id !== id);
  emit();
  if (request.kind === 'confirm') request.resolve(confirmed);
  else request.resolve();
}

// ─── API para o resto do app ──────────────────────────────────────────

// Pergunta de confirmação: true se a pessoa confirmou; false se voltou,
// tocou fora ou usou o botão voltar do Android.
export function confirmAsync(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    enqueue({ kind: 'confirm', options, resolve });
  });
}

// Aviso com um botão só (erro, validação, "pronto!"). Resolve quando a
// pessoa fecha — dá para esperar com await antes de navegar.
export function alertAsync(options: AlertOptions): Promise<void> {
  return new Promise((resolve) => {
    enqueue({ kind: 'alert', options, resolve });
  });
}
