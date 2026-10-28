import { useCallback, useMemo, useState } from 'react';

// Seleção múltipla de itens por id (toque longo / "Selecionar"). `selecting`
// liga o modo de seleção, mesmo com zero itens marcados — assim "Selecionar"
// abre o modo e desmarcar o último item não fecha a barra sozinha.
export function useSelection() {
  const [selecting, setSelecting] = useState(false);
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());

  const start = useCallback((firstId?: string) => {
    setSelecting(true);
    if (firstId) setIds(new Set([firstId]));
  }, []);

  const clear = useCallback(() => {
    setSelecting(false);
    setIds(new Set());
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Marca (ou desmarca) vários de uma vez — ex: todas as aulas de um mês
  const setMany = useCallback((manyIds: string[], selected: boolean) => {
    setIds((current) => {
      const next = new Set(current);
      manyIds.forEach((id) => (selected ? next.add(id) : next.delete(id)));
      return next;
    });
  }, []);

  const selectAll = useCallback((allIds: string[]) => {
    setIds(new Set(allIds));
  }, []);

  // Esvazia a seleção mas mantém o modo ligado
  const unselectAll = useCallback(() => setIds(new Set()), []);

  return useMemo(
    () => ({
      selecting,
      ids,
      start,
      clear,
      toggle,
      setMany,
      selectAll,
      unselectAll,
    }),
    [selecting, ids, start, clear, toggle, setMany, selectAll, unselectAll],
  );
}

export type Selection = ReturnType<typeof useSelection>;
