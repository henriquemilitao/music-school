// Validação simples de formato — não pega tudo (nenhuma regex pega), mas barra
// os erros de digitação mais comuns antes de gastar uma requisição.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string) {
  return EMAIL_REGEX.test(value.trim());
}
