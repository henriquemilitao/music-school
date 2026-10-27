import {
  addMonthsKeepingAnchor,
  dateWithAnchorDay,
  moveLessonToSchedule,
  onlyAfter,
  periodStartFromKey,
  shortestWeekdayShift,
  toLocalDay,
} from './enrollment-schedule.util';

// Escola em Campo Grande: UTC-4. 08:00 local = 12:00 UTC.
const OFFSET = -4;
const utc = (iso: string) => new Date(iso);

describe('shortestWeekdayShift', () => {
  it.each([
    [3, 3, 0],
    [3, 2, -1],
    [3, 4, 1],
    [3, 6, 3],
    [3, 0, -3],
    [0, 6, -1],
    [6, 0, 1],
    [1, 5, -3],
  ])('de %i para %i = %i dias', (from, to, expected) => {
    expect(shortestWeekdayShift(from, to)).toBe(expected);
  });
});

describe('moveLessonToSchedule', () => {
  const longAgo = utc('2020-01-01T00:00:00Z');

  it('só troca o horário (mesmo dia)', () => {
    // quarta 2026-11-04 08:00 local → 15:30 local
    const result = moveLessonToSchedule(
      utc('2026-11-04T12:00:00Z'),
      { startTime: '15:30' },
      OFFSET,
      longAgo,
    );
    expect(result.toISOString()).toBe('2026-11-04T19:30:00.000Z');
  });

  it('troca o dia pro mais próximo da mesma semana (quarta → terça)', () => {
    const result = moveLessonToSchedule(
      utc('2026-11-04T12:00:00Z'),
      { weekDay: 2, startTime: '08:00' },
      OFFSET,
      longAgo,
    );
    expect(result.toISOString()).toBe('2026-11-03T12:00:00.000Z');
  });

  it('troca o dia pra frente quando é o mais próximo (quarta → sexta)', () => {
    const result = moveLessonToSchedule(
      utc('2026-11-04T12:00:00Z'),
      { weekDay: 5 },
      OFFSET,
      longAgo,
    );
    expect(result.toISOString()).toBe('2026-11-06T12:00:00.000Z');
  });

  it('mantém o horário original quando só o dia muda', () => {
    const result = moveLessonToSchedule(
      utc('2026-11-04T18:45:00Z'), // 14:45 local
      { weekDay: 5 },
      OFFSET,
      longAgo,
    );
    expect(result.toISOString()).toBe('2026-11-06T18:45:00.000Z');
  });

  it('nunca cria aula antes de notBefore: se o caminho curto cai no passado, vai pra frente', () => {
    // quarta 04/11, queremos terça → 03/11, mas "agora" já é 04/11 06:00 UTC
    const result = moveLessonToSchedule(
      utc('2026-11-04T12:00:00Z'),
      { weekDay: 2 },
      OFFSET,
      utc('2026-11-04T06:00:00Z'),
    );
    expect(result.toISOString()).toBe('2026-11-10T12:00:00.000Z');
  });

  it('aula noturna (hora UTC vira o dia seguinte) é movida pelo dia LOCAL', () => {
    // quarta 22:00 local = quinta 02:00 UTC. Pra segunda: -2 dias locais.
    const result = moveLessonToSchedule(
      utc('2026-11-05T02:00:00Z'),
      { weekDay: 1 },
      OFFSET,
      longAgo,
    );
    // segunda 02/11 22:00 local = terça 03/11 02:00 UTC
    expect(result.toISOString()).toBe('2026-11-03T02:00:00.000Z');
  });
});

describe('toLocalDay', () => {
  it('aula noturna pertence ao dia local, não ao dia UTC', () => {
    expect(toLocalDay(utc('2026-11-05T02:00:00Z'), OFFSET).toISOString()).toBe(
      '2026-11-04T00:00:00.000Z',
    );
  });
});

describe('periodStartFromKey', () => {
  it('extrai o início do ciclo do final da idempotencyKey', () => {
    const key = '3f2b8c1e-aaaa-bbbb-cccc-1234567890ab-2026-09-15';
    expect(periodStartFromKey(key)?.toISOString()).toBe(
      '2026-09-15T00:00:00.000Z',
    );
  });

  it('devolve null quando a chave não segue o padrão', () => {
    expect(periodStartFromKey('avulsa-123')).toBeNull();
  });
});

describe('addMonthsKeepingAnchor', () => {
  it('mantém o dia-âncora e ajusta pro último dia do mês curto', () => {
    expect(
      addMonthsKeepingAnchor(31, utc('2026-01-31T00:00:00Z'), 1).toISOString(),
    ).toBe('2026-02-28T00:00:00.000Z');
    expect(
      addMonthsKeepingAnchor(31, utc('2026-02-28T00:00:00Z'), 1).toISOString(),
    ).toBe('2026-03-31T00:00:00.000Z');
  });

  it('vira o ano', () => {
    expect(
      addMonthsKeepingAnchor(15, utc('2026-12-15T00:00:00Z'), 1).toISOString(),
    ).toBe('2027-01-15T00:00:00.000Z');
  });
});

describe('dateWithAnchorDay', () => {
  it('usa o mesmo mês quando o dia existe', () => {
    expect(
      dateWithAnchorDay(utc('2026-09-10T12:00:00Z'), 20).toISOString(),
    ).toBe('2026-09-20T12:00:00.000Z');
  });

  it('avança pro próximo mês que tem o dia (31 a partir de abril → maio)', () => {
    const result = dateWithAnchorDay(utc('2026-04-10T12:00:00Z'), 31);
    expect(result.getUTCDate()).toBe(31);
    expect(result.toISOString()).toBe('2026-05-31T12:00:00.000Z');
  });
});

describe('onlyAfter', () => {
  const dates = [
    utc('2026-12-01T12:00:00Z'),
    utc('2026-12-08T12:00:00Z'),
    utc('2026-12-15T12:00:00Z'),
  ];

  it('sem aula existente, mantém tudo', () => {
    expect(onlyAfter(dates, null)).toHaveLength(3);
  });

  it('descarta datas iguais ou anteriores à última aula existente', () => {
    const result = onlyAfter(dates, utc('2026-12-08T12:00:00Z'));
    expect(result.map((d) => d.toISOString())).toEqual([
      '2026-12-15T12:00:00.000Z',
    ]);
  });
});
