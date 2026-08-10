import axios from 'axios';

// Em dev: usa localhost por padrão. Pra rodar no celular físico via
// Expo Go, o script `start:phone` seta EXPO_PUBLIC_API_URL com o IP
// do Wi-Fi automaticamente antes de subir o Expo.
// Em produção, configure EXPO_PUBLIC_API_URL apontando pro servidor real.
const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL,
});
