/**
 * Script de limpeza: remove aulas (lessons) duplicadas.
 * Mantém a MAIS ANTIGA (menor createdAt) de cada grupo
 * (mesmo studentId + mesmo scheduledAt exato) e apaga o resto.
 *
 * Rode primeiro o diagnose-duplicate-lessons.ts pra conferir o que será afetado.
 *
 * Rodar com: npx ts-node prisma/cleanup-duplicate-lessons.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const lessons = await prisma.lesson.findMany({
    select: {
      id: true,
      studentId: true,
      scheduledAt: true,
      createdAt: true,
      student: { select: { name: true } },
    },
    orderBy: [
      { studentId: 'asc' },
      { scheduledAt: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  const groups: Record<string, typeof lessons> = {};
  for (const lesson of lessons) {
    const key = `${lesson.studentId}__${lesson.scheduledAt.toISOString()}`;
    (groups[key] ??= []).push(lesson);
  }

  const idsToDelete: string[] = [];
  for (const group of Object.values(groups)) {
    if (group.length > 1) {
      // mantém o primeiro (mais antigo, já que ordenamos por createdAt asc)
      const [, ...rest] = group;
      idsToDelete.push(...rest.map((l) => l.id));
    }
  }

  if (idsToDelete.length === 0) {
    console.log('✅ Nada para remover.');
    return;
  }

  console.log(`🗑️  Removendo ${idsToDelete.length} aulas duplicadas...`);

  const result = await prisma.lesson.deleteMany({
    where: { id: { in: idsToDelete } },
  });

  console.log(`✅ Removidas ${result.count} aulas duplicadas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
