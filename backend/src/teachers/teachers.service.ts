import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeachersService {
  constructor(private prisma: PrismaService) {}

  // Professores ativos da escola, só com o necessário pra montar um seletor
  // (ex: tela de novo aluno no app do admin). O `id` é o do Teacher — o mesmo
  // que `teacherId` da matrícula espera.
  findAllBySchool(schoolId: string) {
    return this.prisma.teacher.findMany({
      where: { user: { schoolId, isActive: true } },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
    });
  }
}
