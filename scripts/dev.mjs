// Sobe o ambiente de desenvolvimento do Pianíssima com UM comando.
//
//   npm run dev          banco + backend + Prisma Studio + app (Expo Go)
//   npm run dev:back     banco + backend + Prisma Studio (logs na tela)
//   npm run dev:mobile   só o app (o back já precisa estar rodando)
//
// Flags extras vão pro Expo:  npm run dev:mobile -- --clear
// Pra abrir em Development Build (em vez de Expo Go): ... -- --dev-client
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  API_PORT,
  METRO_PORT,
  STUDIO_PORT,
  ensurePortProxy,
  getLanIp,
  isPortBusy,
  isWsl,
} from './lib/network.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BACK = resolve(ROOT, 'backend');
const MOBILE = resolve(ROOT, 'mobile');
const LOG_DIR = resolve(ROOT, '.logs');
const RESET = '\x1b[0m';

const SERVICES = [
  {
    name: 'api',
    cwd: BACK,
    cmd: ['npm', 'run', 'start:dev'],
    env: { PORT: String(API_PORT) },
    color: '\x1b[32m',
  },
  {
    name: 'studio',
    cwd: BACK,
    cmd: [
      'npx',
      'prisma',
      'studio',
      '--port',
      String(STUDIO_PORT),
      '--browser',
      'none',
    ],
    env: {},
    color: '\x1b[35m',
  },
];

const [mode = 'all', ...extraArgs] = process.argv.slice(2);
if (!['all', 'back', 'mobile'].includes(mode)) {
  console.error('Uso: node scripts/dev.mjs [all|back|mobile] [flags do expo]');
  process.exit(1);
}
mkdirSync(LOG_DIR, { recursive: true });

const backChildren = [];
let mobileChild = null;

function stopBack() {
  for (const c of backChildren) {
    try {
      process.kill(-c.pid, 'SIGTERM');
    } catch {
      /* já encerrou */
    }
  }
  backChildren.length = 0;
}
process.on('exit', stopBack);
process.on('SIGTERM', () => {
  stopBack();
  process.exit(0);
});
process.on('SIGINT', () => {
  stopBack();
  // com o Expo em primeiro plano, ele recebe o Ctrl+C e encerra sozinho
  if (!mobileChild) process.exit(0);
});

/** Roda um comando até o fim; se falhar, aborta tudo com a mensagem. */
function step(title, cmd, args, cwd = ROOT, onFail) {
  console.log(`▶ ${title}`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`✖ Falhou: ${title}`);
    onFail?.();
    process.exit(r.status ?? 1);
  }
}

/** Lê um arquivo .env simples (CHAVE=valor) sem mostrar nada na tela. */
function readEnv(file) {
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

/** Confere pré-requisitos e explica em português o que falta. */
function preflight() {
  const missing = [];
  if (!existsSync(resolve(ROOT, '.env')))
    missing.push('.env (raiz)  -> copie de .env.example e preencha');
  if (!existsSync(resolve(BACK, '.env')))
    missing.push('backend/.env  -> copie de backend/.env.example e preencha');
  if (missing.length) {
    console.error(
      '✖ Faltam arquivos de configuração:\n  - ' + missing.join('\n  - '),
    );
    process.exit(1);
  }

  // O Postgres do Docker recusa subir (o container "sai com código 1") se
  // usuário/senha/banco estiverem vazios no .env da raiz.
  const root = readEnv(resolve(ROOT, '.env'));
  const empty = ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'].filter(
    (k) => !root[k],
  );
  if (empty.length) {
    console.error(
      `✖ No .env da raiz estão vazios ou ausentes: ${empty.join(', ')}.\n` +
        '  Preencha (veja .env.example) e use os mesmos dados no DATABASE_URL do backend/.env.',
    );
    process.exit(1);
  }
  if (!readEnv(resolve(BACK, '.env')).DATABASE_URL) {
    console.error('✖ DATABASE_URL está vazio no backend/.env.');
    process.exit(1);
  }
}

