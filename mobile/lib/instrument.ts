// lib/instrument.ts
//
// Fonte única de verdade pra exibir o enum Instrument de forma
// legível. O valor cru (VIOLAO, BATERIA...) nunca deve aparecer
// direto numa tela — sempre passa por formatInstrument().

export type InstrumentValue = 'VIOLAO' | 'BATERIA' | 'PIANO' | 'GUITARRA';

export const INSTRUMENT_LABELS: Record<InstrumentValue, string> = {
  VIOLAO: 'Violão',
  BATERIA: 'Bateria',
  PIANO: 'Piano',
  GUITARRA: 'Guitarra',
};

export const INSTRUMENT_OPTIONS: { value: InstrumentValue; label: string }[] = (
  Object.keys(INSTRUMENT_LABELS) as InstrumentValue[]
).map((value) => ({
  value,
  label: INSTRUMENT_LABELS[value],
}));

export function formatInstrument(
  instrument: string | null | undefined,
): string {
  if (!instrument) return '—';
  return INSTRUMENT_LABELS[instrument as InstrumentValue] ?? instrument;
}
