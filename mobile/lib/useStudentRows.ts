import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import {
  buildRows,
  type EnrollmentApi,
  type PendingPaymentApi,
  type StudentApi,
} from './studentList';

// Busca alunos + pendências + matrículas e junta tudo em linhas prontas
// pra lista. As chaves de cache são as mesmas de antes, então
// useRefreshStudentData continua atualizando a lista.
export function useStudentRows() {
  const students = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => (await api.get<StudentApi[]>('/students')).data,
  });
  const pending = useQuery({
    queryKey: ['admin-pending-payments'],
    queryFn: async () =>
      (await api.get<PendingPaymentApi[]>('/payments/pending')).data,
  });
  // O /students não traz professor: cruzamos com as matrículas aqui
  const enrollments = useQuery({
    queryKey: ['admin-enrollments'],
    queryFn: async () => (await api.get<EnrollmentApi[]>('/enrollments')).data,
  });

  const rows = useMemo(
    () =>
      buildRows(
        students.data ?? [],
        pending.data ?? [],
        enrollments.data ?? [],
      ),
    [students.data, pending.data, enrollments.data],
  );

  const isLoading =
    students.isLoading || pending.isLoading || enrollments.isLoading;
  const isError = students.isError || pending.isError || enrollments.isError;

  const refetch = () => {
    void students.refetch();
    void pending.refetch();
    void enrollments.refetch();
  };

  return {
    rows,
    isLoading,
    isError,
    isRefetching:
      students.isFetching || pending.isFetching || enrollments.isFetching,
    refetch,
  };
}
