import { PrismaClient, Role, Instrument } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AbacatePayProvider } from '../src/payments/providers/abacatepay.provider';
import { ConfigService } from '@nestjs/config';

const prisma = new PrismaClient();

const fakeConfigService = {
  getOrThrow: <T = string>(key: string): T => {
    const value = process.env[key];
    if (!value) throw new Error(`Variável de ambiente ausente: ${key}`);
    return value as T;
  },
} as ConfigService;

const abacatePayProvider = new AbacatePayProvider(fakeConfigService);

const now = new Date();

// ─────────────────────────────────────────────────────────────
// Helper: cria um pagamento (idempotente por idempotencyKey)
// ─────────────────────────────────────────────────────────────
type PaymentEntry = {
  month: number;
  status: 'PAID' | 'OVERDUE' | 'PENDING';
  paidAt?: Date;
};

async function createPayment(p: {
  schoolId: string;
  studentId: string;
  enrollmentId: string;
  amount: number;
  year: number;
  month: number;
  dueDay: number;
  status: 'PAID' | 'OVERDUE' | 'PENDING';
  paidAt?: Date;
}) {
  const label = `${p.year}-${String(p.month).padStart(2, '0')}`;
  const key = `${p.studentId}-${label}`;
  const existing = await prisma.payment.findUnique({
    where: { idempotencyKey: key },
  });
  if (existing) return existing;

  return prisma.payment.create({
    data: {
      schoolId: p.schoolId,
      studentId: p.studentId,
      enrollmentId: p.enrollmentId,
      amount: p.amount,
      dueDate: new Date(p.year, p.month - 1, p.dueDay),
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
// Helper: cria aulas CONCLUÍDAS num intervalo de datas
// ─────────────────────────────────────────────────────────────
async function createCompletedLessons(p: {
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

  while (cursor <= p.toDate) {
    if (cursor.getDay() === p.weekDay) {
      const lessonDate = new Date(cursor);
      lessonDate.setHours(h, m, 0, 0);
      if (lessonDate < now) {
        await prisma.lesson.create({
          data: {
            schoolId: p.schoolId,
            studentId: p.studentId,
            teacherId: p.teacherId,
            enrollmentId: p.enrollmentId,
            scheduledAt: lessonDate,
            durationMinutes: 60,
            status: 'COMPLETED',
          },
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: cria aulas AGENDADAS (futuras) nos próximos N dias
// ─────────────────────────────────────────────────────────────
async function createUpcomingLessons(p: {
  schoolId: string;
  studentId: string;
  teacherId: string;
  enrollmentId: string;
  weekDay: number;
  startTime: string;
  daysAhead?: number;
}) {
  const daysAhead = p.daysAhead ?? 45;
  const [h, m] = p.startTime.split(':').map(Number);
  const cursor = new Date(now);
  const end = new Date(now);
  end.setDate(end.getDate() + daysAhead);

  while (cursor <= end) {
    if (cursor.getDay() === p.weekDay) {
      const lessonDate = new Date(cursor);
      lessonDate.setHours(h, m, 0, 0);
      if (lessonDate > now) {
        await prisma.lesson.create({
          data: {
            schoolId: p.schoolId,
            studentId: p.studentId,
            teacherId: p.teacherId,
            enrollmentId: p.enrollmentId,
            scheduledAt: lessonDate,
            durationMinutes: 60,
            status: 'SCHEDULED',
          },
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: matrícula simples — apenas ciclo vigente (sem histórico)
// ─────────────────────────────────────────────────────────────
async function seedEnrollmentCurrentMonthOnly(params: {
  schoolId: string;
  studentId: string;
  teacherId: string;
  weekDay: number;
  startTime: string;
  monthlyAmount: number;
  dueDay: number;
  enrollmentStartDate: Date;
}) {
  const {
    schoolId,
    studentId,
    teacherId,
    weekDay,
    startTime,
    monthlyAmount,
    dueDay,
    enrollmentStartDate,
  } = params;

  await prisma.lesson.deleteMany({ where: { studentId } });
  await prisma.payment.deleteMany({ where: { studentId } });
  await prisma.enrollment.deleteMany({ where: { studentId } });

  const enrollment = await prisma.enrollment.create({
    data: {
      schoolId,
      studentId,
      teacherId,
      weekDay,
      startTime,
      durationMinutes: 60,
      monthlyAmount,
      startDate: enrollmentStartDate,
      lastGeneratedMonth: null,
      lastPeriodStart: null,
    },
  });

  const cycleStart = new Date(now.getFullYear(), now.getMonth(), dueDay);
  const cycleEnd = new Date(
    cycleStart.getFullYear(),
    cycleStart.getMonth() + 1,
    dueDay,
  );
  const label = `${cycleStart.getFullYear()}-${String(cycleStart.getMonth() + 1).padStart(2, '0')}`;

  await prisma.payment.create({
    data: {
      schoolId,
      studentId,
      enrollmentId: enrollment.id,
      amount: monthlyAmount,
      dueDate: cycleStart,
      status: now > cycleStart ? 'OVERDUE' : 'PENDING',
      paymentMethod: 'GATEWAY',
      referenceMonth: label,
      idempotencyKey: `${studentId}-${label}`,
    },
  });

  const cursor = new Date(cycleStart);
  while (cursor < cycleEnd) {
    if (cursor.getDay() === weekDay) {
      const [h, m] = startTime.split(':').map(Number);
      const lessonDate = new Date(cursor);
      lessonDate.setHours(h, m, 0, 0);
      if (lessonDate >= now) {
        await prisma.lesson.create({
          data: {
            schoolId,
            studentId,
            teacherId,
            enrollmentId: enrollment.id,
            scheduledAt: lessonDate,
            durationMinutes: 60,
            status: 'SCHEDULED',
          },
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return enrollment;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  const school = await prisma.school.upsert({
    where: { slug: 'escola-demo' },
    update: {},
    create: {
      name: 'Escola de Música Demo',
      slug: 'escola-demo',
      email: 'contato@escolademo.com',
      phone: '11999999999',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@escolademo.com' },
    update: {},
    create: {
      schoolId: school.id,
      name: 'Admin',
      email: 'admin@escolademo.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: Role.ADMIN,
    },
  });

  async function upsertTeacher(name: string, email: string, bio: string) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        schoolId: school.id,
        name,
        email,
        passwordHash: await bcrypt.hash('prof123', 10),
        role: Role.TEACHER,
      },
    });
    const teacher = await prisma.teacher.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, bio },
    });
    return teacher;
  }

  const henrique = await upsertTeacher(
    'Henrique',
    'henrique.professor@escolademo.com',
    'Professor de violão e bateria.',
  );
  const mineia = await upsertTeacher(
    'Mineia',
    'mineia.professora@escolademo.com',
    'Professora de piano.',
  );
  const thiago = await upsertTeacher(
    'Thiago',
    'thiago.professor@escolademo.com',
    'Professor de piano.',
  );
  const carlos = await upsertTeacher(
    'Carlos Professor',
    'professor@escolademo.com',
    'Professor de violão e guitarra com 10 anos de experiência.',
  );

  async function upsertUserWithStudent(paramsArg: {
    userName: string;
    userEmail: string;
    studentName: string;
    instrument: Instrument;
    birthDate: Date;
  }) {
    const user = await prisma.user.upsert({
      where: { email: paramsArg.userEmail },
      update: {},
      create: {
        schoolId: school.id,
        name: paramsArg.userName,
        email: paramsArg.userEmail,
        passwordHash: await bcrypt.hash('senha123', 10),
        role: Role.STUDENT,
      },
    });
    const student =
      (await prisma.student.findFirst({
        where: { userId: user.id, name: paramsArg.studentName },
      })) ??
      (await prisma.student.create({
        data: {
          userId: user.id,
          name: paramsArg.studentName,
          instrument: paramsArg.instrument,
          birthDate: paramsArg.birthDate,
        },
      }));
    return { user, student };
  }

  const year = now.getFullYear();

  // ═══════════════════════════════════════════════════════════════
  // JOÃO — histórico longo, jul+ago OVERDUE (com PIX real)
  // ═══════════════════════════════════════════════════════════════
  const { student: joaoStudent } = await upsertUserWithStudent({
    userName: 'João Aluno',
    userEmail: 'aluno@escolademo.com',
    studentName: 'João Aluno',
    instrument: Instrument.VIOLAO,
    birthDate: new Date('2010-05-14'),
  });

  if (
    !(await prisma.enrollment.findFirst({
      where: { studentId: joaoStudent.id },
    }))
  ) {
    const startDate = new Date(year, 2, 5);
    const enrollment = await prisma.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: joaoStudent.id,
        teacherId: carlos.id,
        weekDay: startDate.getDay(),
        startTime: '15:00',
        durationMinutes: 60,
        monthlyAmount: 250,
        startDate,
        lastGeneratedMonth: null,
        lastPeriodStart: null,
      },
    });

    const paidHistory: Record<string, Date> = {
      [`${year}-03`]: new Date(year, 2, 6),
      [`${year}-04`]: new Date(year, 3, 6),
      [`${year}-05`]: new Date(year, 4, 6),
      [`${year}-06`]: new Date(year, 5, 6),
    };

    let cursorMonth = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      1,
    );
    const julyAnchor = new Date(year, 6, 1);

    while (cursorMonth <= julyAnchor) {
      const label = `${cursorMonth.getFullYear()}-${String(cursorMonth.getMonth() + 1).padStart(2, '0')}`;
      const dueDate = new Date(
        cursorMonth.getFullYear(),
        cursorMonth.getMonth(),
        5,
      );
      const isJuly = label === `${year}-07`;
      const paidAt = paidHistory[label];

      if (paidAt) {
        await prisma.payment.create({
          data: {
            schoolId: school.id,
            studentId: joaoStudent.id,
            enrollmentId: enrollment.id,
            amount: 250,
            dueDate,
            paidAt,
            status: 'PAID',
            paymentMethod: 'GATEWAY',
            provider: 'abacatepay',
            referenceMonth: label,
            idempotencyKey: `${joaoStudent.id}-${label}`,
          },
        });
      } else if (isJuly) {
        const payment = await prisma.payment.create({
          data: {
            schoolId: school.id,
            studentId: joaoStudent.id,
            enrollmentId: enrollment.id,
            amount: 250,
            dueDate,
            status: 'OVERDUE',
            paymentMethod: 'GATEWAY',
            referenceMonth: label,
            idempotencyKey: `${joaoStudent.id}-${label}`,
          },
        });
        console.log('⏳ Gerando PIX real (João - julho)...');
        const charge = await abacatePayProvider.createCharge({
          amount: 250,
          externalReference: `payment:${payment.id}`,
          description: `Mensalidade ${label} - João Aluno`,
        });
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            provider: 'abacatepay',
            externalId: charge.externalId,
            pixCopyPaste: charge.pixCopyPaste,
            pixQrCode: charge.pixQrCode,
          },
        });
        console.log('✅ PIX gerado para', label);
      }
      cursorMonth = new Date(
        cursorMonth.getFullYear(),
        cursorMonth.getMonth() + 1,
        1,
      );
    }

    const augustDueDate = new Date(year, 7, 5);
    const augustLabel = `${year}-08`;
    const augustPayment = await prisma.payment.create({
      data: {
        schoolId: school.id,
        studentId: joaoStudent.id,
        enrollmentId: enrollment.id,
        amount: 250,
        dueDate: augustDueDate,
        status: now > augustDueDate ? 'OVERDUE' : 'PENDING',
        paymentMethod: 'GATEWAY',
        referenceMonth: augustLabel,
        idempotencyKey: `${joaoStudent.id}-${augustLabel}`,
      },
    });
    console.log('⏳ Gerando PIX real (João - agosto)...');
    const augustCharge = await abacatePayProvider.createCharge({
      amount: 250,
      externalReference: augustPayment.id,
      description: `Mensalidade ${augustLabel} - João Aluno`,
    });
    await prisma.payment.update({
      where: { id: augustPayment.id },
      data: {
        provider: 'abacatepay',
        externalId: augustCharge.externalId,
        pixCopyPaste: augustCharge.pixCopyPaste,
        pixQrCode: augustCharge.pixQrCode,
      },
    });
    console.log('✅ PIX gerado para', augustLabel);

    const guaranteedNextLesson = new Date(now);
    guaranteedNextLesson.setDate(now.getDate() + 7);
    guaranteedNextLesson.setHours(15, 0, 0, 0);
    await prisma.lesson.create({
      data: {
        schoolId: school.id,
        studentId: joaoStudent.id,
        teacherId: carlos.id,
        enrollmentId: enrollment.id,
        scheduledAt: guaranteedNextLesson,
        durationMinutes: 60,
        status: 'SCHEDULED',
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CLÁUDIA — 2 filhos com situações opostas
  //   Matheus: fev–mai PAID · jun OVERDUE · jul OVERDUE · ago PENDING
  //   Luísa:   fev–jul PAID (EM DIA)      · ago PENDING
  // ═══════════════════════════════════════════════════════════════
  const { student: matheus } = await upsertUserWithStudent({
    userName: 'Cláudia',
    userEmail: 'claudia@escolademo.com',
    studentName: 'Matheus',
    instrument: Instrument.BATERIA,
    birthDate: new Date(year - 15, 0, 1),
  });
  const { student: luisa } = await upsertUserWithStudent({
    userName: 'Cláudia',
    userEmail: 'claudia@escolademo.com',
    studentName: 'Luísa',
    instrument: Instrument.PIANO,
    birthDate: new Date(year - 12, 0, 1),
  });

  for (const id of [matheus.id, luisa.id]) {
    await prisma.lesson.deleteMany({ where: { studentId: id } });
    await prisma.payment.deleteMany({ where: { studentId: id } });
    await prisma.enrollment.deleteMany({ where: { studentId: id } });
  }

  // ── Matheus ──
  const matheusEnrollment = await prisma.enrollment.create({
    data: {
      schoolId: school.id,
      studentId: matheus.id,
      teacherId: henrique.id,
      weekDay: 4,
      startTime: '15:30',
      durationMinutes: 60,
      monthlyAmount: 250,
      startDate: new Date(year, 1, 12),
    },
  });
  const matheusPayments: PaymentEntry[] = [
    { month: 2, status: 'PAID', paidAt: new Date(year, 1, 14) },
    { month: 3, status: 'PAID', paidAt: new Date(year, 2, 13) },
    { month: 4, status: 'PAID', paidAt: new Date(year, 3, 15) },
    { month: 5, status: 'PAID', paidAt: new Date(year, 4, 13) },
    { month: 6, status: 'OVERDUE' }, // ← 1º atraso
    { month: 7, status: 'OVERDUE' }, // ← 2º atraso
    { month: 8, status: now > new Date(year, 7, 12) ? 'OVERDUE' : 'PENDING' },
  ];
  for (const p of matheusPayments) {
    await createPayment({
      schoolId: school.id,
      studentId: matheus.id,
      enrollmentId: matheusEnrollment.id,
      amount: 250,
      year,
      month: p.month,
      dueDay: 12,
      status: p.status,
      paidAt: p.paidAt,
    });
  }
  await createCompletedLessons({
    schoolId: school.id,
    studentId: matheus.id,
    teacherId: henrique.id,
    enrollmentId: matheusEnrollment.id,
    weekDay: 4,
    startTime: '15:30',
    fromDate: new Date(year, 1, 15),
    toDate: now,
  });
  await createUpcomingLessons({
    schoolId: school.id,
    studentId: matheus.id,
    teacherId: henrique.id,
    enrollmentId: matheusEnrollment.id,
    weekDay: 4,
    startTime: '15:30',
  });

  // ── Luísa (EM DIA, valor diferente R$280 p/ testar valores assimétricos) ──
  const luisaEnrollment = await prisma.enrollment.create({
    data: {
      schoolId: school.id,
      studentId: luisa.id,
      teacherId: mineia.id,
      weekDay: 4,
      startTime: '16:30',
      durationMinutes: 60,
      monthlyAmount: 280,
      startDate: new Date(year, 1, 12),
    },
  });
  const luisaPayments: PaymentEntry[] = [
    { month: 2, status: 'PAID', paidAt: new Date(year, 1, 13) },
    { month: 3, status: 'PAID', paidAt: new Date(year, 2, 12) },
    { month: 4, status: 'PAID', paidAt: new Date(year, 3, 12) },
    { month: 5, status: 'PAID', paidAt: new Date(year, 4, 12) },
    { month: 6, status: 'PAID', paidAt: new Date(year, 5, 13) },
    { month: 7, status: 'PAID', paidAt: new Date(year, 6, 14) },
    { month: 8, status: now > new Date(year, 7, 12) ? 'OVERDUE' : 'PENDING' },
  ];
  for (const p of luisaPayments) {
    await createPayment({
      schoolId: school.id,
      studentId: luisa.id,
      enrollmentId: luisaEnrollment.id,
      amount: 280,
      year,
      month: p.month,
      dueDay: 12,
      status: p.status,
      paidAt: p.paidAt,
    });
  }
  await createCompletedLessons({
    schoolId: school.id,
    studentId: luisa.id,
    teacherId: mineia.id,
    enrollmentId: luisaEnrollment.id,
    weekDay: 4,
    startTime: '16:30',
    fromDate: new Date(year, 1, 15),
    toDate: now,
  });
  await createUpcomingLessons({
    schoolId: school.id,
    studentId: luisa.id,
    teacherId: mineia.id,
    enrollmentId: luisaEnrollment.id,
    weekDay: 4,
    startTime: '16:30',
  });

  // ═══════════════════════════════════════════════════════════════
  // JADSON — 4 alunos vinculados (caso extremo para testes de UI)
  //   Jadson:          mar–jul PAID · ago PENDING       (EM DIA)
  //   Amanda:          abr–mai PAID · jun+jul OVERDUE   (2 atrasos)
  //   Jadinho Violão:  mai–jul PAID · ago PENDING       (EM DIA)
  //   Jadinho Bateria: jun OVERDUE · jul PAID (tardio)  (1 atraso + 1 pendente)
  // ═══════════════════════════════════════════════════════════════
  const { user: jadsonUser, student: jadsonStudent } =
    await upsertUserWithStudent({
      userName: 'Jadson',
      userEmail: 'jadson@escolademo.com',
      studentName: 'Jadson',
      instrument: Instrument.BATERIA,
      birthDate: new Date(year - 38, 3, 15),
    });
  const { student: amandaStudent } = await upsertUserWithStudent({
    userName: 'Jadson',
    userEmail: 'jadson@escolademo.com',
    studentName: 'Amanda',
    instrument: Instrument.PIANO,
    birthDate: new Date(year - 35, 7, 20),
  });
  const { student: jadinhoViolaoStudent } = await upsertUserWithStudent({
    userName: 'Jadson',
    userEmail: 'jadson@escolademo.com',
    studentName: 'Jadinho',
    instrument: Instrument.VIOLAO,
    birthDate: new Date(year - 10, 0, 1),
  });

  // Jadinho (Bateria) — mesmo filho, segundo instrumento: cria manualmente
  let jadinhoBateriaStudent = await prisma.student.findFirst({
    where: {
      userId: jadsonUser.id,
      name: 'Jadinho',
      instrument: Instrument.BATERIA,
    },
  });
  if (!jadinhoBateriaStudent) {
    jadinhoBateriaStudent = await prisma.student.create({
      data: {
        userId: jadsonUser.id,
        name: 'Jadinho',
        instrument: Instrument.BATERIA,
        birthDate: new Date(year - 10, 0, 1),
      },
    });
  }

  for (const id of [
    jadsonStudent.id,
    amandaStudent.id,
    jadinhoViolaoStudent.id,
    jadinhoBateriaStudent.id,
  ]) {
    await prisma.lesson.deleteMany({ where: { studentId: id } });
    await prisma.payment.deleteMany({ where: { studentId: id } });
    await prisma.enrollment.deleteMany({ where: { studentId: id } });
  }

  // ── Jadson (EM DIA) ──
  const jadsonEnrollment = await prisma.enrollment.create({
    data: {
      schoolId: school.id,
      studentId: jadsonStudent.id,
      teacherId: henrique.id,
      weekDay: 2,
      startTime: '18:00',
      durationMinutes: 60,
      monthlyAmount: 250,
      startDate: new Date(year, 2, 15),
    },
  });
  const jadsonPayments: PaymentEntry[] = [
    { month: 3, status: 'PAID', paidAt: new Date(year, 2, 16) },
    { month: 4, status: 'PAID', paidAt: new Date(year, 3, 16) },
    { month: 5, status: 'PAID', paidAt: new Date(year, 4, 15) },
    { month: 6, status: 'PAID', paidAt: new Date(year, 5, 16) },
    { month: 7, status: 'PAID', paidAt: new Date(year, 6, 16) },
    { month: 8, status: now > new Date(year, 7, 15) ? 'OVERDUE' : 'PENDING' },
  ];
  for (const p of jadsonPayments) {
    await createPayment({
      schoolId: school.id,
      studentId: jadsonStudent.id,
      enrollmentId: jadsonEnrollment.id,
      amount: 250,
      year,
      month: p.month,
      dueDay: 15,
      status: p.status,
      paidAt: p.paidAt,
    });
  }
  await createCompletedLessons({
    schoolId: school.id,
    studentId: jadsonStudent.id,
    teacherId: henrique.id,
    enrollmentId: jadsonEnrollment.id,
    weekDay: 2,
    startTime: '18:00',
    fromDate: new Date(year, 2, 15),
    toDate: now,
  });
  await createUpcomingLessons({
    schoolId: school.id,
    studentId: jadsonStudent.id,
    teacherId: henrique.id,
    enrollmentId: jadsonEnrollment.id,
    weekDay: 2,
    startTime: '18:00',
  });

  // ── Amanda (2 atrasos) ──
  const amandaEnrollment = await prisma.enrollment.create({
    data: {
      schoolId: school.id,
      studentId: amandaStudent.id,
      teacherId: mineia.id,
      weekDay: 3,
      startTime: '17:00',
      durationMinutes: 60,
      monthlyAmount: 280,
      startDate: new Date(year, 3, 15),
    },
  });
  const amandaPayments: PaymentEntry[] = [
    { month: 4, status: 'PAID', paidAt: new Date(year, 3, 16) },
    { month: 5, status: 'PAID', paidAt: new Date(year, 4, 16) },
    { month: 6, status: 'OVERDUE' }, // ← 1º atraso
    { month: 7, status: 'OVERDUE' }, // ← 2º atraso
    { month: 8, status: now > new Date(year, 7, 15) ? 'OVERDUE' : 'PENDING' },
  ];
  for (const p of amandaPayments) {
    await createPayment({
      schoolId: school.id,
      studentId: amandaStudent.id,
      enrollmentId: amandaEnrollment.id,
      amount: 280,
      year,
      month: p.month,
      dueDay: 15,
      status: p.status,
      paidAt: p.paidAt,
    });
  }
  await createCompletedLessons({
    schoolId: school.id,
    studentId: amandaStudent.id,
    teacherId: mineia.id,
    enrollmentId: amandaEnrollment.id,
    weekDay: 3,
    startTime: '17:00',
    fromDate: new Date(year, 3, 15),
    toDate: now,
  });
  await createUpcomingLessons({
    schoolId: school.id,
    studentId: amandaStudent.id,
    teacherId: mineia.id,
    enrollmentId: amandaEnrollment.id,
    weekDay: 3,
    startTime: '17:00',
  });

  // ── Jadinho (Violão — EM DIA) ──
  const jadinhoViolaoEnrollment = await prisma.enrollment.create({
    data: {
      schoolId: school.id,
      studentId: jadinhoViolaoStudent.id,
      teacherId: carlos.id,
      weekDay: 6,
      startTime: '10:00',
      durationMinutes: 60,
      monthlyAmount: 250,
      startDate: new Date(year, 4, 15),
    },
  });
  const jadinhoViolaoPayments: PaymentEntry[] = [
    { month: 5, status: 'PAID', paidAt: new Date(year, 4, 16) },
    { month: 6, status: 'PAID', paidAt: new Date(year, 5, 16) },
    { month: 7, status: 'PAID', paidAt: new Date(year, 6, 16) },
    { month: 8, status: now > new Date(year, 7, 15) ? 'OVERDUE' : 'PENDING' },
  ];
  for (const p of jadinhoViolaoPayments) {
    await createPayment({
      schoolId: school.id,
      studentId: jadinhoViolaoStudent.id,
      enrollmentId: jadinhoViolaoEnrollment.id,
      amount: 250,
      year,
      month: p.month,
      dueDay: 15,
      status: p.status,
      paidAt: p.paidAt,
    });
  }
  await createCompletedLessons({
    schoolId: school.id,
    studentId: jadinhoViolaoStudent.id,
    teacherId: carlos.id,
    enrollmentId: jadinhoViolaoEnrollment.id,
    weekDay: 6,
    startTime: '10:00',
    fromDate: new Date(year, 4, 15),
    toDate: now,
  });
  await createUpcomingLessons({
    schoolId: school.id,
    studentId: jadinhoViolaoStudent.id,
    teacherId: carlos.id,
    enrollmentId: jadinhoViolaoEnrollment.id,
    weekDay: 6,
    startTime: '10:00',
  });

  // ── Jadinho (Bateria — jun OVERDUE, jul PAID tardio, ago PENDING) ──
  const jadinhoBateriaEnrollment = await prisma.enrollment.create({
    data: {
      schoolId: school.id,
      studentId: jadinhoBateriaStudent.id,
      teacherId: henrique.id,
      weekDay: 6,
      startTime: '11:00',
      durationMinutes: 60,
      monthlyAmount: 250,
      startDate: new Date(year, 5, 15),
    },
  });
  const jadinhoBateriaPayments: PaymentEntry[] = [
    { month: 6, status: 'OVERDUE' }, // ← atrasou
    { month: 7, status: 'PAID', paidAt: new Date(year, 6, 28) }, // ← pagou jul com atraso
    { month: 8, status: now > new Date(year, 7, 15) ? 'OVERDUE' : 'PENDING' },
  ];
  for (const p of jadinhoBateriaPayments) {
    await createPayment({
      schoolId: school.id,
      studentId: jadinhoBateriaStudent.id,
      enrollmentId: jadinhoBateriaEnrollment.id,
      amount: 250,
      year,
      month: p.month,
      dueDay: 15,
      status: p.status,
      paidAt: p.paidAt,
    });
  }
  await createCompletedLessons({
    schoolId: school.id,
    studentId: jadinhoBateriaStudent.id,
    teacherId: henrique.id,
    enrollmentId: jadinhoBateriaEnrollment.id,
    weekDay: 6,
    startTime: '11:00',
    fromDate: new Date(year, 5, 15),
    toDate: now,
  });
  await createUpcomingLessons({
    schoolId: school.id,
    studentId: jadinhoBateriaStudent.id,
    teacherId: henrique.id,
    enrollmentId: jadinhoBateriaEnrollment.id,
    weekDay: 6,
    startTime: '11:00',
  });

  // ═══════════════════════════════════════════════════════════════
  // Demais usuários — apenas ciclo vigente (sem histórico)
  // ═══════════════════════════════════════════════════════════════
  const { student: gustavo } = await upsertUserWithStudent({
    userName: 'Elder',
    userEmail: 'elder@escolademo.com',
    studentName: 'Gustavo',
    instrument: Instrument.VIOLAO,
    birthDate: new Date(year - 17, 0, 1),
  });
  await seedEnrollmentCurrentMonthOnly({
    schoolId: school.id,
    studentId: gustavo.id,
    teacherId: henrique.id,
    weekDay: 4,
    startTime: '18:00',
    monthlyAmount: 250,
    dueDay: 12,
    enrollmentStartDate: new Date(year, 1, 12),
  });

  const { student: rafael } = await upsertUserWithStudent({
    userName: 'Rafael',
    userEmail: 'rafael@escolademo.com',
    studentName: 'Rafael',
    instrument: Instrument.VIOLAO,
    birthDate: new Date(year - 33, 0, 1),
  });
  await seedEnrollmentCurrentMonthOnly({
    schoolId: school.id,
    studentId: rafael.id,
    teacherId: henrique.id,
    weekDay: 4,
    startTime: '19:00',
    monthlyAmount: 250,
    dueDay: 7,
    enrollmentStartDate: new Date(year, 4, 7),
  });

  const { student: camilla } = await upsertUserWithStudent({
    userName: 'Mãe da Camilla',
    userEmail: 'mae.camilla@escolademo.com',
    studentName: 'Camilla',
    instrument: Instrument.PIANO,
    birthDate: new Date(year - 16, 0, 1),
  });
  await seedEnrollmentCurrentMonthOnly({
    schoolId: school.id,
    studentId: camilla.id,
    teacherId: thiago.id,
    weekDay: 4,
    startTime: '16:00',
    monthlyAmount: 250,
    dueDay: 10,
    enrollmentStartDate: new Date(year, 1, 10),
  });

  const { student: guilherme } = await upsertUserWithStudent({
    userName: 'Juliano',
    userEmail: 'juliano@escolademo.com',
    studentName: 'Guilherme',
    instrument: Instrument.VIOLAO,
    birthDate: new Date(year - 6, 0, 1),
  });
  const { student: julianoStudent } = await upsertUserWithStudent({
    userName: 'Juliano',
    userEmail: 'juliano@escolademo.com',
    studentName: 'Juliano',
    instrument: Instrument.VIOLAO,
    birthDate: new Date(year - 35, 0, 1),
  });
  await seedEnrollmentCurrentMonthOnly({
    schoolId: school.id,
    studentId: guilherme.id,
    teacherId: henrique.id,
    weekDay: 1,
    startTime: '18:00',
    monthlyAmount: 250,
    dueDay: 8,
    enrollmentStartDate: new Date(year, 5, 8),
  });
  if (
    !(await prisma.enrollment.findFirst({
      where: { studentId: julianoStudent.id },
    }))
  ) {
    await seedEnrollmentCurrentMonthOnly({
      schoolId: school.id,
      studentId: julianoStudent.id,
      teacherId: henrique.id,
      weekDay: 1,
      startTime: '19:00',
      monthlyAmount: 250,
      dueDay: 8,
      enrollmentStartDate: new Date(year, 5, 8),
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Resumo
  // ═══════════════════════════════════════════════════════════════
  console.log('\n✅ Seed concluído\n');
  console.log('  PROFESSORES');
  console.log('  henrique.professor@escolademo.com   / prof123');
  console.log('  mineia.professora@escolademo.com    / prof123');
  console.log('  thiago.professor@escolademo.com     / prof123');
  console.log('  professor@escolademo.com            / prof123  (Carlos)');
  console.log('');
  console.log('  ALUNOS / RESPONSÁVEIS');
  console.log('  aluno@escolademo.com         / senha123');
  console.log('    └─ João: mar–jun PAID · jul+ago OVERDUE (com PIX real)');
  console.log('');
  console.log('  claudia@escolademo.com       / senha123');
  console.log(
    '    ├─ Matheus (Bat): fev–mai PAID · jun+jul OVERDUE · ago PENDING  ← 3 em aberto',
  );
  console.log(
    '    └─ Luísa   (Pia): fev–jul PAID · ago PENDING                   ← em dia',
  );
  console.log('');
  console.log('  jadson@escolademo.com        / senha123');
  console.log(
    '    ├─ Jadson         (Bat): mar–jul PAID  · ago PENDING            ← em dia',
  );
  console.log(
    '    ├─ Amanda         (Pia): abr–mai PAID  · jun+jul OVERDUE · ago PENDING  ← 3 em aberto',
  );
  console.log(
    '    ├─ Jadinho Violão (Vio): mai–jul PAID  · ago PENDING            ← em dia',
  );
  console.log(
    '    └─ Jadinho Bat.   (Bat): jun OVERDUE   · jul PAID tardio · ago PENDING  ← 2 em aberto',
  );
  console.log('');
  console.log(
    '  elder@escolademo.com         / senha123  — Gustavo (1 fatura)',
  );
  console.log(
    '  rafael@escolademo.com        / senha123  — Rafael  (1 fatura)',
  );
  console.log(
    '  mae.camilla@escolademo.com   / senha123  — Camilla (1 fatura)',
  );
  console.log(
    '  juliano@escolademo.com       / senha123  — Guilherme + Juliano',
  );
  console.log('');
  console.log('  ADMIN');
  console.log('  admin@escolademo.com         / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
