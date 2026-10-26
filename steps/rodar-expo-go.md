# Rodar tudo local (WSL + Expo Go) com um comando

Mesmo fluxo do Enfermaria: tudo roda DENTRO do WSL (banco, back e Expo) e o
celular acessa pelo IP do Windows.

## Uso

No VS Code: `Ctrl+Shift+P` -> `Tasks: Run Task` -> **Pianíssima: Tudo**
Ou no terminal (WSL), na raiz do projeto:

    npm run dev

Isso faz, em ordem: sobe o Postgres (Docker) -> gera o Prisma Client -> aplica
as migrations -> sobe a API (logs em `.logs/back.log`) e o Prisma Studio ->
espera a API responder -> sobe o Expo em modo Expo Go e mostra o QR code.

| Comando                  | O que faz                                              |
| ------------------------ | ------------------------------------------------------ |
| `npm run dev`            | banco + back + Studio + app                            |
| `npm run dev:back`       | banco + back + Studio (logs na tela)                   |
| `npm run dev:mobile`     | só o app (back já rodando)                             |
| `npm run dev:mobile -- --clear` | app limpando o cache do Metro                   |
| `npm run logs`           | acompanha o log do back (`.logs/back.log`)             |
| `npm run stop`           | derruba portas 3000/5555/8081 e o banco                |
| `npm run setup`          | instala dependências do backend e do mobile            |

URLs: API `http://IP:3000`, Swagger `http://IP:3000/api`, Studio `http://localhost:5555`.

## Primeira vez
1. `nvm use` (usa o Node do `.nvmrc`, 24 — o mesmo do Enfermaria).
2. Copie e preencha `.env` (raiz) e `backend/.env` a partir dos `.env.example`.
3. Docker rodando. Celular e PC no mesmo Wi-Fi.
4. Se o Windows pedir permissão de administrador (UAC), aceite: é o port proxy
   Windows -> WSL (só pede quando o IP do WSL muda; as portas 3000/8081 e a
   regra de firewall são as mesmas do Enfermaria).

## Enfermaria e Pianíssima juntos?
Os dois usam as portas 3000 (API) e 8081 (Expo) — rode um de cada vez
(`npm run stop` no que estiver rodando). O banco não conflita (5432 aqui,
5433 lá). Pra rodar os dois ao mesmo tempo, troque as portas deste:

    API_PORT=3001 METRO_PORT=8082 npm run dev

## Expo Go: limitações
- Push notification NÃO funciona no Expo Go (removido no SDK 53); o app
  detecta isso e pula o registro. Pra testar push, só com build.
- O Expo Go precisa ser o de SDK 54. Se der "incompatível", instale em
  https://expo.dev/go.

## Problemas comuns
- "Porta em uso": veja acima (`npm run stop`).
- Celular não conecta: confira o IP impresso (`📶 IP da rede`); force com
  `LAN_IP=192.168.x.x npm run dev`. Firewall do Windows precisa liberar 3000 e 8081.
- Erro estranho de módulo nativo no Metro: o `mobile/node_modules` pode ter
  sido instalado pelo Windows. No WSL: `rm -rf mobile/node_modules && npm install --prefix mobile`.
- WSL em modo `mirrored`: funciona (o script detecta e pula o port proxy).
