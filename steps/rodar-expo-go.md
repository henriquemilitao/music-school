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

## Banco local igual à produção (restaurar dump)

Os dumps ficam em `backups/` (pasta no `.gitignore` — têm dados reais, nunca
commitar). Com o banco do Docker de pé:

    npm run db:restore                        # usa backups/prod.dump
    npm run db:restore -- backups/outro.dump
    npm run db:restore -- --anon-names        # também troca nomes/notas por genéricos
    DEV_PASSWORD=outra npm run db:restore     # senha dos usuários (padrão: senha123)

O que ele faz: apaga o banco local -> restaura o dump -> limpa dados sensíveis
-> `prisma migrate deploy` (aplica só o que a produção ainda não tem).

Limpeza: e-mails de quem não é ADMIN viram `user-<id>@example.com`; telefones,
push tokens, códigos/ids de Pix e convites/códigos de senha pendentes são
apagados; todos os usuários ganham a mesma senha de dev. Assim o ambiente local
não consegue mandar e-mail, push nem cobrança de verdade pra ninguém.

Se o restore reclamar de "unsupported version", o dump foi feito por um Postgres
mais novo: defina `POSTGRES_IMAGE_TAG=17-alpine` (a versão da produção) no `.env`
da raiz, rode `docker compose down -v` e tente de novo.

Cuidado: o `backend/.env` local deve usar chaves de TESTE (Mercado Pago etc.) e
`RESEND_API_KEY` de teste/vazia de verdade, nunca as de produção.

## Branches (depois de unir o app na main)
A branch `mobile` (app em produção) foi mesclada na base de trabalho, então
back, banco e app vivem juntos na mesma branch. Fluxo planejado:
1. `npm run dev` (Expo Go + back local) -> testar.
2. Build de preview (`eas build --profile preview`): usa a API de staging
   (`music-school-staging` no Railway, definida no `eas.json`).
3. Se estiver ok, merge na `main` e build de production.

Aviso: se o `mobile/` rodar SEM `EXPO_PUBLIC_API_URL`, o `lib/api.ts` cai na
URL de PRODUÇÃO do Railway. Por isso use sempre `npm run dev` / `dev:mobile`
(eles definem a URL local). O `npm run start:railway` (em `mobile/`) existe
justamente pra conectar o dev build na API do Railway.
