import { paymentPeriod } from './payment-period.util';

const key = (start: string) => `stu-1-${start}`;
const enrollment = (firstLesson: string) => ({
  firstLessonDate: new Date(`${firstLesson}T00:00:00Z`),
});

describe('paymentPeriod', () => {
  it('vai do início do ciclo até o dia antes do próximo', () => {
    expect(
      paymentPeriod(
        { idempotencyKey: key('2026-10-05') },
        enrollment('2026-08-05'),
      ),
    ).toEqual({ periodStart: '2026-10-05', periodLastDay: '2026-11-04' });
  });

  it('mês curto: dia-âncora 31 cai no último dia do mês', () => {
    // ciclo começa em 31/01; o próximo começa em 28/02 → termina 27/02
    expect(
      paymentPeriod(
        { idempotencyKey: key('2027-01-31') },
        enrollment('2026-10-31'),
      ),
    ).toEqual({ periodStart: '2027-01-31', periodLastDay: '2027-02-27' });
  });

  it('fatura avulsa (chave fora do padrão) ou sem matrícula não tem período', () => {
    const none = { periodStart: null, periodLastDay: null };
    expect(
      paymentPeriod({ idempotencyKey: 'manual-1' }, enrollment('2026-08-05')),
    ).toEqual(none);
    expect(paymentPeriod({ idempotencyKey: key('2026-10-05') }, null)).toEqual(
      none,
    );
  });
});
