import axios from 'axios';

// Troque pelo IP da sua máquina na rede local (mesmo que você usou no Expo)
// Em produção isso viraria uma env var apontando pro servidor real
export const api = axios.create({
  baseURL: 'http://172.19.160.1:3000', // ajusta a porta pro que seu NestJS usa
});
