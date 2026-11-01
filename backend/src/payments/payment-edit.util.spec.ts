import {
  civilDateToNoonUtc,
  openStatusForDueDate,
  resolvePaidAt,
  schoolToday,
  withPeriodStart,
} from './payment-edit.util';

describe('payment-edit.util', () => {
  describe('civilDateToNoonUtc', () => {
    it('vira meio-dia UTC do dia', () => {
      expect(civilDateToNoonUtc('2026-10-05')?.toISOString()).toBe(
        '2026-10-05T12:00:00.000Z',
      );
    });
    it('recusa formato errado e dia que não existe', () => {
      expect(civilDateToNoonUtc('05/10/2026')).toBeNull();
      expect(civilDateToNoonUtc('2026-02-31')).toBeNull();
      expect(civilDateToNoonUtc('2026-13-01')).toBeNull();
    });
  });

  describe('schoolToday', () => {
    it('usa o fuso da escola (UTC-4): 02h UTC ainda é o dia anterior', () => {
      expect(schoolToday(new Date('2026-11-01T02:00:00Z'), -4)).toBe(
        '2026-10-31',
      );
      expect(schoolToday(new Date('2026-11-01T14:00:00Z'), -4)).toBe(
        '2026-11-01',
      );
    });
  });

  describe('openStatusForDueDate', () => {
    const now = new Date('2026-11-01T15:00:00Z');
    it('vence hoje continua pendente', () => {
      expect(openStatusForDueDate(new Date('2026-11-01T12:00:00Z'), now)).toBe(
        'PENDING',
      );
    });
    it('venceu ontem fica atrasada', () => {
      expect(openStatusForDueDate(new Date('2026-10-31T12:00:00Z'), now)).toBe(
        'OVERDUE',
      );
    });
    it('vence amanhã é pendente', () => {
      expect(openStatusForDueDate(new Date('2026-11-02T12:00:00Z'), now)).toBe(
        'PENDING',
      );
    });
  });

  describe('resolvePaidAt', () => {
    const now = new Date('2026-11-01T14:30:00Z'); // 10:30 na escola
    it('hoje → o instante de agora', () => {
      const r = resolvePaidAt('2026-11-01', now, -4);
      expect(r).toEqual({ ok: true, paidAt: now });
    });
    it('dia passado → meio-dia UTC daquele dia', () => {
      const r = resolvePaidAt('2026-10-28', now, -4);
      expect(r.ok && r.paidAt.toISOString()).toBe('2026-10-28T12:00:00.000Z');
    });
    it('dia futuro é recusado', () => {
      expect(resolvePaidAt('2026-11-02', now, -4)).toEqual({
        ok: false,
        reason: 'future',
      });
    });
    it('data inválida é recusada', () => {
      expect(resolvePaidAt('2026-02-30', now, -4)).toEqual({
        ok: false,
        reason: 'invalid',
      });
    });
  });

  describe('withPeriodStart', () => {
    it('troca só o início do período no fim da chave', () => {
      expect(withPeriodStart('abc-123-2026-10-05', '2026-10-12')).toBe(
        'abc-123-2026-10-12',
      );
    });
  });
});
