import { PrismaClient, Role, Instrument } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// "now" é capturado uma única vez no início do script — todos os
// cálculos de data abaixo usam essa mesma referência, pra garantir
// que o script inteiro rode consistente mesmo que a execução leve
// alguns segundos (evita pegar um "now" diferente em cada linha).
const now = new Date();

// Mesmo valor do School.timezoneOffsetHours (default -4) — usado
// aqui pra aplicar a MESMA conversão de hora que o EnrollmentsService
// real aplica em buildLessonsForPeriod. Se a seed não aplicar isso,
// as aulas nascem com hora "crua" (ex: 8h UTC em vez de 12h UTC pra
// representar 8h em Campo Grande), ficando inconsistente com o que
// o service geraria numa execução real.
const SCHOOL_TIMEZONE_OFFSET_HOURS = -4;

// ─────────────────────────────────────────────────────────────
// OBJETIVO DESSA SEED
// ─────────────────────────────────────────────────────────────
// Testar a fronteira exata do cron de renovação (renewDueSoon), que
// dispara quando faltam <= 10 dias pro PRÓXIMO vencimento.
//
// Cada aluno abaixo simula um estado "como se o mês anterior de
// aula+fatura já tivesse sido gerado e concluído" — ou seja, já
// nasce com lastPaymentDueDate/lastLessonPeriodStart preenchidos,
// simulando que generatePeriod já rodou uma vez pra ele no passado.
// Isso é necessário porque o cron SÓ olha pra
// lastPaymentDueDate/lastLessonPeriodStart pra calcular o próximo
// ciclo — ele nunca usa firstLessonDate/firstPaymentDueDate depois
// da primeira geração.
//
// Com "hoje" fixado em 30/08 (ou a data real de quando você rodar
// isso), o próximo vencimento de cada aluno cai em:
//   dueDay 07 → 07/09 → 8 dias restantes  → DEVE disparar (<=10)
//   dueDay 08 → 08/09 → 9 dias restantes  → DEVE disparar (<=10)
//   dueDay 09 → 09/09 → 10 dias restantes → DEVE disparar (<=10, limite exato)
//   dueDay 10 → 10/09 → 11 dias restantes → NÃO deve disparar (>10)
//   dueDay 11 → 11/09 → 12 dias restantes → NÃO deve disparar (>10)
// ─────────────────────────────────────────────────────────────

// Constrói uma data em UTC, pro dia informado, DENTRO DO MÊS ATUAL
// de "now", já ao MEIO-DIA UTC (12:00:00) — mesma normalização que
// EnrollmentsService.toNoonUTC/getNextMonthlyDateAtNoon aplicam no
// service real. É isso que corrige o bug de "vencimento dia 07
// aparecendo como dia 06 pro usuário": à meia-noite UTC, qualquer
// fuso negativo (todo o Brasil) "escorrega" pro dia anterior; ao
// meio-dia UTC, isso nunca acontece em fusos razoáveis.
function dueDateThisMonthUTC(day: number): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, 12, 0, 0, 0),
  );
}

// Soma (ou subtrai, se negativo) `days` dias corridos a uma data,
// preservando o horário. Usado pra posicionar a "data da aula" do
// ciclo anterior alguns dias antes/depois do vencimento — conforme
// você pediu ("a data da aula perto da data de vencimento, alguns
// dias antes ou depois").
function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// Rótulo em texto "YYYY-MM-DD" de uma data — mesmo formato que
// EnrollmentsService.toPeriodKey gera, usado aqui pra montar a
// idempotencyKey do Payment e o lastGeneratedPeriodKey da matrícula,
// exatamente como o service faria numa geração real.
function toPeriodKeyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Rótulo em texto "YYYY-MM" de uma data — mesmo formato que
// EnrollmentsService.toMonthKey gera, usado aqui como
// referenceMonth do Payment do ciclo anterior (simulado como já
// PAID nessa seed).
function toMonthKeyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ─────────────────────────────────────────────────────────────
// Helper: cria as aulas do ciclo anterior (já concluído) de um
// aluno de teste, no dia da semana informado, dentro do intervalo
// [fromDate, toDate). Toda aula gerada aqui nasce como COMPLETED,
// já que representa o mês que "já aconteceu" antes desse teste.
// ─────────────────────────────────────────────────────────────
async function createCompletedLessonsInRange(p: {
  schoolId: string;
  studentId: string;
  teacherId: string;
  enrollmentId: string;
  weekDay: number; // 0=domingo ... 6=sábado — dia da semana da aula
  startTime: string; // "HH:MM"
  fromDate: Date; // início do intervalo (inclusive)
  toDate: Date; // fim do intervalo (exclusive)
}) {
  // Quebra "15:00" em [15, 0] — usado abaixo pra montar o horário
  // exato de cada aula gerada.
  const [hours, minutes] = p.startTime.split(':').map(Number);

  // cursor "caminha" dia a dia dentro do intervalo, começando exatamente
  // na meia-noite UTC do dia de fromDate.
  const cursor = new Date(
    Date.UTC(
      p.fromDate.getUTCFullYear(),
      p.fromDate.getUTCMonth(),
      p.fromDate.getUTCDate(),
    ),
  );

  // Percorre dia a dia enquanto não alcançar o fim do intervalo —
  // a cada dia, checa se bate com o weekDay configurado; se bater,
  // cria a aula COMPLETED naquele dia+horário.
  while (cursor < p.toDate) {
    if (cursor.getUTCDay() === p.weekDay) {
      const scheduledAt = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate(),
          // Mesma conversão de hours - timezoneOffsetHours aplicada
          // em EnrollmentsService.buildLessonsForPeriod — sem isso,
          // as aulas dessa seed nasceriam com hora "crua" (ex: 8h
          // UTC), diferente do que o service real produziria (12h
          // UTC pra representar 8h em Campo Grande).
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
          // COMPLETED porque essa aula representa o mês que já
          // aconteceu — não faz sentido nascer SCHEDULED.
          status: 'COMPLETED',
        },
      });
    }
    // Avança 1 dia — setUTCDate lida sozinho com virada de mês.
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

