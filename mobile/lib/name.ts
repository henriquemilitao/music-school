export function firstName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
}

// Minúsculas, sem acento e com espaços normalizados — base das buscas e
// das comparações de nome.
export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Compara dois nomes ignorando maiúsculas, acentos e espaços repetidos —
// usado nas confirmações do tipo "digite o nome para continuar". O servidor
// aplica a mesma regra.
export function namesMatch(a: string, b: string) {
  return normalizeText(a) === normalizeText(b);
}
