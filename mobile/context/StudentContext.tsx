import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

type Student = {
  id: string;
  name: string;
  instrument: string | null;
  age: number;
};

type StudentContextType = {
  students: Student[];
  selectedStudentId: string | null;
  selectedStudent: Student | null;
  setSelectedStudentId: (id: string) => void;
  isLoading: boolean;
};

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export function StudentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students-me', user?.id],
    queryFn: async () => {
      const res = await api.get<Student[]>('/students/me');
      return res.data;
    },
    enabled: !!user,
  });

  // Seleciona o primeiro automaticamente quando os dados chegam
  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId]);

  // Reset ao deslogar
  useEffect(() => {
    if (!user) setSelectedStudentId(null);
  }, [user]);

  const selectedStudent =
    students.find((s) => s.id === selectedStudentId) ?? null;

  return (
    <StudentContext.Provider
      value={{
        students,
        selectedStudentId,
        selectedStudent,
        setSelectedStudentId,
        isLoading,
      }}
    >
      {children}
    </StudentContext.Provider>
  );
}

export function useStudent() {
  const ctx = useContext(StudentContext);
  if (!ctx)
    throw new Error('useStudent precisa estar dentro de StudentProvider');
  return ctx;
}