async function checkPorts(ports) {
  const busy = [];
  for (const [name, port] of ports)
    if (await isPortBusy(port)) busy.push(`${name} (${port})`);
  if (busy.length) {
    console.error(
      `✖ Porta em uso: ${busy.join(', ')}.\n` +
        '  Tem outro projeto rodando (ex: Enfermaria) ou um "npm run dev" antigo?\n' +
        '  Pare com: npm run stop   (cuidado: derruba qualquer coisa nessas portas)\n' +
        '  Ou troque as portas: API_PORT=3001 METRO_PORT=8082 npm run dev',
    );
    process.exit(1);
  }
}

/**
 * Instala dependências quando a pasta node_modules não existe OU quando o
 * package-lock.json mudou desde a última instalação feita por este script
 * (ex: você trocou de branch e entrou uma dependência nova).
 */
function ensureDeps(dir, label) {
  const lockFile = resolve(dir, 'package-lock.json');
  const stampFile = resolve(LOG_DIR, `deps-${label}.hash`);
  const hashLock = () =>
    existsSync(lockFile)
      ? createHash('sha1').update(readFileSync(lockFile)).digest('hex')
      : '';
  const lockHash = hashLock();
  const lastHash = existsSync(stampFile)
    ? readFileSync(stampFile, 'utf8')
    : null;
  const installed = existsSync(resolve(dir, 'node_modules'));

  // Sem registro anterior (primeira vez) também instala: num projeto já em
  // dia o `npm install` termina em poucos segundos.
  if (installed && lastHash === lockHash) return;

  step(`Instalando dependências (${label})`, 'npm', ['install'], dir);
  // o npm pode reescrever o lock; registra o hash de DEPOIS da instalação
  writeFileSync(stampFile, hashLock());
}

function startBack(toFile) {
  const out = toFile
    ? createWriteStream(resolve(LOG_DIR, 'back.log'), { flags: 'w' })
    : process.stdout;

  for (const { name, cwd, cmd, env, color } of SERVICES) {
    const [bin, ...args] = cmd;
    const child = spawn(bin, args, {
      cwd,
      env: { ...process.env, ...env },
      detached: true, // grupo próprio: dá para encerrar a árvore inteira
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    backChildren.push(child);

    const tag = toFile ? `[${name}]` : `${color}[${name}]${RESET}`;
    for (const stream of [child.stdout, child.stderr]) {
      let buffer = '';
      stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) out.write(`${tag} ${line}\n`);
      });
    }
    child.on('exit', (code) => {
      if (code) console.error(`⚠ ${name} encerrou com código ${code}`);
    });
  }
}

