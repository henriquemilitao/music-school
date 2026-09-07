import axios from 'axios';

// Em dev: usa localhost por padrão. Pra rodar no celular físico via
// Expo Go, o script `start:phone` seta EXPO_PUBLIC_API_URL com o IP
// do Wi-Fi automaticamente antes de subir o Expo.
// Em produção, configure EXPO_PUBLIC_API_URL apontando pro servidor real.
const baseURL =
  process.env.EXPO_PUBLIC_API_URL ??
  'https://music-school-production-25a7.up.railway.app';

export const api = axios.create({
  baseURL,
});

// ─────────────────────────────────────────────
// LOGOUT AUTOMÁTICO EM 401
// ─────────────────────────────────────────────
// api.ts não pode importar o AuthContext diretamente (ele fica fora
// da árvore React, e o AuthContext depende de hooks). Em vez disso,
// o AuthProvider REGISTRA sua função de signOut aqui assim que monta
// — esse arquivo só guarda a referência e chama quando precisar.
let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Mensagem amigável e padronizada — cada tela pode usar
    // error.friendlyMessage em vez de vasculhar error.response toda vez.
    const friendlyMessage =
      error?.response?.data?.message ??
      'Não foi possível completar a ação. Verifique sua conexão e tente novamente.';

    error.friendlyMessage = friendlyMessage;

    const status = error?.response?.status;

    // 401 = token expirado, inválido, ou usuário desativado
    // (JwtStrategy já barra isActive=false). Em qualquer um desses
    // casos, não faz sentido deixar o app "preso" mostrando erro —
    // o correto é deslogar e mandar pra tela de login.
    if (status === 401 && onUnauthorized) {
      onUnauthorized();
    }

    return Promise.reject(error);
  },
);
