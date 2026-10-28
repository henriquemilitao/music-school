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

// Aulas na visão do admin. Depois de mudar uma aula, invalidar
// `schedule()` atualiza a agenda de qualquer dia já carregado, e
// `byStudent(id)` a aba "Aulas" do aluno.
export const adminLessonKeys = {
  detail: (id: string) => ['admin-lesson', id] as const,
  schedule: () => ['admin-schedule'] as const,
  scheduleDay: (dateKey: string) =>
    [...adminLessonKeys.schedule(), dateKey] as const,
  byStudent: (studentId: string) =>
    ['admin-student-lessons', studentId] as const,
};

// Faturas na visão do admin (detalhe de uma fatura do aluno).
export const adminPaymentKeys = {
  detail: (id: string) => ['admin-payment', id] as const,
  byStudent: (studentId: string) =>
    ['admin-student-payments', studentId] as const,
  studentStatus: (studentId: string) =>
    ['admin-student-payment-status', studentId] as const,
  pending: () => ['admin-pending-payments'] as const,
};
