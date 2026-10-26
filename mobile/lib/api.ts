import axios from 'axios';
import * as Updates from 'expo-updates';

const PRODUCTION_API_URL =
  'https://music-school-production-25a7.up.railway.app';
const STAGING_API_URL = 'https://music-school-staging.up.railway.app';

function resolveBaseURL() {
  // Desenvolvimento (Expo Go / dev client): vale o que o `npm run dev`
  // configurou (IP da rede local).
  if (__DEV__) return process.env.EXPO_PUBLIC_API_URL ?? PRODUCTION_API_URL;

  // App publicado (build ou update OTA): a API é escolhida SOMENTE pelo
  // canal em que o app foi instalado (definido no eas.json no build e que
  // nenhum update consegue trocar). Variáveis de ambiente e arquivos .env
  // são ignorados de propósito: um .env errado no momento do `eas update`
  // já fez o app de produção usar a API/banco de staging.
  //   canal "preview"  -> staging
  //   qualquer outro   -> produção
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