/** Considera a API no ar quando ela responde qualquer coisa em "/". */
async function waitForApi(timeoutMs = 90_000) {
  const url = `http://127.0.0.1:${API_PORT}/`;
  const limit = Date.now() + timeoutMs;
  while (Date.now() < limit) {
    try {
      await fetch(url);
      return true;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Garante que o app use a URL da API calculada agora.
 *
 * O Expo monta o ambiente do app juntando process.env e DEPOIS os arquivos
 * .env, .env.development, .env.local e .env.development.local (o último
 * vence). Ou seja: um mobile/.env antigo (ex: com localhost) ganha da
 * variável de ambiente deste script, e no celular "localhost" é o próprio
 * celular. Por isso geramos o .env.development.local (ignorado pelo Git),
 * que tem a maior prioridade.
 */
function pinApiUrl(apiUrl) {
  writeFileSync(
    resolve(MOBILE, '.env.development.local'),
    `# GERADO por "npm run dev" a cada execução — não edite (está no .gitignore)\nEXPO_PUBLIC_API_URL=${apiUrl}\n`,
  );

  for (const name of ['.env', '.env.local', '.env.development']) {
    const file = resolve(MOBILE, name);
    if (!existsSync(file)) continue;
    const found = readEnv(file).EXPO_PUBLIC_API_URL;
    if (found && found !== apiUrl) {
      console.log(
        `⚠ mobile/${name} define EXPO_PUBLIC_API_URL=${found}.\n` +
          '  Está sendo sobrescrito pelo .env.development.local (gerado). Pode apagar essa linha.',
      );
    }
  }
}

function startMobile() {
  const lanIp = getLanIp();
  const changed = ensurePortProxy();
  const apiUrl = `http://${lanIp}:${API_PORT}`;
  pinApiUrl(apiUrl);

  const lastIpFile = resolve(LOG_DIR, 'last-ip');
  const ipChanged =
    !existsSync(lastIpFile) || readFileSync(lastIpFile, 'utf8') !== lanIp;
  writeFileSync(lastIpFile, lanIp);

  console.log(
    `📶 IP da rede: ${lanIp}${ipChanged ? ' (mudou, limpando cache)' : ''}${isWsl() ? ' [WSL]' : ''}`,
  );
  if (changed) console.log('🔁 Port proxy atualizado');
  console.log(`📱 API: ${apiUrl}   Swagger: ${apiUrl}/api\n`);

  // O pacote expo-dev-client faz o "expo start" puro abrir em modo Dev
  // Client; pro Expo Go precisa do --go.
  const args = ['expo', 'start'];
  if (!extraArgs.includes('--dev-client') && !extraArgs.includes('--go'))
    args.push('--go');
  if (ipChanged && !extraArgs.includes('--clear')) args.push('--clear');
  args.push('--port', String(METRO_PORT), ...extraArgs);

  mobileChild = spawn('npx', args, {
    cwd: MOBILE,
    stdio: 'inherit', // mantém o QR code e as teclas do Expo
    env: {
      ...process.env,
      EXPO_PUBLIC_API_URL: apiUrl,
      REACT_NATIVE_PACKAGER_HOSTNAME: lanIp,
    },
  });
  mobileChild.on('exit', (code) => {
    stopBack();
    process.exit(code ?? 0);
  });
}

async function main() {
  if (mode !== 'mobile') {
    preflight();
    await checkPorts([
      ['API', API_PORT],
      ['Prisma Studio', STUDIO_PORT],
      ...(mode === 'all' ? [['Metro/Expo', METRO_PORT]] : []),
    ]);
    ensureDeps(BACK, 'backend');
    step(
      'Subindo o banco (Docker)',
      'docker',
      ['compose', 'up', '-d', '--wait'],
      ROOT,
      () => {
        console.error('\n--- últimas linhas do log do banco ---');
        spawnSync('docker', ['compose', 'logs', 'db', '--tail', '20'], {
          cwd: ROOT,
          stdio: 'inherit',
        });
        console.error(
          '--------------------------------------\n' +
            'Causas comuns: senha/usuário/banco vazios no .env da raiz; volume antigo\n' +
            'criado com outra senha (apague com: docker compose down -v — APAGA os dados\n' +
            'locais do banco); porta 5432 ocupada (defina DB_PORT=5433 no .env).',
        );
      },
    );
    step('Gerando o Prisma Client', 'npx', ['prisma', 'generate'], BACK);
    step('Aplicando migrations', 'npx', ['prisma', 'migrate', 'deploy'], BACK);
    startBack(mode === 'all'); // no "all" os logs vão para .logs/back.log
    if (mode === 'back') {
      console.log(
        '✅ Back rodando. Ctrl+C para parar (o banco continua; use "npm run stop").',
      );
      return;
    }
  } else {
    await checkPorts([['Metro/Expo', METRO_PORT]]);
  }

  ensureDeps(MOBILE, 'mobile');
  if (mode === 'all') {
    console.log('⏳ Aguardando a API...');
    const ok = await waitForApi();
    console.log(
      ok ? '✅ API no ar' : '⚠ API não respondeu em 90s. Veja: npm run logs',
    );
  }
  startMobile();
}

main().catch((e) => {
  console.error(`✖ ${e.message}`);
  stopBack();
  process.exit(1);
});
