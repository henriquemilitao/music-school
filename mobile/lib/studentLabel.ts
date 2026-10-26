import { firstName } from './name';
import { formatInstrument } from './instrument';

/**
 * Rótulo de aluno pra usar em listas/filtros onde pode haver mais de
 * 1 aluno vinculado à mesma conta (ex: mesmo nome, matrículas em
 * instrumentos diferentes). Mesmo padrão do StudentSwitcher: sempre
 * que há mais de 1 aluno no conjunto, mostra nome + instrumento —
 * não só quando detecta nome duplicado, pra manter o formato estável
 * conforme os dados mudam (evita o rótulo "pular" de formato quando
 * um novo aluno com nome repetido é matriculado depois).
 */
export function studentLabel(
  student: { name: string; instrument?: string | null },
  totalStudentsInSet: number,
): string {
  const name = firstName(student.name);
  if (totalStudentsInSet <= 1) return name;

  const instrument = formatInstrument(student.instrument);
  return instrument ? `${name} · ${instrument}` : name;
}
