import { PrismaService } from '../../prisma/prisma.service';

// Fuso da escola em horas em relação ao UTC (ex: -4). As aulas são gravadas em
// UTC; este valor converte de/para a hora que a escola enxerga.
export async function getSchoolTimezoneOffset(
  prisma: Pick<PrismaService, 'school'>,
  schoolId: string,
): Promise<number> {
  const school = await prisma.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: { timezoneOffsetHours: true },
  });
  return school.timezoneOffsetHours;
}
