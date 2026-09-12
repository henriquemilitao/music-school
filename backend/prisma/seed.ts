import { PrismaClient, Role, Instrument } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// "Hoje" de verdade, pra decidir COMPLETED vs SCHEDULED.
const TODAY = new Date();
const TODAY_UTC_MIDNIGHT = new Date(
  Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), TODAY.getUTCDate()),
);

// Offset fixo da escola em relação ao UTC (igual ao campo
// School.timezoneOffsetHours). startTime é sempre hora LOCAL da
// escola — pra gravar em UTC de verdade no banco, subtraímos esse
// offset (ex: 15:00 local em UTC-4 vira 19:00 UTC).
const SCHOOL_TIMEZONE_OFFSET_HOURS = -4;

// ─────────────────────────────────────────────────────────────
// Helpers de data
// ─────────────────────────────────────────────────────────────

// Cria uma data em UTC ao meio-dia (evita problemas de fuso ao
// comparar só o "dia").
function dateUTCNoon(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

// Parseia "DD/MM" (ou "DD/MM/AAAA") assumindo o ano corrente,
// quando o ano não vem explícito.
function parseDayMonth(str: string, referenceYear: number): Date {
  const parts = str.split('/').map(Number);
  const [d, m, y] = parts;
  return dateUTCNoon(y ?? referenceYear, m, d);
}

function parseBirthDate(str: string): Date {
  const [d, m, y] = str.split('/').map(Number);
  return dateUTCNoon(y, m, d);
}

function addMonthsUTC(date: Date, months: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      date.getUTCDate(),
      12,
      0,
      0,
      0,
    ),
  );
}

function toMonthKeyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function toPeriodKeyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ─────────────────────────────────────────────────────────────
// Helper: cria lições recorrentes num intervalo [fromDate, toDate),
// no dia da semana `weekDay`, no horário local `startTime`. Cada
// aula individual vira COMPLETED se sua data já passou (<= hoje),
// senão SCHEDULED. startTime é hora LOCAL da escola; convertemos
// pra UTC real subtraindo SCHOOL_TIMEZONE_OFFSET_HOURS.
// ─────────────────────────────────────────────────────────────
async function createLessonsInRange(p: {
  schoolId: string;
  studentId: string;
  teacherId: string;
  enrollmentId: string;
  weekDay: number;
  startTime: string;
  durationMinutes: number;
  fromDate: Date;
  toDate: Date;
}) {
  const [h, m] = p.startTime.split(':').map(Number);

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
          h - SCHOOL_TIMEZONE_OFFSET_HOURS,
          m,
          0,
          0,
        ),
      );
      const status = cursor <= TODAY_UTC_MIDNIGHT ? 'COMPLETED' : 'SCHEDULED';
      await prisma.lesson.create({
        data: {
          schoolId: p.schoolId,
          studentId: p.studentId,
          teacherId: p.teacherId,
          enrollmentId: p.enrollmentId,
          scheduledAt,
          durationMinutes: p.durationMinutes,
          status,
        },
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

async function createPaymentRecord(p: {
  schoolId: string;
  studentId: string;
  enrollmentId: string;
  amount: number;
  dueDate: Date;
  status: 'PAID' | 'PENDING';
  paidAt?: Date;
}) {
  const label = toMonthKeyUTC(p.dueDate);
  const key = `${p.studentId}-${toPeriodKeyUTC(p.dueDate)}`;
  return prisma.payment.create({
    data: {
      schoolId: p.schoolId,
      studentId: p.studentId,
      enrollmentId: p.enrollmentId,
      amount: p.amount,
      paidAmount: p.status === 'PAID' ? p.amount : null,
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
// Config de cada aluno — dados vindos da lista consolidada real.
// ─────────────────────────────────────────────────────────────
type TeacherKey = 'henrique' | 'mineia' | 'thiago';

type StudentConfig = {
  guardianName: string;
  guardianEmail: string | null;
  guardianPhone?: string;
  studentName: string;
  birthDateStr: string | null; // "DD/MM/AAAA" ou null se faltando
  instrument: Instrument;
  weekDay: number; // 0=domingo ... 6=sábado
  startTime: string;
  durationMinutes: number;
  amount: number;
  teacherKey: TeacherKey;
  startDateStr: string; // "DD/MM" — data de início do ciclo atual de aulas
  situacao: 'PAGO' | 'EM_ABERTO';
  // Caso especial (ex: Daniel Santos Silva): due date diferente do
  // início do ciclo de aulas.
  overrideDueDateStr?: string; // "DD/MM"
};

const YEAR = new Date().getFullYear();

const students: StudentConfig[] = [
  // 1. Raphaella Cristynne
  {
    guardianName: 'Raphaella Cristynne',
    guardianEmail: 'raphaellacristynne@hotmail.com',
    guardianPhone: '98981107513',
    studentName: 'Daniel Ribeiro Lopes',
    birthDateStr: '17/07/2014',
    instrument: Instrument.PIANO,
    weekDay: 1,
    startTime: '13:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'mineia',
    startDateStr: '26/10',
    situacao: 'PAGO',
  },
  {
    guardianName: 'Raphaella Cristynne',
    guardianEmail: 'raphaellacristynne@hotmail.com',
    guardianPhone: '98981107513',
    studentName: 'Rafael Ribeiro Lopes',
    birthDateStr: '14/02/2017',
    instrument: Instrument.PIANO,
    weekDay: 1,
    startTime: '14:00',
    durationMinutes: 30,
    amount: 115,
    teacherKey: 'mineia',
    startDateStr: '14/09',
    situacao: 'PAGO',
  },
  // 2. Karina Morato Rodrigues
  {
    guardianName: 'Karina Morato Rodrigues',
    guardianEmail: 'karinamoratorodrigues@gmail.com',
    guardianPhone: '67998367530',
    studentName: 'Lara Morato Rodrigues',
    birthDateStr: '19/02/2015',
    instrument: Instrument.PIANO,
    weekDay: 2,
    startTime: '18:00',
    durationMinutes: 60,
    amount: 250,
    teacherKey: 'mineia',
    startDateStr: '18/09',
    situacao: 'PAGO',
  },
  // 3. Igor Ujiie
  {
    guardianName: 'Igor Ujiie',
    guardianEmail: 'igorujiie@hotmail.com',
    guardianPhone: '67981746728',
    studentName: 'Lucas Yoshimitsu da Silva Ujiie',
    birthDateStr: '05/04/2016',
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '09:00',
    durationMinutes: 60,
    amount: 250,
    teacherKey: 'mineia',
    startDateStr: '09/09',
    situacao: 'PAGO',
  },
  // 4. Sionara de Almeida Dias Pereira
  {
    guardianName: 'Sionara de Almeida Dias Pereira',
    guardianEmail: 'sionara_almeida@hotmail.com',
    guardianPhone: '67991446609',
    studentName: 'Karlla de Almeida Dias Pereira',
    birthDateStr: '07/01/2016',
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '08:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'mineia',
    startDateStr: '23/09',
    situacao: 'EM_ABERTO',
  },
  // 5. Cledisnari Centurion
  {
    guardianName: 'Cledisnari Centurion',
    guardianEmail: 'cledisnari.scenturion@gmail.com',
    guardianPhone: '67984474559',
    studentName: 'Jazlín Centurion',
    birthDateStr: '25/03/2015',
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '18:00',
    durationMinutes: 30,
    amount: 115,
    teacherKey: 'mineia',
    startDateStr: '10/09',
    situacao: 'PAGO',
  },
  // 6. Renan Dias Militão
  {
    guardianName: 'Mineia Dias Pinto Militão',
    guardianEmail: 'pianissimaem@gmail.com',
    guardianPhone: '67992936045',
    studentName: 'Renan Dias Militão',
    birthDateStr: '16/11/2012',
    instrument: Instrument.PIANO,
    weekDay: 4,
    startTime: '13:30',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'thiago',
    startDateStr: '12/09',
    situacao: 'PAGO',
  },
  // 7. Danielly Medeiros
  {
    guardianName: 'Danielly Medeiros',
    guardianEmail: 'danny.medeiros89@hotmail.com',
    guardianPhone: '67981055070',
    studentName: 'Lara Soares de Medeiros Pereira',
    birthDateStr: '09/11/2015',
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '17:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'thiago',
    startDateStr: '09/09',
    situacao: 'PAGO',
  },
  // 8. Virginia Pereira Rodrigues da Silva
  {
    guardianName: 'Virginia Pereira Rodrigues da Silva',
    guardianEmail: 'virginiaprodrodrigues@gmail.com',
    guardianPhone: '67981321922',
    studentName: 'João Pedro Rodrigues da Silva',
    birthDateStr: '13/08/2014',
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '14:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'thiago',
    startDateStr: '11/09',
    situacao: 'PAGO',
  },
  // 9. Regiane Pescara
  {
    guardianName: 'Regiane Pescara',
    guardianEmail: 'regianepescara@hotmail.com',
    guardianPhone: '67981414674',
    studentName: 'Isabella Pescara',
    birthDateStr: '22/10/2014',
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '12:30',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'thiago',
    startDateStr: '11/09',
    situacao: 'PAGO',
  },
  // 10. Sidneia Zamboni
  {
    guardianName: 'Sidneia Zamboni',
    guardianEmail: 'sarazamboni619@gmail.com',
    guardianPhone: '67999536021',
    studentName: 'Sara Zamboni',
    birthDateStr: '20/01/2012',
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '15:00',
    durationMinutes: 60,
    amount: 250,
    teacherKey: 'mineia',
    startDateStr: '11/09',
    situacao: 'EM_ABERTO',
  },
  // 11. Rosineia Jesus Araújo
  {
    guardianName: 'Rosineia Jesus Araújo',
    guardianEmail: 'rosineia25@hotmail.com',
    guardianPhone: '67984070008',
    studentName: 'Laura Araújo Damasceno de Almeida',
    birthDateStr: '11/12/2014',
    instrument: Instrument.PIANO,
    weekDay: 3,
    startTime: '16:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'thiago',
    startDateStr: '09/09',
    situacao: 'PAGO',
  },
  // 12. Zilma dos Santos Ferreira da Silva — CASO ESPECIAL (Daniel Santos Silva)
  {
    guardianName: 'Zilma dos Santos Ferreira da Silva',
    guardianEmail: 'zilmasantos11@hotmail.com',
    guardianPhone: '67991186919',
    studentName: 'Daniel Santos Silva',
    birthDateStr: '20/03/2015',
    instrument: Instrument.PIANO,
    weekDay: 4,
    startTime: '14:30',
    durationMinutes: 60,
    amount: 250,
    teacherKey: 'thiago',
    startDateStr: '27/08',
    situacao: 'PAGO',
    overrideDueDateStr: '04/09',
  },
  // 13. Ágatha Malfer dos Santos
  {
    guardianName: 'Luziana Malfer',
    guardianEmail: 'luziana.malfer7@gmail.com',
    guardianPhone: '67996572157',
    studentName: 'Ágatha Malfer dos Santos',
    birthDateStr: '02/02/2011',
    instrument: Instrument.PIANO,
    weekDay: 2,
    startTime: '08:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'mineia',
    startDateStr: '11/09',
    situacao: 'PAGO',
  },
  // 14. Lívia Maria Pereira Marques
  {
    guardianName: 'Marta Pereira Lopes Marques',
    guardianEmail: 'mp066692@gmail.com',
    guardianPhone: '67992015392',
    studentName: 'Lívia Maria Pereira Marques',
    birthDateStr: '27/11/2012',
    instrument: Instrument.PIANO,
    weekDay: 2,
    startTime: '09:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'mineia',
    startDateStr: '12/09',
    situacao: 'PAGO',
  },
  // 15. Heloisa Tavares Souza
  {
    guardianName: 'Lilian Keli da Silva Tavares Souza',
    guardianEmail: 'liliantavarescontato@gmail.com',
    guardianPhone: '67984668776',
    studentName: 'Heloisa Tavares Souza',
    birthDateStr: '14/04/2012',
    instrument: Instrument.PIANO,
    weekDay: 2,
    startTime: '10:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'mineia',
    startDateStr: '10/09',
    situacao: 'PAGO',
  },
  // 16. Guilherme Magalhães de Paula
  {
    guardianName: ' Claudiana Moura de Magalhães de Paula',
    guardianEmail: 'claudianacorumba@hotmail.com',
    guardianPhone: '94984513574',
    studentName: 'Guilherme Magalhães de Paula',
    birthDateStr: '12/07/2013',
    instrument: Instrument.PIANO,
    weekDay: 2,
    startTime: '14:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'mineia',
    startDateStr: '11/09',
    situacao: 'PAGO',
  },
  // 17. Eloize de Almeida Santos
  {
    guardianName: 'Sônia Batista Ferreira Garcia ',
    guardianEmail: 'lumaria37@hotmail.com',
    guardianPhone: '67992344196',
    studentName: 'Eloize de Almeida Santos',
    birthDateStr: '25/03/2017',
    instrument: Instrument.PIANO,
    weekDay: 2,
    startTime: '15:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'mineia',
    startDateStr: '19/09',
    situacao: 'EM_ABERTO',
  },
  // 18. Paulo Henrique Higino Batista
  {
    guardianName: 'Lucimar Moreira',
    guardianEmail: 'pauloh.higbat@gmail.com',
    guardianPhone: '67998239998',
    studentName: 'Paulo Henrique Higino Batista',
    birthDateStr: '13/04/2005',
    instrument: Instrument.PIANO,
    weekDay: 1,
    startTime: '09:00',
    durationMinutes: 60,
    amount: 250,
    teacherKey: 'mineia',
    startDateStr: '31/08',
    situacao: 'PAGO',
  },
  // 19. Camila Ferreira Garcia
  {
    guardianName: 'Sônia Batista Ferreira Garcia',
    guardianEmail: 'camilagarcia27bf@gmail.com',
    guardianPhone: '67992355769',
    studentName: 'Camila Ferreira Garcia',
    birthDateStr: '27/09/2010',
    instrument: Instrument.PIANO,
    weekDay: 4,
    startTime: '15:30',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'thiago',
    startDateStr: '10/09',
    situacao: 'PAGO',
  },
  // 20. Claudia Salles Regis de Oliveira — 3 matrículas
  {
    guardianName: 'Claudia Salles Regis de Oliveira',
    guardianEmail: 'claudiasalles07@gmail.com',
    guardianPhone: '67996771510',
    studentName: 'Luísa Salles de Oliveira',
    birthDateStr: '10/07/2014',
    instrument: Instrument.PIANO,
    weekDay: 4,
    startTime: '16:30',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'thiago',
    startDateStr: '12/09',
    situacao: 'EM_ABERTO',
  },
  {
    guardianName: 'Claudia Salles Regis de Oliveira',
    guardianEmail: 'claudiasalles07@gmail.com',
    guardianPhone: '67996771510',
    studentName: 'Matheus Lico de Oliveira',
    birthDateStr: '21/02/2011',
    instrument: Instrument.BATERIA,
    weekDay: 4,
    startTime: '16:30',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'henrique',
    startDateStr: '12/09',
    situacao: 'EM_ABERTO',
  },
  {
    guardianName: 'Claudia Salles Regis de Oliveira',
    guardianEmail: 'claudiasalles07@gmail.com',
    guardianPhone: '67996771510',
    studentName: 'Matheus Lico de Oliveira',
    birthDateStr: '21/02/2011',
    instrument: Instrument.CAJON,
    weekDay: 4,
    startTime: '17:30',
    durationMinutes: 30,
    amount: 125,
    teacherKey: 'thiago',
    startDateStr: '03/09',
    situacao: 'PAGO',
  },
  // ── Violão ──
  // 21. Juliano — SEM E-MAIL → SKIP
  {
    guardianName: 'Juliano da Silva Silveira',
    guardianEmail: 'julianosilvasilveira@gmail.com',
    guardianPhone: '6781329273',
    studentName: 'Guilherme Pimenta Nantes',
    birthDateStr: '26/03/2020',
    instrument: Instrument.VIOLAO,
    weekDay: 1,
    startTime: '18:00',
    durationMinutes: 60,
    amount: 250,
    teacherKey: 'henrique',
    startDateStr: '08/09',
    situacao: 'EM_ABERTO',
  },
  // 22. Maria Claudia Mayumi Nakasone
  {
    guardianName: 'Maria Claudia Mayumi Nakasone',
    guardianEmail: 'mariaclaudiamayuminakasone@gmail.com',
    guardianPhone: '67963396639',
    studentName: 'Maria Claudia Mayumi Nakasone',
    birthDateStr: '06/04/2000',
    instrument: Instrument.VIOLAO,
    weekDay: 2,
    startTime: '15:00',
    durationMinutes: 60,
    amount: 300,
    teacherKey: 'henrique',
    startDateStr: '05/09',
    situacao: 'PAGO',
  },
  // 23. Valter Lopes de Faria Junior
  {
    guardianName: 'Valter Lopes de Faria Junior',
    guardianEmail: 'felipecafaro13@gmail.com',
    guardianPhone: '67815053000',
    studentName: 'Felipe Cafaro de Faria',
    birthDateStr: '15/04/2013',
    instrument: Instrument.VIOLAO,
    weekDay: 4,
    startTime: '14:30',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'henrique',
    startDateStr: '11/09',
    situacao: 'PAGO',
  },
  // 24. Cristiane Vilela Albino
  {
    guardianName: 'Cristiane Vilela Albino',
    guardianEmail: 'cris_reij@hotmail.com',
    guardianPhone: '67930019760',
    studentName: 'Fernanda Vilela Monteiro',
    birthDateStr: '27/03/2011',
    instrument: Instrument.VIOLAO,
    weekDay: 4,
    startTime: '18:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'henrique',
    startDateStr: '12/09',
    situacao: 'EM_ABERTO',
  },
  // 25. Élder de Sousa Teles
  {
    guardianName: 'Élder de Sousa Teles',
    guardianEmail: 'gustavoht.fama@gmail.com',
    guardianPhone: '67912944390',
    studentName: 'Gustavo Henrique Fama da Silva',
    birthDateStr: '13/12/2008',
    instrument: Instrument.VIOLAO,
    weekDay: 4,
    startTime: '19:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'henrique',
    startDateStr: '12/09',
    situacao: 'EM_ABERTO',
  },
  // 26. Rafael da Silva Arruda
  {
    guardianName: 'Rafael da Silva Arruda',
    guardianEmail: 'rafael_vap18@hotmail.com',
    guardianPhone: '67925097280',
    studentName: 'Rafael da Silva Arruda',
    birthDateStr: '20/08/1993',
    instrument: Instrument.VIOLAO,
    weekDay: 4,
    startTime: '20:00',
    durationMinutes: 60,
    amount: 230,
    teacherKey: 'henrique',
    startDateStr: '07/09',
    situacao: 'EM_ABERTO',
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
    'henriquemilitao35@gmail.com',
    'Professor de violão e bateria.',
  );
  const mineia = await createTeacher(
    'Mineia',
    'mineiamil01@gmail.com',
    'Professora de piano.',
  );
  const thiago = await createTeacher(
    'Thiago',
    'thiago.professor@escolademo.com',
    'Professor de piano e cajon.',
  );

  const teacherMap: Record<TeacherKey, typeof henrique> = {
    henrique,
    mineia,
    thiago,
  };

  // Cache de usuários (responsáveis) já criados — pra não duplicar
  // quando vários alunos compartilham o mesmo responsável.
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

  const skipped: { studentName: string; reason: string }[] = [];
  const createdLog: {
    studentName: string;
    guardianName: string;
    info: string;
  }[] = [];

  console.log('👨‍👩‍👧 Criando responsáveis, alunos, matrículas e faturas...\n');

  for (const cfg of students) {
    // ── validação: pula quem não tem dados essenciais ──
    if (!cfg.guardianEmail) {
      skipped.push({
        studentName: cfg.studentName,
        reason: 'responsável sem e-mail cadastrado',
      });
      continue;
    }
    if (!cfg.birthDateStr) {
      skipped.push({
        studentName: cfg.studentName,
        reason: 'sem data de nascimento cadastrada',
      });
      continue;
    }

    const userId = await getOrCreateGuardianUser(
      cfg.guardianName,
      cfg.guardianEmail,
    );

    const student = await prisma.student.create({
      data: {
        userId,
        name: cfg.studentName,
        instrument: cfg.instrument,
        birthDate: parseBirthDate(cfg.birthDateStr),
      },
    });

    const teacher = teacherMap[cfg.teacherKey];

    // Início do ciclo de aulas (dia-âncora tanto de aulas quanto,
    // por padrão, de vencimento).
    const cycleStart = parseDayMonth(cfg.startDateStr, YEAR);
    // Fim do ciclo = +1 mês a partir do início (exclusive).
    const cycleEnd = addMonthsUTC(cycleStart, 1);

    // Vencimento da fatura: por padrão = início do ciclo, exceto
    // caso especial (ex: Daniel Santos Silva → sempre dia 04).
    const dueDate = cfg.overrideDueDateStr
      ? parseDayMonth(cfg.overrideDueDateStr, YEAR)
      : cycleStart;

    const enrollment = await prisma.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        teacherId: teacher.id,
        weekDay: cfg.weekDay,
        startTime: cfg.startTime,
        durationMinutes: cfg.durationMinutes,
        monthlyAmount: cfg.amount,
        firstLessonDate: cycleStart,
        firstPaymentDueDate: dueDate,
        lastLessonPeriodStart: cycleStart,
        lastPaymentDueDate: dueDate,
        lastGeneratedPeriodKey: toPeriodKeyUTC(cycleStart),
      },
    });

    await createPaymentRecord({
      schoolId: school.id,
      studentId: student.id,
      enrollmentId: enrollment.id,
      amount: cfg.amount,
      dueDate,
      status: cfg.situacao === 'PAGO' ? 'PAID' : 'PENDING',
      paidAt: cfg.situacao === 'PAGO' ? dueDate : undefined,
    });

    await createLessonsInRange({
      schoolId: school.id,
      studentId: student.id,
      teacherId: teacher.id,
      enrollmentId: enrollment.id,
      weekDay: cfg.weekDay,
      startTime: cfg.startTime,
      durationMinutes: cfg.durationMinutes,
      fromDate: cycleStart,
      toDate: cycleEnd,
    });

    createdLog.push({
      studentName: cfg.studentName,
      guardianName: cfg.guardianName,
      info: `${cfg.instrument} · ${cfg.teacherKey} · R$${cfg.amount} · ${cfg.situacao}`,
    });
    console.log(
      `  ✓ ${cfg.studentName} (${cfg.guardianName}) — ${cfg.instrument} · ${cfg.teacherKey} · R$${cfg.amount} · ${cfg.situacao}`,
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
  console.log('  admin@escolademo.com    / admin123');

  if (skipped.length > 0) {
    console.log('\n⚠️  ALUNOS/RESPONSÁVEIS NÃO CRIADOS (dados incompletos):');
    for (const s of skipped) {
      console.log(`  ✗ ${s.studentName} — motivo: ${s.reason}`);
    }
  } else {
    console.log(
      '\n✅ Nenhum aluno foi pulado — todos os dados estavam completos.',
    );
  }

  console.log(
    `\n📊 Resumo: ${createdLog.length} aluno(s) criado(s), ${skipped.length} pulado(s).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
