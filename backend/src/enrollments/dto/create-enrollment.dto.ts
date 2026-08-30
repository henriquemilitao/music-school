// backend/src/enrollments/dto/create-enrollment.dto.ts
import {
  IsUUID,
  IsInt,
  IsString,
  IsDateString,
  IsOptional,
  IsDecimal,
  IsBoolean,
  Min,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEnrollmentDto {
  // ID do aluno (Student) que está sendo matriculado. Obrigatório —
  // toda matrícula precisa pertencer a um aluno já cadastrado.
  @ApiProperty({ description: 'ID do Student' })
  @IsUUID() // valida que a string enviada tem formato de UUID (evita
  // erro besta tipo mandar "123" e o Prisma quebrar mais na frente
  // com uma mensagem de erro confusa)
  studentId!: string;

  // ID do professor responsável pela aula. Opcional porque nem toda
  // matrícula precisa ter professor definido de cara (pode ser
  // atribuído depois).
  @ApiPropertyOptional({ description: 'ID do Teacher (opcional)' })
  @IsOptional() // deixa o campo passar como undefined sem erro de validação
  @IsUUID()
  teacherId?: string;

  // Horário da aula, sempre no formato "HH:MM" (ex: "15:00"). Usado
  // junto com firstLessonDate pra montar o horário exato de cada
  // aula gerada (ver buildLessonsForPeriod no service).
  @ApiProperty({ description: 'Horário no formato HH:MM', example: '15:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    // regex garante exatamente 2 dígitos, dois-pontos, 2 dígitos —
    // rejeita formatos tipo "3:00" ou "15:00:00" antes de chegar no
    // service, onde um split(':') mal-formado quebraria silenciosamente
    message: 'startTime deve estar no formato HH:MM',
  })
  startTime!: string;

  // Duração de cada aula em minutos. Opcional — se o admin não
  // informar, o service aplica um default de 60 (ver EnrollmentsService.create).
  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt() // precisa ser número inteiro, não "60.5" nem "sessenta"
  @Min(30) // trava um mínimo razoável — evita cadastro acidental de
  // aula de "5 minutos" por erro de digitação
  durationMinutes?: number;

  // Valor cheio da mensalidade (SEM desconto de pontualidade — o
  // desconto é aplicado depois, na hora de gerar o PIX, nunca aqui).
  @ApiProperty({ description: 'Valor da mensalidade', example: '200.00' })
  @IsDecimal() // aceita string decimal ("200.00"), não number — o
  // Prisma armazena isso como Decimal(10,2) pra evitar erro de
  // arredondamento de ponto flutuante que number/float teria com dinheiro
  monthlyAmount!: string;

  // Data da primeira aula dessa matrícula. Essa data sozinha decide
  // DUAS coisas no service: (1) o dia da semana das aulas (extraído
  // via getUTCDay()), e (2) o "dia âncora" que todo ciclo mensal de
  // aulas seguinte vai tentar repetir (ver getNextMonthlyDate).
  @ApiProperty({
    description: 'Data da primeira aula (define o dia da semana das aulas)',
    example: '2026-09-15',
  })
  @IsDateString() // valida formato de data ISO (ex: "2026-09-15"),
  // rejeitando strings que não parseiam pra data válida
  firstLessonDate!: string;

  // Data do primeiro vencimento da mensalidade. INDEPENDENTE de
  // firstLessonDate — pode cair antes, igual, ou depois da primeira
  // aula (ex: aula começa dia 15, mas o admin combinou vencimento
  // dia 10). OPCIONAL: se o admin não informar, o service usa
  // firstLessonDate como valor padrão (mesma data das duas coisas),
  // ver EnrollmentsService.create.
  @ApiPropertyOptional({
    description:
      'Data do primeiro vencimento da mensalidade. Se não informado, usa a mesma data de firstLessonDate como padrão.',
    example: '2026-09-10',
  })
  @IsOptional()
  @IsDateString()
  firstPaymentDueDate?: string;

  // Rótulo do mês dessa fatura, no formato "YYYY-MM" (ex: "2026-09"
  // pra "Setembro/2026"). OPCIONAL: se o admin não informar, o
  // service calcula automaticamente a partir do MÊS de
  // firstPaymentDueDate (ex: vence 10/09 → referenceMonth = "2026-09").
  // Existe pra cobrir o caso ambíguo que você descreveu: um ciclo de
  // aulas que atravessa a virada do mês (ex: aulas de 28/08 até
  // 27/09) pode ser rotulado como "agosto" ou "setembro" dependendo
  // do que fizer mais sentido pro admin — por isso é ele quem decide,
  // não uma regra fixa baseada só na data de início.
  @ApiPropertyOptional({
    description:
      'Rótulo do mês desta fatura no formato YYYY-MM (ex: "2026-09"). Se não informado, é calculado automaticamente a partir do mês de firstPaymentDueDate.',
    example: '2026-09',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    // regex garante exatamente 4 dígitos de ano, hífen, e mês entre
    // 01 e 12 — mesmo padrão já usado em FindPaymentsQueryDto, pra
    // manter consistência no formato usado em todo o backend
    message: 'referenceMonth deve estar no formato YYYY-MM',
  })
  referenceMonth?: string;

  // Se true, a primeira mensalidade já nasce como PAGA (ex: aluno
  // pagou presencialmente na hora da matrícula, sem passar pelo
  // fluxo de PIX). Default false — nasce PENDING ou OVERDUE conforme
  // a data de vencimento já tiver passado ou não.
  @ApiPropertyOptional({
    description:
      'Se true, a primeira mensalidade já nasce como PAGA (ex: aluno pagou presencialmente na matrícula). Default: false (nasce PENDING/OVERDUE conforme a data)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  firstPaymentPaid?: boolean;

  // frequency removido do DTO por enquanto — MVP fixa em WEEKLY no
  // service (default do schema). Reintroduzir quando BIWEEKLY tiver
  // uma lógica de intervalo real (a atual, por index par/ímpar, não
  // garante 15 dias de verdade entre aulas).
}
