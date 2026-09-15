import { PrismaClient, Role, Instrument } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto'; // mesmas funções do AuthService
import { Resend } from 'resend';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// SEED DE TESTE — valida o fluxo de convite por e-mail ponta a
// ponta (criação de usuário sem senha + geração de token + envio
// via Resend) usando SEUS PRÓPRIOS e-mails, antes de rodar o seed
// real contra produção com dados de alunos verdadeiros.
//
// Roda uma versão mínima: 1 escola, 1 professor, e um "aluno fake"
// pra cada e-mail de teste, cada um com um responsável diferente
// (usando os e-mails fornecidos).
// ─────────────────────────────────────────────────────────────

const TEST_EMAILS = [
  'henriquemiltao35@gmail.com',
  'renanmilitao44@gmail.com',
  'henriquemilitaohdm@gmail.com',
  'henriquemilitaobackup@gmail.com',
  'hdmconstrutora13@gmail.com',
  'henrique.militao@ufms.br',
];

function dateUTCNoon(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
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

async function main() {
  console.log('🧹 Limpando dados de teste anteriores (se existirem)...');
  // Remove só os usuários de teste (pelo e-mail), sem tocar em dados
  // reais que porventura já existam no banco (não roda deleteMany
  // geral, propositalmente).
  const existing = await prisma.user.findMany({
    where: { email: { in: TEST_EMAILS } },
    select: { id: true },
  });
  const existingIds = existing.map((u) => u.id);

  if (existingIds.length > 0) {
    await prisma.payment.deleteMany({
      where: { student: { userId: { in: existingIds } } },
    });
    await prisma.enrollment.deleteMany({
      where: { student: { userId: { in: existingIds } } },
    });
    await prisma.student.deleteMany({
      where: { userId: { in: existingIds } },
    });
    await prisma.accountInvite.deleteMany({
      where: { userId: { in: existingIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: existingIds } } });
  }

  // ── Escola de teste (reaproveita se já existir) ──
  const school = await prisma.school.upsert({
    where: { slug: 'pianissima-teste-convite' },
    update: {},
    create: {
      name: 'Pianíssima - TESTE CONVITE',
      slug: 'pianissima-teste-convite',
      email: 'pianissimaem@gmail.com',
      phone: '67981047995',
    },
  });

  // ── Professor de teste (reaproveita se já existir) ──
  let teacherUser = await prisma.user.findFirst({
    where: { email: 'professor-teste-convite@example.com' },
  });
  if (!teacherUser) {
    teacherUser = await prisma.user.create({
      data: {
        schoolId: school.id,
        name: 'Professor Teste',
        email: 'professor-teste-convite@example.com',
        passwordHash: await bcrypt.hash('prof123', 10),
        role: Role.TEACHER,
      },
    });
  }
  let teacher = await prisma.teacher.findFirst({
    where: { userId: teacherUser.id },
  });
  if (!teacher) {
    teacher = await prisma.teacher.create({
      data: { userId: teacherUser.id, bio: 'Professor de teste.' },
    });
  }

  // ── Convite: mesma lógica exata do AuthService ──
  const INVITE_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

  const APP_URL = process.env.APP_URL;
  if (!APP_URL) {
    throw new Error(
      'APP_URL não definida no .env — necessária para gerar o convite do seed',
    );
  }

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
        subject: '[TESTE] Bem-vindo(a) ao Pianíssima — crie sua senha',
        html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f1ea; padding: 32px;">
      <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px 24px;">
        <h1 style="font-size: 20px; color: #1a1a1a; margin-bottom: 8px;">Olá, ${params.name}!</h1>
        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          [TESTE] Sua conta no Pianíssima foi criada. Toque no botão abaixo para definir sua senha e começar a usar o app.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${params.inviteLink}" style="background: #b08d57; color: white; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 15px; text-decoration: none; display: inline-block;">
            Criar minha senha
          </a>
        </div>
        <p style="font-size: 13px; color: #9ca3af; line-height: 1.6;">
          Este é um e-mail de teste do fluxo de convite. Se você não esperava, pode ignorá-lo com segurança.
        </p>
      </div>
    </div>
  `,
      });
      console.log(`  ✉️  Convite enviado para ${params.to}`);
      return true;
    } catch (error) {
      console.error(`  ⚠️  Falha ao enviar convite pra ${params.to}:`, error);
      return false;
    }
  }

  // Pequeno delay entre envios pra não estourar rate limit do Resend
  // em planos free/baixos.
  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const results: { email: string; created: boolean; emailSent: boolean }[] = [];

  console.log(`\n👨‍👩‍👧 Criando ${TEST_EMAILS.length} responsáveis de teste...\n`);

  let dayCounter = 1;

  for (const email of TEST_EMAILS) {
    const name = `Responsável Teste (${email})`;

    const user = await prisma.user.create({
      data: {
        schoolId: school.id,
        name,
        email,
        passwordHash: null,
        role: Role.STUDENT,
      },
    });

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        name: `Aluno Fake ${dayCounter}`,
        instrument: Instrument.PIANO,
        birthDate: dateUTCNoon(2015, 1, 1),
      },
    });

    const cycleStart = dateUTCNoon(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      1,
    );

    const enrollment = await prisma.enrollment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        teacherId: teacher.id,
        weekDay: dayCounter % 7,
        startTime: '10:00',
        durationMinutes: 60,
        monthlyAmount: 100,
        firstLessonDate: cycleStart,
        firstPaymentDueDate: cycleStart,
        lastLessonPeriodStart: cycleStart,
        lastPaymentDueDate: cycleStart,
        lastGeneratedPeriodKey: toPeriodKeyUTC(cycleStart),
      },
    });

    await prisma.payment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        enrollmentId: enrollment.id,
        amount: 100,
        paidAmount: null,
        dueDate: cycleStart,
        status: 'PENDING',
        paymentMethod: 'GATEWAY',
        referenceMonth: toMonthKeyUTC(cycleStart),
        idempotencyKey: `${student.id}-${toPeriodKeyUTC(cycleStart)}`,
      },
    });

    const inviteLink = await createInviteForUser(user.id);
    const emailSent = await sendInviteEmail({ to: email, name, inviteLink });

    results.push({ email, created: true, emailSent });

    dayCounter++;

    // delay de 600ms entre envios — ajuste conforme seu plano Resend
    await sleep(600);
  }

  console.log('\n✅ Seed de teste concluído\n');
  console.log('  RESUMO');
  for (const r of results) {
    console.log(
      `  ${r.emailSent ? '✓' : '✗'} ${r.email} — usuário criado: ${r.created ? 'sim' : 'não'}, e-mail enviado: ${r.emailSent ? 'sim' : 'NÃO'}`,
    );
  }

  const failedCount = results.filter((r) => !r.emailSent).length;
  if (failedCount > 0) {
    console.log(
      `\n⚠️  ${failedCount} e-mail(s) falharam. Revise antes de rodar o seed real em produção.`,
    );
  } else {
    console.log(
      '\n✅ Todos os e-mails de teste foram enviados com sucesso. Fluxo validado.',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
