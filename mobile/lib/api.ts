import axios from 'axios';
import * as Updates from 'expo-updates';

// Em dev: usa localhost por padrão. Pra rodar no celular físico via
// Expo Go, o script `start:phone` seta EXPO_PUBLIC_API_URL com o IP
// do Wi-Fi automaticamente antes de subir o Expo.
// Em produção, configure EXPO_PUBLIC_API_URL apontando pro servidor real.
const PRODUCTION_API_URL =
  'https://music-school-production-25a7.up.railway.app';
const STAGING_API_URL = 'https://music-school-staging.up.railway.app';

// Endereço que só funciona na máquina/rede do desenvolvedor.
function isLocalUrl(url: string) {
  return /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
    url,
  );
}

function resolveBaseURL() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;

  // Em desenvolvimento (Expo Go / dev client) vale o que o `npm run dev`
  // configurou, inclusive o IP da rede local.
  if (__DEV__ && fromEnv) return fromEnv;

  // App publicado (build ou update): nunca usar localhost/IP de rede. Isso
  // acontece quando um .env de desenvolvimento vaza pro pacote; o app
  // quebraria pra todo mundo. Cai na API do canal em que o app está.
  if (fromEnv && !isLocalUrl(fromEnv)) return fromEnv;
  return Updates.channel === 'preview' ? STAGING_API_URL : PRODUCTION_API_URL;
}

const baseURL = resolveBaseURL();

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
    // Sem error.response = a requisição não teve retorno do servidor
    // (sem internet, servidor fora do ar, timeout). Diferente de um
    // 401/400, onde o servidor respondeu dizendo que algo está errado.
    const isNetworkError = !error?.response;

    const friendlyMessage = isNetworkError
      ? 'Não foi possível conectar. Verifique sua internet e tente novamente.'
      : (error?.response?.data?.message ??
        'Não foi possível completar a ação. Verifique sua conexão e tente novamente.');

    error.friendlyMessage = friendlyMessage;
    error.isNetworkError = isNetworkError;

    const status = error?.response?.status;

    if (status === 401 && onUnauthorized) {
      onUnauthorized();
    }

    return Promise.reject(error);
  },
);
