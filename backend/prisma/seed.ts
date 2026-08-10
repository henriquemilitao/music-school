import { PrismaClient, Role, Instrument } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const now = new Date();
const year = now.getFullYear();

// ─────────────────────────────────────────────────────────────
// Helpers de data
// ─────────────────────────────────────────────────────────────

// Constrói a próxima data (a partir de `from`, exclusive) em que
// cai o dia-do-mês `dueDay`. Se `from` já passou do dia deste mês,
// vai pro mês seguinte.
function nextDueDateOnOrAfter(from: Date, dueDay: number): Date {
  let candidate = new Date(from.getFullYear(), from.getMonth(), dueDay);
  if (candidate < from) {
    candidate = new Date(from.getFullYear(), from.getMonth() + 1, dueDay);
  }
  return candidate;
}

// Data de vencimento do ciclo ATUAL (o vencimento deste mês).
// Se esse vencimento já passou, a fatura desse ciclo fica OVERDUE;
// se ainda não chegou, fica PENDING — mas em ambos os casos é ESSE
// vencimento (do mês corrente) que define o ciclo vigente, nunca
// o do mês anterior. Usado no caso PADRÃO (maioria dos alunos).
function currentCycleStart(dueDay: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), dueDay);
}

// Último vencimento que JÁ OCORREU (<= hoje) — usado só nos casos
// especiais (Carla, Cauã, Fernanda) onde o texto se refere a um
// vencimento que já passou, e não ao vencimento deste mês que
// ainda pode estar no futuro.
function lastOccurredCycleStart(dueDay: number): Date {
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), dueDay);
  return thisMonth <= now
    ? thisMonth
    : new Date(now.getFullYear(), now.getMonth() - 1, dueDay);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function referenceMonthLabel(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isPastDue(dueDate: Date): boolean {
  return now > dueDate;
}

// ─────────────────────────────────────────────────────────────
// Helper: cria lições recorrentes num intervalo [fromDate, toDate),
// no dia da semana `weekDay`, marcando COMPLETED se já passou e
// SCHEDULED se ainda não.
// ─────────────────────────────────────────────────────────────
async function createLessonsInRange(p: {
  schoolId: string;
  studentId: string;
  teacherId: string;
  enrollmentId: string;
  weekDay: number;
  startTime: string;
  fromDate: Date;
  toDate: Date;
}) {
  const [h, m] = p.startTime.split(':').map(Number);
  const cursor = new Date(p.fromDate);

  while (cursor < p.toDate) {
    if (cursor.getDay() === p.weekDay) {
      const lessonDate = new Date(cursor);
      lessonDate.setHours(h, m, 0, 0);
      if (lessonDate >= p.fromDate && lessonDate < p.toDate) {
        await prisma.lesson.create({
          data: {
            schoolId: p.schoolId,
            studentId: p.studentId,
            teacherId: p.teacherId,
            enrollmentId: p.enrollmentId,
            scheduledAt: lessonDate,
            durationMinutes: 60,
            status: lessonDate < now ? 'COMPLETED' : 'SCHEDULED',
          },
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
}

async function createPaymentRecord(p: {
  schoolId: string;
  studentId: string;
  enrollmentId: string;
  amount: number;
  dueDate: Date;
  status: 'PAID' | 'OVERDUE' | 'PENDING';
  paidAt?: Date;
}) {
  const label = referenceMonthLabel(p.dueDate);
  const key = `${p.studentId}-${label}`;
  return prisma.payment.create({
    data: {
      schoolId: p.schoolId,
      studentId: p.studentId,
      enrollmentId: p.enrollmentId,
      amount: p.amount,
      dueDate: p.dueDate,
      paidAt: p.paidAt ?? null,
      status: p.status,
      paymentMethod: 'GATEWAY',
      provider: p.status === 'PAID' ? 'abacatepay' : undefined,
      referenceMonth: label,
      idempotencyKey: key,
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Config de cada aluno — dados vindos da grade real de aulas.
// ─────────────────────────────────────────────────────────────
type StudentConfig = {
  guardianName: string;
  guardianEmail: string;
  studentName: string;
  age: number;
  instrument: Instrument;
  weekDay: number; // 0=domingo ... 6=sábado
  startTime: string;
  dueDay: number;
  teacherKey: 'henrique' | 'mineia' | 'thiago';
  amount: number;
  // Casos especiais:
  specialCase?: 'paidAhead' | 'historicoAteVencimento' | 'atrasada';
  paidAheadUntilCycleStart?: Date; // pra "Daniel": início do ciclo já pago
};

const DEFAULT_AMOUNT = 250;

const students: StudentConfig[] = [
  // ── Segunda ──
  {
    guardianName: 'Raphaella',
    guardianEmail: 'raphaella@escolademo.com',
    studentName: 'Daniel',
    age: 11,
    instrument: Instrument.PIANO,
    weekDay: 1,
    startTime: '13:00',
    dueDay: 5,
    teacherKey: 'mineia',
    amount: DEFAULT_AMOUNT,
    specialCase: 'paidAhead',
  },
  {
    guardianName: 'Juliano',
    guardianEmail: 'juliano@escolademo.com',
    studentName: 'Guilherme',
    age: 12,
    instrument: Instrument.VIOLAO,
    weekDay: 1,
    startTime: '18:00',
    dueDay: 8,
    teacherKey: 'henrique',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Juliano',
    guardianEmail: 'juliano@escolademo.com',
    studentName: 'Juliano',
    age: 35,
    instrument: Instrument.VIOLAO,
    weekDay: 1,
    startTime: '19:00',
    dueDay: 8,
    teacherKey: 'henrique',
    amount: DEFAULT_AMOUNT,
  },

  // ── Terça ──
  {
    guardianName: 'Luziana',
    guardianEmail: 'luziana@escolademo.com',
    studentName: 'Agatha',
    age: 13,
    instrument: Instrument.PIANO,
    weekDay: 2,
    startTime: '08:00',
    dueDay: 11,
    teacherKey: 'mineia',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Levi',
    guardianEmail: 'levi@escolademo.com',
    studentName: 'Lívia',
    age: 12,
    instrument: Instrument.PIANO,
    weekDay: 2,
    startTime: '09:00',
    dueDay: 12,
    teacherKey: 'mineia',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Lilian',
    guardianEmail: 'lilian@escolademo.com',
    studentName: 'Heloisa',
    age: 14,
    instrument: Instrument.PIANO,
    weekDay: 2,
    startTime: '10:00',
    dueDay: 10,
    teacherKey: 'mineia',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Claudiana',
    guardianEmail: 'claudiana@escolademo.com',
    studentName: 'Guilherme',
    age: 12,
    instrument: Instrument.PIANO,
    weekDay: 2,
    startTime: '14:00',
    dueDay: 11,
    teacherKey: 'mineia',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Luisa Maria',
    guardianEmail: 'luisamaria@escolademo.com',
    studentName: 'Heloize',
    age: 9,
    instrument: Instrument.PIANO,
    weekDay: 2,
    startTime: '15:00',
    dueDay: 19,
    teacherKey: 'mineia',
    amount: DEFAULT_AMOUNT,
  },

  // ── Quarta ──
  {
    guardianName: 'Sionara',
    guardianEmail: 'sionara@escolademo.com',
    studentName: 'Carla',
    age: 11,
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '08:00',
    dueDay: 23,
    teacherKey: 'thiago',
    amount: DEFAULT_AMOUNT,
    specialCase: 'historicoAteVencimento',
  },
  {
    guardianName: 'Igor ou Jaqueline',
    guardianEmail: 'igor.jaqueline@escolademo.com',
    studentName: 'Lucas',
    age: 10,
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '09:00',
    dueDay: 9,
    teacherKey: 'thiago',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Inoã',
    guardianEmail: 'inoa@escolademo.com',
    studentName: 'Cauã',
    age: 8,
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '10:00',
    dueDay: 29,
    teacherKey: 'thiago',
    amount: DEFAULT_AMOUNT,
    specialCase: 'historicoAteVencimento',
  },
  {
    guardianName: 'Virgínia',
    guardianEmail: 'virginia@escolademo.com',
    studentName: 'João Pedro',
    age: 12,
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '14:00',
    dueDay: 11,
    teacherKey: 'thiago',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Sidneia',
    guardianEmail: 'sidneia@escolademo.com',
    studentName: 'Sara',
    age: 16,
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '15:00',
    dueDay: 11,
    teacherKey: 'thiago',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Rosinéia',
    guardianEmail: 'rosineia@escolademo.com',
    studentName: 'Laura',
    age: 12,
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '16:00',
    dueDay: 9,
    teacherKey: 'thiago',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Danielly',
    guardianEmail: 'danielly@escolademo.com',
    studentName: 'Lara',
    age: 11,
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '17:00',
    dueDay: 12,
    teacherKey: 'thiago',
    amount: DEFAULT_AMOUNT,
  },

  // ── Quinta ──
  {
    guardianName: 'Regiane',
    guardianEmail: 'regiane@escolademo.com',
    studentName: 'Isabella',
    age: 12,
    instrument: Instrument.PIANO,
    weekDay: 4,
    startTime: '12:30',
    dueDay: 11,
    teacherKey: 'mineia',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Mineia Responsável',
    guardianEmail: 'renan.responsavel@escolademo.com',
    studentName: 'Renan',
    age: 13,
    instrument: Instrument.PIANO,
    weekDay: 4,
    startTime: '14:30',
    dueDay: 13,
    teacherKey: 'thiago',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Valter e Mayara',
    guardianEmail: 'valter.mayara@escolademo.com',
    studentName: 'Felipe',
    age: 12,
    instrument: Instrument.VIOLAO,
    weekDay: 4,
    startTime: '14:30',
    dueDay: 11,
    teacherKey: 'henrique',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Cláudia',
    guardianEmail: 'claudia@escolademo.com',
    studentName: 'Luísa',
    age: 12,
    instrument: Instrument.PIANO,
    weekDay: 4,
    startTime: '15:30',
    dueDay: 12,
    teacherKey: 'thiago',
    amount: 280,
  },
  {
    guardianName: 'Cláudia',
    guardianEmail: 'claudia@escolademo.com',
    studentName: 'Matheus',
    age: 16,
    instrument: Instrument.BATERIA,
    weekDay: 4,
    startTime: '15:30',
    dueDay: 12,
    teacherKey: 'henrique',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Sônia',
    guardianEmail: 'sonia@escolademo.com',
    studentName: 'Camila',
    age: 16,
    instrument: Instrument.PIANO,
    weekDay: 4,
    startTime: '16:30',
    dueDay: 10,
    teacherKey: 'thiago',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Cristiane',
    guardianEmail: 'cristiane@escolademo.com',
    studentName: 'Fernanda',
    age: 14,
    instrument: Instrument.VIOLAO,
    weekDay: 4,
    startTime: '18:00',
    dueDay: 12,
    teacherKey: 'henrique',
    amount: DEFAULT_AMOUNT,
    specialCase: 'atrasada',
  },
  {
    guardianName: 'Cledisnari',
    guardianEmail: 'cledisnari@escolademo.com',
    studentName: 'Jazlín',
    age: 11,
    instrument: Instrument.PIANO,
    weekDay: 4,
    startTime: '18:00',
    dueDay: 6,
    teacherKey: 'mineia',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Elder',
    guardianEmail: 'elder@escolademo.com',
    studentName: 'Gustavo',
    age: 16,
    instrument: Instrument.VIOLAO,
    weekDay: 4,
    startTime: '19:00',
    dueDay: 12,
    teacherKey: 'henrique',
    amount: DEFAULT_AMOUNT,
  },
  {
    guardianName: 'Rafael',
    guardianEmail: 'rafael@escolademo.com',
    studentName: 'Rafael',
    age: 33,
    instrument: Instrument.VIOLAO,
    weekDay: 4,
    startTime: '20:00',
    dueDay: 7,
    teacherKey: 'henrique',
    amount: DEFAULT_AMOUNT,
  },
];

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🧹 Limpando banco...');
  await prisma.payment.deleteMany();
  await prisma.paymentBundle.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.guardian.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();

  const school = await prisma.school.create({
    data: {
      name: 'Escola de Música Demo',
      slug: 'escola-demo',
      email: 'contato@escolademo.com',
      phone: '11999999999',
    },
  });

  await prisma.user.create({
    data: {
      schoolId: school.id,
      name: 'Admin',
      email: 'admin@escolademo.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: Role.ADMIN,
    },
  });

  async function createTeacher(name: string, email: string, bio: string) {
    const user = await prisma.user.create({
      data: {
        schoolId: school.id,
        name,
        email,
        passwordHash: await bcrypt.hash('prof123', 10),
        role: Role.TEACHER,
      },
    });
    return prisma.teacher.create({ data: { userId: user.id, bio } });
  }

  const henrique = await createTeacher(
    'Henrique',
    'henrique.professor@escolademo.com',
    'Professor de violão e bateria.',
  );
  const mineia = await createTeacher(
    'Mineia',
    'mineia.professora@escolademo.com',
    'Professora de piano.',
  );
  const thiago = await createTeacher(
    'Thiago',
    'thiago.professor@escolademo.com',
    'Professor de piano.',
  );

  const teacherMap = { henrique, mineia, thiago };

  // Cache de usuários (responsáveis) já criados — pra não duplicar
  // quando 2 alunos compartilham o mesmo responsável (Cláudia, Juliano).
  const guardianUserCache = new Map<string, string>(); // email -> userId

  async function getOrCreateGuardianUser(name: string, email: string) {
    if (guardianUserCache.has(email)) return guardianUserCache.get(email)!;
    const user = await prisma.user.create({
      data: {
        schoolId: school.id,
        name,
        email,
        passwordHash: await bcrypt.hash('senha123', 10),
        role: Role.STUDENT,
      },
    });
    guardianUserCache.set(email, user.id);
    return user.id;
  }

  console.log('👨‍👩‍👧 Criando responsáveis, alunos, matrículas e faturas...\n');

  for (const cfg of students) {
    const userId = await getOrCreateGuardianUser(
      cfg.guardianName,
      cfg.guardianEmail,
    );

    const student = await prisma.student.create({
      data: {
        userId,
        name: cfg.studentName,
        instrument: cfg.instrument,
        birthDate: new Date(year - cfg.age, 0, 1),
      },
    });

    const teacher = teacherMap[cfg.teacherKey];

    // Casos especiais (Carla, Cauã, Fernanda, Daniel) se referem a
    // um vencimento que já ocorreu; o caso padrão usa o vencimento
    // deste mês mesmo que ainda esteja por vir (fatura PENDING).
    const isSpecial = cfg.specialCase !== undefined;
    const cycleStart = isSpecial
      ? lastOccurredCycleStart(cfg.dueDay)
      : currentCycleStart(cfg.dueDay);
    const nextCycleStart = addMonths(cycleStart, 1);

    const enrollment = await prisma.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        teacherId: teacher.id,
        weekDay: cfg.weekDay,
        startTime: cfg.startTime,
        durationMinutes: 60,
        monthlyAmount: cfg.amount,
        startDate: cycleStart,
      },
    });

    if (cfg.specialCase === 'paidAhead') {
      // Daniel: pago até setembro. Cria os ciclos de mês corrente
      // e o de setembro como PAID, e aulas SCHEDULED cobrindo os
      // dois ciclos (o vigente + o de set/05 a out/04).
      const currentDue = cycleStart;
      const nextDue = nextCycleStart;

      await createPaymentRecord({
        schoolId: school.id,
        studentId: student.id,
        enrollmentId: enrollment.id,
        amount: cfg.amount,
        dueDate: currentDue,
        status: 'PAID',
        paidAt: new Date(currentDue.getTime() - 3 * 24 * 60 * 60 * 1000),
      });
      await createPaymentRecord({
        schoolId: school.id,
        studentId: student.id,
        enrollmentId: enrollment.id,
        amount: cfg.amount,
        dueDate: nextDue,
        status: 'PAID',
        paidAt: new Date(currentDue.getTime() + 2 * 24 * 60 * 60 * 1000),
      });

      // Aulas cobrindo os dois ciclos (do vencimento atual até o
      // início do ciclo seguinte ao de setembro) — tudo SCHEDULED,
      // já que não há histórico de aulas passadas pra ele.
      const coverageEnd = addMonths(nextDue, 1);
      await createLessonsInRange({
        schoolId: school.id,
        studentId: student.id,
        teacherId: teacher.id,
        enrollmentId: enrollment.id,
        weekDay: cfg.weekDay,
        startTime: cfg.startTime,
        fromDate: now > currentDue ? now : currentDue,
        toDate: coverageEnd,
      });
    } else if (cfg.specialCase === 'historicoAteVencimento') {
      // Carla / Cauã: ciclo atual já PAID, aulas do ciclo inteiro
      // (passadas = COMPLETED, futuras = SCHEDULED).
      await createPaymentRecord({
        schoolId: school.id,
        studentId: student.id,
        enrollmentId: enrollment.id,
        amount: cfg.amount,
        dueDate: cycleStart,
        status: 'PAID',
        paidAt: new Date(cycleStart.getTime() - 2 * 24 * 60 * 60 * 1000),
      });

      await createLessonsInRange({
        schoolId: school.id,
        studentId: student.id,
        teacherId: teacher.id,
        enrollmentId: enrollment.id,
        weekDay: cfg.weekDay,
        startTime: cfg.startTime,
        fromDate: cycleStart,
        toDate: nextCycleStart,
      });
    } else if (cfg.specialCase === 'atrasada') {
      // Fernanda: ciclo atual (venceu, não pagou) fica OVERDUE, SEM
      // aulas nesse ciclo. Aulas só no próximo ciclo (SCHEDULED).
      await createPaymentRecord({
        schoolId: school.id,
        studentId: student.id,
        enrollmentId: enrollment.id,
        amount: cfg.amount,
        dueDate: cycleStart,
        status: 'OVERDUE',
      });

      const afterNextCycleStart = addMonths(nextCycleStart, 1);
      await createLessonsInRange({
        schoolId: school.id,
        studentId: student.id,
        teacherId: teacher.id,
        enrollmentId: enrollment.id,
        weekDay: cfg.weekDay,
        startTime: cfg.startTime,
        fromDate: nextCycleStart,
        toDate: afterNextCycleStart,
      });
    } else {
      // Caso padrão: fatura do ciclo atual PENDING ou OVERDUE
      // (dependendo se o vencimento já passou), sem histórico, e
      // aulas SCHEDULED cobrindo exatamente o ciclo vigente.
      await createPaymentRecord({
        schoolId: school.id,
        studentId: student.id,
        enrollmentId: enrollment.id,
        amount: cfg.amount,
        dueDate: cycleStart,
        status: isPastDue(cycleStart) ? 'OVERDUE' : 'PENDING',
      });

      await createLessonsInRange({
        schoolId: school.id,
        studentId: student.id,
        teacherId: teacher.id,
        enrollmentId: enrollment.id,
        weekDay: cfg.weekDay,
        startTime: cfg.startTime,
        fromDate: cycleStart,
        toDate: nextCycleStart,
      });
    }

    console.log(
      `  ✓ ${cfg.studentName} (${cfg.guardianName}) — ${cfg.instrument} · ${cfg.teacherKey}`,
    );
  }

  console.log('\n✅ Seed concluído\n');
  console.log('  PROFESSORES');
  console.log(
    '  henrique.professor@escolademo.com   / prof123  (violão + bateria)',
  );
  console.log('  mineia.professora@escolademo.com    / prof123  (piano)');
  console.log('  thiago.professor@escolademo.com     / prof123  (piano)');
  console.log('');
  console.log('  RESPONSÁVEIS (senha123 pra todos)');
  for (const [email] of guardianUserCache) {
    const owned = students.filter((s) => s.guardianEmail === email);
    console.log(
      `  ${email.padEnd(35)} — ${owned.map((s) => s.studentName).join(', ')}`,
    );
  }
  console.log('');
  console.log('  ADMIN');
  console.log('  admin@escolademo.com         / admin123');
  console.log('');
  console.log('  CASOS ESPECIAIS');
  console.log('  Daniel   — pago até setembro, aulas já criadas até 04/10');
  console.log('  Carla    — vence dia 23, tem histórico (COMPLETED) + futuras');
  console.log('  Cauã     — vence dia 29, tem histórico (COMPLETED) + futuras');
  console.log(
    '  Fernanda — venceu 12/07, OVERDUE, aulas só a partir do próximo ciclo (12/08)',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
