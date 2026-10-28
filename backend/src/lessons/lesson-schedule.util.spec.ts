import { shiftLesson } from './lesson-schedule.util';

// Escola em UTC-4: 15:00 local = 19:00 UTC
const OFFSET = -4;
const at = (iso: string) => new Date(iso);

describe('shiftLesson', () => {
  it('passa a aula pra 2 dias depois mantendo o horário local', () => {
    // segunda 2026-11-02 15:00 local
    const result = shiftLesson(
      at('2026-11-02T19:00:00Z'),
      { shiftDays: 2 },
      OFFSET,
    );
    expect(result).toEqual(at('2026-11-04T19:00:00Z'));
  });

  it('desloca pra trás com número negativo', () => {
    expect(
      shiftLesson(at('2026-11-02T19:00:00Z'), { shiftDays: -7 }, OFFSET),
    ).toEqual(at('2026-10-26T19:00:00Z'));
  });

  it('muda só o horário (hora local da escola) e mantém o dia', () => {
    expect(
      shiftLesson(at('2026-11-02T19:00:00Z'), { startTime: '09:30' }, OFFSET),
    ).toEqual(at('2026-11-02T13:30:00Z'));
  });

  it('muda dia e horário juntos', () => {
    expect(
      shiftLesson(
        at('2026-11-02T19:00:00Z'),
        { shiftDays: 3, startTime: '10:00' },
        OFFSET,
      ),
    ).toEqual(at('2026-11-05T14:00:00Z'));
  });

  it('respeita o dia LOCAL quando a hora UTC já virou o dia', () => {
    // 22:00 local = 02:00 UTC do dia seguinte; +1 dia local = 22:00 do dia seguinte
    expect(
      shiftLesson(at('2026-11-03T02:00:00Z'), { shiftDays: 1 }, OFFSET),
    ).toEqual(at('2026-11-04T02:00:00Z'));
    // horário novo 21:00 local de 02/11 (data local da aula) = 01:00 UTC de 03/11
    expect(
      shiftLesson(at('2026-11-03T02:00:00Z'), { startTime: '21:00' }, OFFSET),
    ).toEqual(at('2026-11-03T01:00:00Z'));
  });

  it('atravessa fim de mês', () => {
    expect(
      shiftLesson(at('2026-10-30T19:00:00Z'), { shiftDays: 3 }, OFFSET),
    ).toEqual(at('2026-11-02T19:00:00Z'));
  });

  it('sem mudança devolve o mesmo instante', () => {
    expect(shiftLesson(at('2026-11-02T19:00:00Z'), {}, OFFSET)).toEqual(
      at('2026-11-02T19:00:00Z'),
    );
  });
});
