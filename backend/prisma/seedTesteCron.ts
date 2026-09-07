import { PrismaClient, Role, Instrument } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const now = new Date();
const SCHOOL_TIMEZONE_OFFSET_HOURS = -4;

function dueDateLastMonthUTC(day: number): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day, 12, 0, 0, 0),
  );
}

function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toPeriodKeyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toMonthKeyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function createCompletedLessonsInRange(p: {
  schoolId: string;
  studentId: string;
  teacherId: string;
  enrollmentId: string;
  weekDay: number;
  startTime: string;
  fromDate: Date;
  toDate: Date;
}) {
  const [hours, minutes] = p.startTime.split(':').map(Number);

  const cursor = new Date(
    Date.UTC(
      p.fromDate.getUTCFullYear(),
      p.fromDate.getUTCMonth(),
      p.fromDate.getUTCDate(),
    ),
  );

  while (cursor < p.toDate) {
    if (cursor.getUTCDay() === p.weekDay) {
      const scheduledAt = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate(),
          hours - SCHOOL_TIMEZONE_OFFSET_HOURS,
          minutes,
          0,
          0,
        ),
      );
      await prisma.lesson.create({
        data: {
          schoolId: p.schoolId,
          studentId: p.studentId,
          teacherId: p.teacherId,
          enrollmentId: p.enrollmentId,
          scheduledAt,
          durationMinutes: 60,
          status: 'COMPLETED',
        },
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

type TestStudentConfig = {
  guardianName: string;
  guardianEmail: string;
  studentName: string;
  weekDay: number;
  startTime: string;
  dueDay: number;
  lessonOffsetDays: number;
};

const DEFAULT_AMOUNT = 250;

// ─────────────────────────────────────────────────────────────
// CONTA DO REVISOR — GOOGLE PLAY
// ─────────────────────────────────────────────────────────────
// Credencial fixa, documentada no Play Console em App content →
// App access, pra o revisor da Google logar e navegar pelo app.
// Reaproveita a mesma escola/dados que este seed já cria — não
// precisa de um seed separado só pra isso.
const REVIEWER_EMAIL = 'revisor.googleplay@pianissima.app';
const REVIEWER_PASSWORD = 'RevisaoPlayStore2026!'; // troque antes de usar de verdade

const testStudents: TestStudentConfig[] = [
  {
    guardianName: 'Ana (Teste Dia07)',
    guardianEmail: 'teste.dia07@escolademo.com',
    studentName: 'Aluno Dia07',
    weekDay: 1,
    startTime: '08:00',
    dueDay: 7,
    lessonOffsetDays: 2,
  },
  {
    guardianName: 'Bruno (Teste Dia08)',
    guardianEmail: 'teste.dia08@escolademo.com',
    studentName: 'Aluno Dia08',
    weekDay: 2,
    startTime: '09:00',
    dueDay: 8,
    lessonOffsetDays: -3,
  },
  {
    guardianName: 'Carla (Teste Dia09)',
    guardianEmail: 'teste.dia09@escolademo.com',
    studentName: 'Aluno Dia09',
    weekDay: 3,
    startTime: '10:00',
    dueDay: 9,
    lessonOffsetDays: 1,
  },
  {
    guardianName: 'Diego (Teste Dia10)',
    guardianEmail: 'teste.dia10@escolademo.com',
    studentName: 'Aluno Dia10',
    weekDay: 4,
    startTime: '11:00',
    dueDay: 10,
    lessonOffsetDays: -2,
  },
  {
    guardianName: 'Elis (Teste Dia11)',
    guardianEmail: 'teste.dia11@escolademo.com',
    studentName: 'Aluno Dia11',
    weekDay: 5,
    startTime: '14:00',
    dueDay: 11,
    lessonOffsetDays: 3,
  },
];

async function main() {
  console.log('🧹 Limpando banco...');
  await prisma.payment.deleteMany();
  await prisma.paymentBundle.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();

  const school = await prisma.school.create({
    data: {
      name: 'Escola de Música Demo (Teste Cron)',
      slug: 'escola-demo-teste-cron',
      email: 'contato@escolademo.com',
      phone: '11999999999',
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      name: 'Admin',
      email: 'admin@escolademo.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: Role.ADMIN,
    },
  });

  // ── Conta do revisor da Google Play ──────────────────────────
  // ADMIN separado do admin de testes acima — credencial estável,
  // pensada pra nunca mudar entre execuções do seed (mesmo e-mail,
  // mesma senha), já que é isso que fica documentado no Play
  // Console. Enxerga a mesma escola e os mesmos dados de demo
  // (professor, alunos, aulas, pagamentos) criados logo abaixo.
  console.log('🔎 Criando conta do revisor da Google Play...');
  await prisma.user.create({
    data: {
      schoolId: school.id,
      name: 'Revisor Google Play',
      email: REVIEWER_EMAIL,
      passwordHash: await bcrypt.hash(REVIEWER_PASSWORD, 10),
      role: Role.ADMIN,
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      name: 'Professor Teste',
      email: 'professor.teste@escolademo.com',
      passwordHash: await bcrypt.hash('prof123', 10),
      role: Role.TEACHER,
    },
  });
  const teacher = await prisma.teacher.create({
    data: { userId: teacherUser.id, bio: 'Professor genérico de teste.' },
  });

  console.log(
    '👨‍👩‍👧 Criando os 5 alunos de teste (vencimentos 07, 08, 09, 10, 11)...\n',
  );

  for (const cfg of testStudents) {
    const guardianUser = await prisma.user.create({
      data: {
        schoolId: school.id,
        name: cfg.guardianName,
        email: cfg.guardianEmail,
        passwordHash: await bcrypt.hash('senha123', 10),
        role: Role.STUDENT,
      },
    });

    const student = await prisma.student.create({
      data: {
        userId: guardianUser.id,
        name: cfg.studentName,
        instrument: Instrument.PIANO,
        birthDate: new Date(2015, 0, 1),
      },
    });

    const previousDueDate = dueDateLastMonthUTC(cfg.dueDay);
    const previousLessonPeriodStart = addDaysUTC(
      previousDueDate,
      cfg.lessonOffsetDays,
    );

    const enrollment = await prisma.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        teacherId: teacher.id,
        weekDay: cfg.weekDay,
        startTime: cfg.startTime,
        durationMinutes: 60,
        monthlyAmount: DEFAULT_AMOUNT,
        firstLessonDate: previousLessonPeriodStart,
        firstPaymentDueDate: previousDueDate,
        lastLessonPeriodStart: previousLessonPeriodStart,
        lastPaymentDueDate: previousDueDate,
        lastGeneratedPeriodKey: toPeriodKeyUTC(previousLessonPeriodStart),
      },
    });

    const previousPeriodKey = toPeriodKeyUTC(previousLessonPeriodStart);
    await prisma.payment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        enrollmentId: enrollment.id,
        amount: DEFAULT_AMOUNT,
        paidAmount: DEFAULT_AMOUNT,
        dueDate: previousDueDate,
        status: 'PAID',
        paidAt: addDaysUTC(previousDueDate, -1),
        paymentMethod: 'MANUAL_PIX',
        proofUrl:
          'https://via.placeholder.com/400x600.png?text=Comprovante+PIX',
        confirmedBy: adminUser.id,
        referenceMonth: toMonthKeyUTC(previousDueDate),
        idempotencyKey: `${student.id}-${previousPeriodKey}`,
      },
    });

    const previousCycleEnd = new Date(previousLessonPeriodStart);
    previousCycleEnd.setUTCMonth(previousCycleEnd.getUTCMonth() + 1);
    await createCompletedLessonsInRange({
      schoolId: school.id,
      studentId: student.id,
      teacherId: teacher.id,
      enrollmentId: enrollment.id,
      weekDay: cfg.weekDay,
      startTime: cfg.startTime,
      fromDate: previousLessonPeriodStart,
      toDate: previousCycleEnd,
    });

    console.log(
      `  ✓ ${cfg.studentName} — vencimento dia ${cfg.dueDay} — ` +
        `último vencimento gerado (mês passado): ${previousDueDate.toISOString().slice(0, 10)} (meio-dia UTC) — ` +
        `próximo vencimento (aprox.): dia ${cfg.dueDay}/mês atual`,
    );
  }

  console.log('\n✅ Seed de teste do cron concluída\n');
  console.log('  ADMIN');
  console.log('  admin@escolademo.com         / admin123\n');
  console.log('  REVISOR GOOGLE PLAY (colar no Play Console → App access)');
  console.log(`  ${REVIEWER_EMAIL}  / ${REVIEWER_PASSWORD}\n`);
  console.log('  ALUNOS DE TESTE (senha123 pra todos os responsáveis)');
  for (const cfg of testStudents) {
    console.log(
      `  ${cfg.guardianEmail.padEnd(30)} — ${cfg.studentName} (vencimento dia ${cfg.dueDay})`,
    );
  }
  console.log('\n  PRÓXIMO PASSO:');
  console.log(
    '  Rode POST /enrollments/renovar-mensalidade-debug e confira nos',
  );
  console.log('  logs do backend quais matrículas foram renovadas. Esperado:');
  console.log('    Dia07, Dia08, Dia09 → DEVEM aparecer como renovados');
  console.log('    Dia10, Dia11 → NÃO devem aparecer (ainda fora da janela)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
