import { PrismaClient, Role, Instrument } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto'; // mesmas funções do AuthService
import { Resend } from 'resend';

const prisma = new PrismaClient();

// Offset fixo da escola em relação ao UTC (igual ao campo
// School.timezoneOffsetHours). startTime é sempre hora LOCAL da
// escola — pra gravar em UTC de verdade no banco, subtraímos esse
// offset (ex: 15:00 local em UTC-4 vira 19:00 UTC).
const SCHOOL_TIMEZONE_OFFSET_HOURS = -4;

// "Agora" ajustado pro fuso da escola (UTC-4), não UTC puro — evita
// que rodar o seed à noite (quando UTC já virou o dia seguinte)
// marque erroneamente aulas de "hoje local" como já concluídas.
const NOW_UTC = new Date();
const NOW_SCHOOL_LOCAL = new Date(
  NOW_UTC.getTime() + SCHOOL_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000,
);
const TODAY_UTC_MIDNIGHT = new Date(
  Date.UTC(
    NOW_SCHOOL_LOCAL.getUTCFullYear(),
    NOW_SCHOOL_LOCAL.getUTCMonth(),
    NOW_SCHOOL_LOCAL.getUTCDate(),
  ),
);

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
  firstLessonOverride?: Date; // NOVO
}) {
  const [h, m] = p.startTime.split(':').map(Number);

  const cursor = new Date(
    Date.UTC(
      p.fromDate.getUTCFullYear(),
      p.fromDate.getUTCMonth(),
      p.fromDate.getUTCDate(),
    ),
  );

  let isFirstOccurrence = true;

  while (cursor < p.toDate) {
    if (cursor.getUTCDay() === p.weekDay) {
      // Se houver override e essa for a primeira ocorrência do
      // weekDay no ciclo, usa a data de override em vez do cursor.
      const lessonDate =
        isFirstOccurrence && p.firstLessonOverride
          ? p.firstLessonOverride
          : cursor;

      const scheduledAt = new Date(
        Date.UTC(
          lessonDate.getUTCFullYear(),
          lessonDate.getUTCMonth(),
          lessonDate.getUTCDate(),
          h - SCHOOL_TIMEZONE_OFFSET_HOURS,
          m,
          0,
          0,
        ),
      );
      const status = scheduledAt <= NOW_UTC ? 'COMPLETED' : 'SCHEDULED';
      // ^ nota: comparar scheduledAt com NOW_UTC (não mais cursor com
      // TODAY_UTC_MIDNIGHT) evita inconsistência quando a data efetiva
      // da aula (lessonDate) diverge do cursor por causa do override.

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

      isFirstOccurrence = false;
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
  status: 'PAID' | 'PENDING' | 'OVERDUE';
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
      provider: p.status === 'PAID' ? 'mercadolivre' : undefined,
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
  situacao: 'PAGO' | 'EM_ABERTO' | 'ATRASADO';
  // Caso especial (ex: Daniel Santos Silva): due date diferente do
  // início do ciclo de aulas.
  overrideDueDateStr?: string; // "DD/MM"

  // Override pontual: quando informado, a PRIMEIRA aula gerada no
  // ciclo usa essa data em vez do primeiro weekDay encontrado a
  // partir de startDateStr. As aulas seguintes continuam normais,
  // recorrendo no mesmo weekDay.
  firstLessonOverrideStr?: string; // "DD/MM"

  // Quando true, gera TAMBÉM um ciclo retroativo de 1 mês antes de
  // startDateStr (aulas + fatura paga), além do ciclo normal a
  // partir de startDateStr. Usado quando o aluno já vinha tendo aula
  // antes da data que temos registrada, e queremos refletir isso no
  // histórico.
  extraPastCycle?: boolean;
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
    amount: 250,
    teacherKey: 'mineia',
    startDateStr: '26/09',
    situacao: 'PAGO',
    extraPastCycle: true,
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
    amount: 135,
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
    amount: 270,
    teacherKey: 'mineia',
    startDateStr: '18/09',
    situacao: 'PAGO',
    extraPastCycle: true,
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
    amount: 270,
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
    amount: 250,
    teacherKey: 'mineia',
    startDateStr: '23/09',
    situacao: 'PAGO',
    extraPastCycle: true,
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
    amount: 135,
    teacherKey: 'mineia',
    startDateStr: '10/09',
    situacao: 'PAGO',
  },
  // 6. Renan Dias Militão
  {
    guardianName: 'Mineia Dias Pinto Militão',
    guardianEmail: 'renanmilitao44@gmail.com',
    guardianPhone: '67992936045',
    studentName: 'Renan Dias Militão',
    birthDateStr: '16/11/2012',
    instrument: Instrument.PIANO,
    weekDay: 4,
    startTime: '13:30',
    durationMinutes: 60,
    amount: 250,
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
    amount: 250,
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
    amount: 250,
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
    amount: 250,
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
    amount: 270,
    teacherKey: 'mineia',
    startDateStr: '11/09',
    situacao: 'PAGO',
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
    amount: 250,
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
    amount: 270,
    teacherKey: 'thiago',
    startDateStr: '27/08',
    situacao: 'PAGO',
    overrideDueDateStr: '04/09',
    extraPastCycle: true,
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
    amount: 250,
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
    amount: 250,
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
    amount: 250,
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
    amount: 250,
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
    amount: 250,
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
    amount: 270,
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
    amount: 250,
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
    amount: 250,
    teacherKey: 'thiago',
    startDateStr: '12/09',
    situacao: 'PAGO',
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
    amount: 250,
    teacherKey: 'henrique',
    startDateStr: '12/09',
    situacao: 'PAGO',
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
    amount: 145,
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
    amount: 270,
    teacherKey: 'henrique',
    startDateStr: '08/09',
    situacao: 'PAGO',
    firstLessonOverrideStr: '16/09', // 1ª aula excepcionalmente numa quarta
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
    amount: 320,
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
    amount: 250,
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
    amount: 250,
    teacherKey: 'henrique',
    startDateStr: '12/09',
    situacao: 'ATRASADO',
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
    amount: 250,
    teacherKey: 'henrique',
    startDateStr: '12/09',
    situacao: 'ATRASADO',
  },
  // 26. Rafael da Silva Arruda
  {
    guardianName: 'Rafael da Silva Arruda',
    guardianEmail: 'rafael_vap18@hotmail.com',
    guardianPhone: '67925097280',
    studentName: 'Rafael da Silva Arruda',
    birthDateStr: '20/08/1993',
    instrument: Instrument.VIOLAO,
    weekDay: 3,
    startTime: '20:00',
    durationMinutes: 60,
    amount: 250,
    teacherKey: 'henrique',
    startDateStr: '07/09',
    situacao: 'PAGO',
  },

  // 27. Jéssica Medina Wenz
  {
    guardianName: 'Jéssica Medina Wenz Ajala',
    guardianEmail: 'jessicamedinawenz@gmail.com',
    guardianPhone: '67993235703',
    studentName: 'Jéssica Medina Wenz Ajala',
    birthDateStr: '03/11/1994',
    instrument: Instrument.PIANO,
    weekDay: 1,
    startTime: '15:30',
    durationMinutes: 60,
    amount: 270,
    teacherKey: 'mineia',
    startDateStr: '17/09',
    situacao: 'EM_ABERTO',
    extraPastCycle: true,
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

  // ── Convite ──────────────────────────────────────────

  // Idêntico a AuthService: 7 dias.
  const INVITE_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 7;

  // AuthService usa this.config.getOrThrow<string>('APP_URL') — aqui,
  // fora do Nest, lemos direto de process.env. Precisa estar no seu
  // .env (mesma variável que o backend já usa em produção/dev).
  const APP_URL = process.env.APP_URL;
  if (!APP_URL) {
    throw new Error(
      'APP_URL não definida no .env — necessária para gerar o convite do seed',
    );
  }

  // Mesma lógica exata de AuthService.createInvite, só que chamando
  // prisma direto (o seed não tem acesso ao AuthService via DI).
  async function createInviteForUser(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await prisma.accountInvite.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + INVITE_EXPIRATION_MS),
      },
    });

    return `${APP_URL}/set-password.html?token=${rawToken}`;
  }

  // Envio do e-mail — HTML copiado literalmente de
  // EmailService.buildInviteEmailHtml, já que o seed roda fora do
  // contexto do Nest (sem DI pra usar o EmailService real).
  const resend = new Resend(process.env.RESEND_API_KEY);

  async function sendInviteEmail(params: {
    to: string;
    name: string;
    inviteLink: string;
  }) {
    const fromAddress = process.env.EMAIL_FROM ?? 'suporte@pianissima.com.br';
    const replyToAddress =
      process.env.EMAIL_REPLY_TO ?? 'pianissimaem@gmail.com';

    try {
      await resend.emails.send({
        from: `Pianíssima <${fromAddress}>`,
        to: params.to,
        replyTo: replyToAddress,
        subject: 'Bem-vindo(a) ao Pianíssima — crie sua senha',
        html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f1ea; padding: 32px;">
      <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px 24px;">
        <h1 style="font-size: 20px; color: #1a1a1a; margin-bottom: 8px;">Olá, ${params.name}!</h1>
        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          Sua conta no Pianíssima foi criada. Toque no botão abaixo para definir sua senha e começar a usar o app.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${params.inviteLink}" style="background: #b08d57; color: white; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 15px; text-decoration: none; display: inline-block;">
            Criar minha senha
          </a>
        </div>
        <p style="font-size: 13px; color: #9ca3af; line-height: 1.6;">
          Se você não esperava este e-mail, pode ignorá-lo com segurança.
        </p>
      </div>
    </div>
  `,
      });
      console.log(`  ✉️  Convite enviado para ${params.to}`);
    } catch (error) {
      console.error(`  ⚠️  Falha ao enviar convite pra ${params.to}:`, error);
    }
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const school = await prisma.school.create({
    data: {
      name: 'Pianíssima - Aqui tem Música',
      slug: 'pianissima-aqui-tem-musica',
      email: 'pianissimaem@gmail.com',
      phone: '67981047995',
    },
  });

  await prisma.user.create({
    data: {
      schoolId: school.id,
      name: 'Mineia Dias Pinto Militão',
      email: 'pianissimaem@gmail.com',
      passwordHash: await bcrypt.hash('pianissima123@', 10),
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
    'Henrique Dias Militão',
    'henriquemilitao35@gmail.com',
    'Professor de violão e bateria.',
  );
  const mineia = await createTeacher(
    'Mineia Dias Pinto Militão',
    'mineiamil01@gmail.com',
    'Professora de piano.',
  );
  const thiago = await createTeacher(
    'Thiago Guimarães',
    'thiago.professor@gmail.com',
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

  async function getOrCreateGuardianUser(
    name: string,
    email: string,
    phone: string | undefined,
  ) {
    if (guardianUserCache.has(email)) return guardianUserCache.get(email)!;

    const user = await prisma.user.create({
      data: {
        schoolId: school.id,
        name,
        email,
        passwordHash: null,
        role: Role.STUDENT,
        phone,
      },
    });

    guardianUserCache.set(email, user.id);

    const inviteLink = await createInviteForUser(user.id);
    await sendInviteEmail({ to: email, name, inviteLink });
    await sleep(600);

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
    // if (!cfg.birthDateStr) {
    //   skipped.push({
    //     studentName: cfg.studentName,
    //     reason: 'sem data de nascimento cadastrada',
    //   });
    //   continue;
    // }

    const userId = await getOrCreateGuardianUser(
      cfg.guardianName,
      cfg.guardianEmail,
      cfg.guardianPhone,
    );

    const student = await prisma.student.create({
      data: {
        userId,
        name: cfg.studentName,
        instrument: cfg.instrument,
        birthDate: cfg.birthDateStr ? parseBirthDate(cfg.birthDateStr) : null,
      },
    });

    const teacher = teacherMap[cfg.teacherKey];

    const cycleStart = parseDayMonth(cfg.startDateStr, YEAR);
    const cycleEnd = addMonthsUTC(cycleStart, 1);

    const dueDate = cfg.overrideDueDateStr
      ? parseDayMonth(cfg.overrideDueDateStr, YEAR)
      : cycleStart;

    // Se extraPastCycle, a matrícula "nasce" 1 mês antes — isso afeta
    // firstLessonDate/firstPaymentDueDate do enrollment (histórico real),
    // mas lastLessonPeriodStart/lastPaymentDueDate ficam no ciclo atual
    // (é dali que o cron vai continuar gerando os próximos).
    const pastCycleStart = cfg.extraPastCycle
      ? addMonthsUTC(cycleStart, -1)
      : null;
    const pastDueDate = cfg.extraPastCycle ? addMonthsUTC(dueDate, -1) : null;

    const enrollment = await prisma.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        teacherId: teacher.id,
        weekDay: cfg.weekDay,
        startTime: cfg.startTime,
        durationMinutes: cfg.durationMinutes,
        monthlyAmount: cfg.amount,
        firstLessonDate: pastCycleStart ?? cycleStart,
        firstPaymentDueDate: pastDueDate ?? dueDate,
        lastLessonPeriodStart: cycleStart,
        lastPaymentDueDate: dueDate,
        lastGeneratedPeriodKey: toPeriodKeyUTC(cycleStart),
      },
    });

    // ── Ciclo retroativo (opcional) ──────────────────────────────
    if (pastCycleStart && pastDueDate) {
      await createPaymentRecord({
        schoolId: school.id,
        studentId: student.id,
        enrollmentId: enrollment.id,
        amount: cfg.amount,
        dueDate: pastDueDate,
        status: 'PAID', // ciclo retroativo sempre nasce pago
        paidAt: pastDueDate,
      });

      await createLessonsInRange({
        schoolId: school.id,
        studentId: student.id,
        teacherId: teacher.id,
        enrollmentId: enrollment.id,
        weekDay: cfg.weekDay,
        startTime: cfg.startTime,
        durationMinutes: cfg.durationMinutes,
        fromDate: pastCycleStart,
        toDate: cycleStart, // exclusive — termina justo onde o ciclo atual começa
      });
    }

    // ── Ciclo atual (como já era) ────────────────────────────────
    await createPaymentRecord({
      schoolId: school.id,
      studentId: student.id,
      enrollmentId: enrollment.id,
      amount: cfg.amount,
      dueDate,
      status:
        cfg.situacao === 'PAGO'
          ? 'PAID'
          : cfg.situacao === 'EM_ABERTO'
            ? 'PENDING'
            : 'OVERDUE',
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
      firstLessonOverride: cfg.firstLessonOverrideStr
        ? parseDayMonth(cfg.firstLessonOverrideStr, YEAR)
        : undefined,
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
  console.log('  RESPONSÁVEIS');
  console.log(
    '  Todos receberam convite por e-mail para definir a própria senha.',
  );
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