// ─────────────────────────────────────────────────────────────
// Config de cada aluno de teste — só o essencial pra testar a
// fronteira dos 10 dias do cron.
// ─────────────────────────────────────────────────────────────
type TestStudentConfig = {
  guardianName: string;
  guardianEmail: string;
  studentName: string;
  weekDay: number; // dia da semana da aula (0=domingo...6=sábado)
  startTime: string; // horário fixo da aula, "HH:MM"
  dueDay: number; // dia do mês do vencimento — é o que muda entre os 5 casos
  lessonOffsetDays: number; // quantos dias a aula fica distante do vencimento (pode ser negativo = antes do vencimento, ou positivo = depois)
};

const DEFAULT_AMOUNT = 250;

// 5 alunos, um pra cada dia de vencimento que queremos testar
// (07, 08, 09, 10, 11), cada um com a aula num dia da semana
// diferente (segunda a sexta), posicionada alguns dias de distância
// do vencimento — conforme você pediu.
const testStudents: TestStudentConfig[] = [
  {
    guardianName: 'Ana (Teste Dia07)',
    guardianEmail: 'teste.dia07@escolademo.com',
    studentName: 'Aluno Dia07',
    weekDay: 1, // segunda-feira
    startTime: '08:00',
    dueDay: 7,
    lessonOffsetDays: 2, // aula 2 dias DEPOIS do vencimento
  },
  {
    guardianName: 'Bruno (Teste Dia08)',
    guardianEmail: 'teste.dia08@escolademo.com',
    studentName: 'Aluno Dia08',
    weekDay: 2, // terça-feira
    startTime: '09:00',
    dueDay: 8,
    lessonOffsetDays: -3, // aula 3 dias ANTES do vencimento
  },
  {
    guardianName: 'Carla (Teste Dia09)',
    guardianEmail: 'teste.dia09@escolademo.com',
    studentName: 'Aluno Dia09',
    weekDay: 3, // quarta-feira
    startTime: '10:00',
    dueDay: 9,
    lessonOffsetDays: 1, // aula 1 dia DEPOIS do vencimento
  },
  {
    guardianName: 'Diego (Teste Dia10)',
    guardianEmail: 'teste.dia10@escolademo.com',
    studentName: 'Aluno Dia10',
    weekDay: 4, // quinta-feira
    startTime: '11:00',
    dueDay: 10,
    lessonOffsetDays: -2, // aula 2 dias ANTES do vencimento
  },
  {
    guardianName: 'Elis (Teste Dia11)',
    guardianEmail: 'teste.dia11@escolademo.com',
    studentName: 'Aluno Dia11',
    weekDay: 5, // sexta-feira
    startTime: '14:00',
    dueDay: 11,
    lessonOffsetDays: 3, // aula 3 dias DEPOIS do vencimento
  },
];

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🧹 Limpando banco...');
  // Ordem de deleteMany respeita as foreign keys — sempre apagando
  // as tabelas "filhas" antes das "pais", senão o Postgres recusa
  // por violação de chave estrangeira.
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
      // Não precisa passar timezoneOffsetHours explicitamente — o
      // @default(-4) do schema cobre isso, e é o mesmo valor que
      // SCHOOL_TIMEZONE_OFFSET_HOURS usa aqui na seed.
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

  // Um único professor genérico pra todos os alunos de teste — o
  // foco aqui é testar datas, não variedade de professores.
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
    // Cria o responsável (User com role STUDENT) desse aluno de teste.
    const guardianUser = await prisma.user.create({
      data: {
        schoolId: school.id,
        name: cfg.guardianName,
        email: cfg.guardianEmail,
        passwordHash: await bcrypt.hash('senha123', 10),
        role: Role.STUDENT,
      },
    });

    // Cria o Student vinculado a esse responsável.
    const student = await prisma.student.create({
      data: {
        userId: guardianUser.id,
        name: cfg.studentName,
        instrument: Instrument.PIANO,
        // Data de nascimento fixa e arbitrária — não é o foco desse teste.
        birthDate: new Date(2015, 0, 1),
      },
    });

    // ── Simulando o CICLO ANTERIOR (já concluído) ──────────────
    // previousDueDate: o vencimento "do mês passado", no dia
    // configurado (cfg.dueDay), dentro do mês atual, já normalizado
    // ao MEIO-DIA UTC — é esse valor que vai virar lastPaymentDueDate
    // da matrícula, simulando que generatePeriod já rodou uma vez
    // pra esse aluno anteriormente (com a correção de horário já
    // aplicada, igual o service real faria).
    const previousDueDate = dueDateThisMonthUTC(cfg.dueDay);

    // previousLessonPeriodStart: a data da aula desse ciclo anterior
    // — deslocada de lessonOffsetDays em relação ao vencimento,
    // conforme você pediu ("aula perto da data de vencimento,
    // alguns dias antes ou depois"). É esse valor que vira
    // lastLessonPeriodStart da matrícula.
    const previousLessonPeriodStart = addDaysUTC(
      previousDueDate,
      cfg.lessonOffsetDays,
    );

    // firstLessonDate/firstPaymentDueDate da matrícula (os campos
    // "originais", que nunca mudam depois de criados) — aqui usamos
    // os mesmos valores do ciclo anterior simulado, já que pra fins
    // desse teste não existe um ciclo anterior a esse ("esse foi o
    // primeiro e único ciclo já gerado pra esse aluno").
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
        // Simulando que generatePeriod já rodou uma vez: preenchemos
        // a "memória" da matrícula como se esse ciclo anterior já
        // tivesse sido gerado de verdade. É ISSO que faz o cron
        // calcular o PRÓXIMO ciclo a partir daqui, em vez de tratar
        // essa matrícula como "nunca gerou nada ainda".
        lastLessonPeriodStart: previousLessonPeriodStart,
        lastPaymentDueDate: previousDueDate,
        lastGeneratedPeriodKey: toPeriodKeyUTC(previousLessonPeriodStart),
      },
    });

    // Fatura do ciclo anterior — já PAGA, representando que esse
    // mês já foi concluído e quitado normalmente.
    const previousPeriodKey = toPeriodKeyUTC(previousLessonPeriodStart);
    await prisma.payment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        enrollmentId: enrollment.id,
        amount: DEFAULT_AMOUNT,
        dueDate: previousDueDate,
        status: 'PAID',
        // paidAt arbitrário: 1 dia antes do vencimento, só pra ter
        // um valor plausível de "pagou em dia".
        paidAt: addDaysUTC(previousDueDate, -1),
        paymentMethod: 'MANUAL_PIX',
        provider: 'manual',
        referenceMonth: toMonthKeyUTC(previousDueDate),
        idempotencyKey: `${student.id}-${previousPeriodKey}`,
      },
    });

    // Aulas do ciclo anterior — todas COMPLETED, cobrindo 1 mês a
    // partir de previousLessonPeriodStart. Não é crítico pro teste
    // do cron em si (que olha só pra datas da Enrollment), mas deixa
    // o cenário mais realista pra você inspecionar no banco/app.
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

    // Log detalhado por aluno — mostra a data exata do próximo
    // vencimento esperado, pra você conferir visualmente contra o
    // resultado do cron depois de rodar a rota de debug.
    console.log(
      `  ✓ ${cfg.studentName} — vencimento dia ${cfg.dueDay} — ` +
        `último vencimento gerado: ${previousDueDate.toISOString().slice(0, 10)} (meio-dia UTC) — ` +
        `próximo vencimento (aprox.): dia ${cfg.dueDay}/mês seguinte`,
    );
  }

  console.log('\n✅ Seed de teste do cron concluída\n');
  console.log('  ADMIN');
  console.log('  admin@escolademo.com         / admin123\n');
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
