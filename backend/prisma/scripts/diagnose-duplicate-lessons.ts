/**
 * Script de diagnóstico: identifica aulas (lessons) duplicadas.
 * NÃO apaga nada. Só mostra o que está duplicado.
 *
 * Rodar com: npx ts-node prisma/diagnose-duplicate-lessons.ts
 * (ajuste o caminho conforme onde você colocar o arquivo)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const lessons = await prisma.lesson.findMany({
    select: {
      id: true,
      studentId: true,
      scheduledAt: true,
      enrollmentId: true,
      status: true,
      createdAt: true,
      student: { select: { name: true } },
    },
    orderBy: [{ studentId: 'asc' }, { scheduledAt: 'asc' }],
  });

  // Agrupa por (studentId + scheduledAt exato)
  const groups: Record<string, typeof lessons> = {};
  for (const lesson of lessons) {
    const key = `${lesson.studentId}__${lesson.scheduledAt.toISOString()}`;
    (groups[key] ??= []).push(lesson);
  }

  const duplicated = Object.entries(groups).filter(
    ([, group]) => group.length > 1,
  );

  if (duplicated.length === 0) {
    console.log(
      '✅ Nenhuma duplicata encontrada (mesmo aluno + mesmo horário exato).',
    );
  } else {
    console.log(`⚠️  Encontrados ${duplicated.length} grupos duplicados:\n`);
    let totalExtra = 0;
    for (const [, group] of duplicated) {
      totalExtra += group.length - 1;
      console.log(
        `- ${group[0].student.name} | ${group[0].scheduledAt.toISOString()} | ${group.length}x (ids: ${group.map((l) => l.id).join(', ')})`,
      );
    }
    console.log(`\nTotal de aulas "extras" (a remover): ${totalExtra}`);
  }

  // Também mostra contagem total de aulas por aluno, pra visão geral
  console.log('\n─── Total de aulas por aluno ───');
  const byStudent: Record<string, number> = {};
  for (const lesson of lessons) {
    byStudent[lesson.student.name] = (byStudent[lesson.student.name] ?? 0) + 1;
  }
  for (const [name, count] of Object.entries(byStudent)) {
    console.log(`${name}: ${count} aulas`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
