import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({
    include: {
      users: {
        include: {
          students: {
            include: {
              enrollments: true,
              payments: {
                orderBy: { dueDate: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  for (const school of schools) {
    console.log('\n=================================================');
    console.log(`ESCOLA: ${school.name} (${school.slug})`);
    console.log('=================================================');

    for (const user of school.users) {
      console.log(`\n👤 USUÁRIO: ${user.name} <${user.email}> — role: ${user.role}`);

      if (user.students.length === 0) continue;

      for (const student of user.students) {
        console.log(`   🎓 ALUNO: ${student.name} (${student.instrument ?? 'sem instrumento'})`);

        if (student.enrollments.length === 0) {
          console.log('      — sem matrícula');
        }
        for (const enrollment of student.enrollments) {
          console.log(
            `      📋 MATRÍCULA: dia ${enrollment.weekDay} às ${enrollment.startTime} — ` +
              `R$ ${enrollment.monthlyAmount} — ativa: ${enrollment.isActive} — ` +
              `início: ${enrollment.startDate.toLocaleDateString('pt-BR')}`,
          );
        }

        if (student.payments.length === 0) {
          console.log('      — sem faturas');
        }
        for (const payment of student.payments) {
          const dueStr = payment.dueDate.toLocaleDateString('pt-BR');
          const paidStr = payment.paidAt
            ? ` | pago em ${payment.paidAt.toLocaleDateString('pt-BR')}`
            : '';
          console.log(
            `      💰 FATURA ${payment.referenceMonth} — R$ ${payment.amount} — ` +
              `status: ${payment.status} — venc: ${dueStr}${paidStr}` +
              `${payment.paymentBundleId ? ` — [bundle: ${payment.paymentBundleId}]` : ''}`,
          );
        }
      }
    }
  }

  // ─── Bundles ───
  const bundles = await prisma.paymentBundle.findMany({
    include: {
      user: { select: { name: true, email: true } },
      payments: { select: { id: true, referenceMonth: true, amount: true } },
    },
  });

  if (bundles.length > 0) {
    console.log('\n=================================================');
    console.log('PAYMENT BUNDLES');
    console.log('=================================================');
    for (const bundle of bundles) {
      console.log(
        `\n📦 Bundle ${bundle.id} — responsável: ${bundle.user.name} — ` +
          `R$ ${bundle.amount} — status: ${bundle.status}`,
      );
      for (const p of bundle.payments) {
        console.log(`   → fatura ${p.referenceMonth} (R$ ${p.amount})`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());