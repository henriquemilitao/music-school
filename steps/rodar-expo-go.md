# Rodar tudo local + Expo Go (dev)

## 1. Banco (Docker)
Na raiz, com o `.env` preenchido (veja `.env.example`):

    docker compose up -d

Se o Enfermaria (ou outro projeto) já usa a porta 5432, coloque `DB_PORT=5433`
no `.env` da raiz e use `5433` no `DATABASE_URL` do `backend/.env`.

## 2. Backend
Em `backend/` (com `backend/.env` preenchido, veja `backend/.env.example`):

    npm install
    npx prisma migrate deploy      # cria/atualiza as tabelas
    npm run start:dev

Se o Enfermaria já usa a porta 3000, coloque `PORT=3001` no `backend/.env`.

## 3. App no celular (Expo Go)
Em `mobile/`, com celular e PC no MESMO Wi-Fi:

    npm install
    npm run start:phone

O script detecta o IP do Wi-Fi, aponta a API pra ele e sobe o Expo em modo
Expo Go. Escaneie o QR code com o Expo Go.

Variações:

    npm run start:phone -- --clear                 # limpa o cache do Metro
    npm run start:phone -- --port 8082             # Metro do Enfermaria em 8081
    EXPO_PUBLIC_API_PORT=3001 npm run start:phone  # backend na porta 3001
    EXPO_PUBLIC_API_URL=http://IP:PORTA npm run start:phone  # força a URL

`npm run start:devclient` sobe no modo Development Build (APK de dev).

## Limitações do Expo Go
- Push notification NÃO funciona (removido do Expo Go no SDK 53). Pra testar
  push, só com build (preview ou development).
- O Expo Go da loja precisa ser compatível com SDK 54. No Android, se der
  "incompatible", instale o Expo Go de SDK 54 em https://expo.dev/go.

## Se o celular não conectar
- Windows: liberar no firewall as portas do backend (3000) e do Metro (8081).
- WSL: use `networkingMode=mirrored` no `.wslconfig` (ver `steps/comandos`).
- Confira o IP que o script imprimiu; se estiver errado, force com
  `EXPO_PUBLIC_API_URL`.
