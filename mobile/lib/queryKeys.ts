// Centraliza as chaves de query de pagamentos. Usar isso em vez de
// strings soltas garante que invalidateQueries(['payments']) alcança
// TODAS as queries relacionadas (lista, detalhe, dashboard) de uma vez.
export const paymentKeys = {
  all: ['payments'] as const,
  my: () => [...paymentKeys.all, 'my'] as const,
  detail: (id: string) => [...paymentKeys.all, 'detail', id] as const,
  bundle: (id: string) => [...paymentKeys.all, 'bundle', id] as const,
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
};
