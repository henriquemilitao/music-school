import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { EnrollmentsController } from './enrollments/enrollments.controller';
import { EnrollmentManagementService } from './enrollments/enrollment-management.service';
import { EnrollmentRenewalCron } from './enrollments/enrollment-renewal.cron';
import { EnrollmentsService } from './enrollments/enrollments.service';
import { StudentsController } from './students/students.controller';
import { StudentsService } from './students/students.service';

// Sobe o Nest de verdade (Fastify + o mesmo ValidationPipe do main.ts) com os
// serviços mockados e dispara requisições HTTP. Garante que cada rota que o
// app usa EXISTE e que o corpo que o app envia passa na validação — coisa que
// os testes de serviço não pegam (foi o que faltou no "Cannot PATCH").
describe('Rotas HTTP usadas pelo app (admin)', () => {
  let app: NestFastifyApplication;

  const uuid = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const ENROLLMENT = uuid(1);
  const LESSON = uuid(2);
  const TEACHER = uuid(3);
  const PAYMENT = uuid(4);
  const STUDENT = uuid(5);

  const enrollmentManagement = {
    listUpcomingLessons: jest.fn(),
    previewScheduleChange: jest.fn(),
    previewEnd: jest.fn(),
    listEndOptions: jest.fn(),
    update: jest.fn(),
    end: jest.fn(),
  };
  const enrollmentsService = { findByStudent: jest.fn() };
  const studentsService = {
    findOne: jest.fn(),
    updateProfile: jest.fn(),
    deletePermanently: jest.fn(),
  };
  const authService = { requestFirstAccess: jest.fn() };

  const asAdmin = {
    canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest<{ user: unknown }>().user = {
        id: 'admin-1',
        email: 'admin@escola.com',
        role: 'ADMIN',
        schoolId: 'school-1',
      };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EnrollmentsController, StudentsController, AuthController],
      providers: [
        {
          provide: EnrollmentManagementService,
          useValue: enrollmentManagement,
        },
        { provide: EnrollmentsService, useValue: enrollmentsService },
        { provide: EnrollmentRenewalCron, useValue: {} },
        { provide: StudentsService, useValue: studentsService },
        { provide: AuthService, useValue: authService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(asAdmin)
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    // Mesma configuração do main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    enrollmentManagement.listUpcomingLessons.mockResolvedValue([]);
    enrollmentManagement.previewScheduleChange.mockResolvedValue({
      total: 0,
      lessons: [],
    });
    enrollmentManagement.previewEnd.mockResolvedValue({});
    enrollmentManagement.listEndOptions.mockResolvedValue({ payments: [] });
    enrollmentManagement.update.mockResolvedValue({ id: ENROLLMENT });
    enrollmentManagement.end.mockResolvedValue({});
    studentsService.updateProfile.mockResolvedValue({ id: STUDENT });
    studentsService.deletePermanently.mockResolvedValue({ deleted: true });
    authService.requestFirstAccess.mockResolvedValue({ status: 'SENT' });
  });

  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) => app.inject({ method, url, payload });

  describe('PATCH /enrollments/:id (Editar matrícula)', () => {
    it('aceita o corpo completo que o app monta (valor, vencimento, horário, professor)', async () => {
      const res = await call('PATCH', `/enrollments/${ENROLLMENT}`, {
        instrument: 'PIANO',
        teacherId: TEACHER,
        monthlyAmount: '270.00',
        paymentDueDay: 16,
        weekDay: 5,
        startTime: '15:00',
        durationMinutes: 45,
        applyFromLessonId: LESSON,
      });

      expect(res.statusCode).toBe(200);
      expect(enrollmentManagement.update).toHaveBeenCalledWith(
        ENROLLMENT,
        expect.objectContaining({ weekDay: 5, startTime: '15:00' }),
        'school-1',
      );
    });

    it('aceita só um campo (o app envia apenas o que mudou)', async () => {
      const res = await call('PATCH', `/enrollments/${ENROLLMENT}`, {
        monthlyAmount: '300.00',
      });
      expect(res.statusCode).toBe(200);
    });

    it('recusa campo desconhecido (mass assignment)', async () => {
      const res = await call('PATCH', `/enrollments/${ENROLLMENT}`, {
        isActive: true,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Aulas e prévias da matrícula', () => {
    it('GET /enrollments/:id/upcoming-lessons', async () => {
      const res = await call(
        'GET',
        `/enrollments/${ENROLLMENT}/upcoming-lessons`,
      );
      expect(res.statusCode).toBe(200);
      expect(enrollmentManagement.listUpcomingLessons).toHaveBeenCalledWith(
        ENROLLMENT,
        'school-1',
      );
    });

    it('GET /enrollments/:id/schedule-preview com os parâmetros do app', async () => {
      const res = await call(
        'GET',
        `/enrollments/${ENROLLMENT}/schedule-preview?fromLessonId=${LESSON}&weekDay=5&startTime=15:00&durationMinutes=45`,
      );
      expect(res.statusCode).toBe(200);
      expect(enrollmentManagement.previewScheduleChange).toHaveBeenCalledWith(
        ENROLLMENT,
        'school-1',
        expect.objectContaining({ weekDay: 5, durationMinutes: 45 }),
      );
    });

    it('GET /enrollments/:id/end-preview nos três modos', async () => {
      const base = `/enrollments/${ENROLLMENT}/end-preview`;
      const now = await call('GET', `${base}?mode=NOW`);
      const lesson = await call(
        'GET',
        `${base}?mode=FROM_LESSON&fromLessonId=${LESSON}`,
      );
      const invoice = await call(
        'GET',
        `${base}?mode=AFTER_INVOICE&afterPaymentId=${PAYMENT}`,
      );
      expect([now.statusCode, lesson.statusCode, invoice.statusCode]).toEqual([
        200, 200, 200,
      ]);
      expect(enrollmentManagement.previewEnd).toHaveBeenLastCalledWith(
        ENROLLMENT,
        'school-1',
        { mode: 'AFTER_INVOICE', afterPaymentId: PAYMENT },
      );
    });

    it('GET /enrollments/:id/end-preview exige o modo', async () => {
      const res = await call('GET', `/enrollments/${ENROLLMENT}/end-preview`);
      expect(res.statusCode).toBe(400);
    });

    it('GET /enrollments/:id/end-options', async () => {
      const res = await call('GET', `/enrollments/${ENROLLMENT}/end-options`);
      expect(res.statusCode).toBe(200);
      expect(enrollmentManagement.listEndOptions).toHaveBeenCalledWith(
        ENROLLMENT,
        'school-1',
      );
    });
  });

  describe('POST /enrollments/:id/end (Encerrar matrícula)', () => {
    it('a partir de uma aula, com faturas a apagar', async () => {
      const res = await call('POST', `/enrollments/${ENROLLMENT}/end`, {
        mode: 'FROM_LESSON',
        fromLessonId: LESSON,
        deletePaymentIds: [PAYMENT],
      });

      expect(res.statusCode).toBe(201);
      expect(enrollmentManagement.end).toHaveBeenCalledWith(
        ENROLLMENT,
        'school-1',
        {
          mode: 'FROM_LESSON',
          fromLessonId: LESSON,
          deletePaymentIds: [PAYMENT],
        },
        'admin-1',
      );
    });

    it('agora', async () => {
      const res = await call('POST', `/enrollments/${ENROLLMENT}/end`, {
        mode: 'NOW',
        deletePaymentIds: [],
      });
      expect(res.statusCode).toBe(201);
    });

    it('ao fim de uma fatura', async () => {
      const res = await call('POST', `/enrollments/${ENROLLMENT}/end`, {
        mode: 'AFTER_INVOICE',
        afterPaymentId: PAYMENT,
      });
      expect(res.statusCode).toBe(201);
    });

    it('recusa corpo sem modo ou com modo desconhecido', async () => {
      const semModo = await call('POST', `/enrollments/${ENROLLMENT}/end`, {});
      const invalido = await call('POST', `/enrollments/${ENROLLMENT}/end`, {
        mode: 'DEPOIS',
      });
      expect(semModo.statusCode).toBe(400);
      expect(invalido.statusCode).toBe(400);
    });

    it('aceita faturas marcadas como pagas e recusa id inválido nelas', async () => {
      const ok = await call('POST', `/enrollments/${ENROLLMENT}/end`, {
        mode: 'NOW',
        markPaidPaymentIds: [PAYMENT],
      });
      const invalido = await call('POST', `/enrollments/${ENROLLMENT}/end`, {
        mode: 'NOW',
        markPaidPaymentIds: ['nao-e-uuid'],
      });
      expect(ok.statusCode).toBe(201);
      expect(invalido.statusCode).toBe(400);
    });

    it('recusa id de fatura inválido', async () => {
      const res = await call('POST', `/enrollments/${ENROLLMENT}/end`, {
        mode: 'NOW',
        deletePaymentIds: ['nao-e-uuid'],
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Alunos', () => {
    it('PATCH /students/:id/profile (Editar dados cadastrais)', async () => {
      const res = await call('PATCH', `/students/${STUDENT}/profile`, {
        name: 'Javah Silva',
        birthDate: '1999-03-12',
        guardianName: 'Maria Silva',
        guardianEmail: 'maria@email.com',
        guardianPhone: '67999998888',
      });

      expect(res.statusCode).toBe(200);
      expect(studentsService.updateProfile).toHaveBeenCalledWith(
        STUDENT,
        expect.objectContaining({ guardianPhone: '67999998888' }),
        'school-1',
      );
    });

    it('PATCH /students/:id/profile aceita telefone vazio (remove o telefone)', async () => {
      const res = await call('PATCH', `/students/${STUDENT}/profile`, {
        guardianPhone: '',
      });
      expect(res.statusCode).toBe(200);
    });

    it('DELETE /students/:id?confirmName= (Excluir aluno)', async () => {
      const res = await call(
        'DELETE',
        `/students/${STUDENT}?confirmName=${encodeURIComponent('Javah Silva')}`,
      );
      expect(res.statusCode).toBe(200);
      expect(studentsService.deletePermanently).toHaveBeenCalledWith(
        STUDENT,
        'Javah Silva',
        'school-1',
      );
    });
  });

  describe('POST /auth/first-access (Criar senha pelo login)', () => {
    it('aceita o e-mail', async () => {
      const res = await call('POST', '/auth/first-access', {
        email: 'maria@email.com',
      });
      expect(res.statusCode).toBe(201);
    });

    it('recusa e-mail inválido', async () => {
      const res = await call('POST', '/auth/first-access', { email: 'xx' });
      expect(res.statusCode).toBe(400);
    });
  });
});
