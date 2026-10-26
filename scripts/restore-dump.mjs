// Restaura um dump do Postgres (ex: backups/prod.dump) no banco LOCAL do
// Docker e limpa os dados sensíveis, pro app local ficar parecido com a
// produção sem risco de mandar e-mail/push/cobrança de verdade.
//
//   npm run db:restore                          # usa backups/prod.dump
//   npm run db:restore -- backups/outro.dump
//   npm run db:restore -- --yes                 # não pergunta confirmação
//   npm run db:restore -- --anon-names          # também anonimiza nomes/notas
//   DEV_PASSWORD=outra npm run db:restore       # senha de dev (padrão: senha123)
//
// ATENÇÃO: APAGA todo o conteúdo do banco local antes de restaurar.
import { spawn, spawnSync } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  closeSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BACK = resolve(ROOT, 'backend');

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const dumpArg = args.find((a) => !a.startsWith('--')) ?? 'backups/prod.dump';
const dumpPath = resolve(process.cwd(), dumpArg);
const DEV_PASSWORD = process.env.DEV_PASSWORD ?? 'senha123';

const fail = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};

function readEnv(file) {
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

/** docker compose exec no container do banco; input = arquivo ou texto pro stdin. */
function dbExec(cmdArgs, { file, text } = {}) {
  return new Promise((res) => {
    const child = spawn('docker', ['compose', 'exec', '-T', 'db', ...cmdArgs], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => res({ code, stdout, stderr }));
    if (file) createReadStream(file).pipe(child.stdin);
    else child.stdin.end(text ?? '');
  });
}

async function main() {
  if (!existsSync(dumpPath)) fail(`Dump não encontrado: ${dumpPath}`);
  if (!existsSync(resolve(ROOT, '.env')))
    fail('Falta o .env da raiz (veja .env.example).');
  const { POSTGRES_USER: user, POSTGRES_DB: db } = readEnv(
    resolve(ROOT, '.env'),
  );
  if (!user || !db) fail('POSTGRES_USER/POSTGRES_DB vazios no .env da raiz.');

  // formato: custom (pg_dump -Fc) começa com "PGDMP"; senão é SQL puro
  const fd = openSync(dumpPath, 'r');
  const head = Buffer.alloc(5);
  readSync(fd, head, 0, 5, 0);
  closeSync(fd);
  const isCustom = head.toString() === 'PGDMP';

  console.log(`▶ Subindo o banco (Docker)`);
  if (
    spawnSync('docker', ['compose', 'up', '-d', '--wait'], {
      cwd: ROOT,
      stdio: 'inherit',
    }).status !== 0
  )
    fail(
      'Não consegui subir o banco. Rode "npm run dev:back" ou veja "docker compose logs db".',
    );

  if (isCustom) {
    const list = await dbExec(['pg_restore', '-l'], { file: dumpPath });
    if (list.code !== 0) {
      fail(
        `O pg_restore do container não leu o dump:\n${list.stderr.trim()}\n\n` +
          'Se for "unsupported version", o dump foi feito por um Postgres mais novo que o do\n' +
          'container. Use a mesma versão da produção: POSTGRES_IMAGE_TAG=17-alpine no .env da\n' +
          'raiz (troque pelo número da versão) e rode "docker compose down -v" antes.',
      );
    }
    const info = list.stdout
      .split('\n')
      .filter((l) =>
        /^;\s+(Dumped|Archive created|Format|Compression)/.test(l),
      );
    console.log(info.map((l) => `   ${l.replace(/^;\s+/, '')}`).join('\n'));
  }

  if (!flags.has('--yes')) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await rl.question(
      `\n⚠ Isso APAGA todo o banco local "${db}" e restaura ${dumpArg}.\n  Digite "sim" para continuar: `,
    );
    rl.close();
    if (answer.trim().toLowerCase() !== 'sim') fail('Cancelado.');
  }

  const psql = ['psql', '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1'];

  console.log('▶ Limpando o banco local');
  let r = await dbExec([
    ...psql,
    '-c',
    'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;',
  ]);
  if (r.code !== 0) fail(`Não consegui limpar o schema:\n${r.stderr.trim()}`);

  console.log('▶ Restaurando o dump (pode levar um pouco)');
  r = isCustom
    ? await dbExec(
        ['pg_restore', '-U', user, '-d', db, '--no-owner', '--no-privileges'],
        { file: dumpPath },
      )
    : await dbExec([...psql, '-q'], { file: dumpPath });
  if (r.stderr.trim()) {
    // pg_restore devolve código != 0 por avisos inofensivos (ex: schema public já existe)
    console.log('   avisos do restore (últimas linhas):');
    console.log(
      r.stderr
        .trim()
        .split('\n')
        .slice(-8)
        .map((l) => `   ${l}`)
        .join('\n'),
    );
  }
  const check = await dbExec([
    ...psql,
    '-tA',
    '-c',
    'SELECT count(*) FROM users',
  ]);
  if (check.code !== 0)
    fail('O restore não criou a tabela "users" — o dump é desse projeto?');
  console.log(`   usuários restaurados: ${check.stdout.trim()}`);

  console.log(
    '▶ Limpando dados sensíveis (e-mails, telefones, push, Pix, senhas)',
  );
  let hash;
  try {
    hash = createRequire(resolve(BACK, 'package.json'))('bcrypt').hashSync(
      DEV_PASSWORD,
      10,
    );
  } catch {
    fail(
      'Não achei o bcrypt do backend. Rode "npm run setup" e tente de novo.',
    );
  }
  const sql = (f) => readFileSync(resolve(ROOT, 'scripts/sql', f), 'utf8');
  r = await dbExec([...psql, '-v', `pwd=${hash}`, '-q'], {
    text: sql('sanitize-dev.sql'),
  });
  if (r.code !== 0) fail(`Falhou ao limpar os dados:\n${r.stderr.trim()}`);
  if (flags.has('--anon-names')) {
    r = await dbExec([...psql, '-q'], { text: sql('anonymize-names.sql') });
    if (r.code !== 0) fail(`Falhou ao anonimizar nomes:\n${r.stderr.trim()}`);
  }

  console.log('▶ Aplicando migrations que a produção ainda não tem');
  if (
    spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: BACK,
      stdio: 'inherit',
    }).status !== 0
  )
    fail('prisma migrate deploy falhou (veja a mensagem acima).');

  const admins = await dbExec([
    ...psql,
    '-tA',
    '-c',
    `SELECT email FROM users WHERE role = 'ADMIN' ORDER BY email`,
  ]);
  console.log(
    `\n✅ Banco local restaurado.\n` +
      `   Senha de TODOS os usuários: ${DEV_PASSWORD}\n` +
      `   Admins (e-mail original mantido):\n${admins.stdout
        .trim()
        .split('\n')
        .map((e) => `     - ${e}`)
        .join('\n')}\n` +
      `   Demais e-mails viraram user-<id>@example.com; sem telefone, push token nem Pix.`,
  );
}

main().catch((e) => fail(e.message));
