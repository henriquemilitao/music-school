// scripts/publish-update.js
//
// Publica uma atualização OTA (eas update) com a URL da API CERTA.
//
// Uso:
//   npm run update:preview      -> canal preview    + API de staging
//   npm run update:production   -> canal production + API de produção
//   npm run update:preview -- --message "texto"
//
// Por que existe: o `eas update` monta o pacote NA SUA MÁQUINA e lê os
// arquivos .env* da pasta mobile. Um .env de desenvolvimento (localhost ou
// IP da rede) acabava embutido no update e o app dos usuários deixava de
// conectar. Aqui os .env* saem do caminho durante a publicação e voltam
// sempre no final (mesmo com erro ou Ctrl+C).

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TARGETS = {
  preview: {
    channel: 'preview',
    apiUrl: 'https://music-school-staging.up.railway.app',
    variant: 'preview',
  },
  production: {
    channel: 'production',
    apiUrl: 'https://music-school-production-25a7.up.railway.app',
    variant: 'production',
  },
};

const BACKUP_SUFFIX = '.publish-bak';
const root = path.join(__dirname, '..');

const targetName = process.argv[2];
const target = TARGETS[targetName];
if (!target) {
  console.error('Uso: node scripts/publish-update.js <preview|production>');
  process.exit(1);
}

const rest = process.argv.slice(3);
const hasMessage = rest.includes('--message') || rest.includes('-m');
const extraArgs = hasMessage
  ? rest
  : ['--message', `update ${targetName}`, ...rest];

// Todo arquivo .env* que o Expo leria (ignora backups e exemplos).
function envFiles() {
  return fs
    .readdirSync(root)
    .filter(
      (name) =>
        name.startsWith('.env') &&
        !name.endsWith(BACKUP_SUFFIX) &&
        !name.endsWith('.example'),
    );
}

const moved = [];
function restore() {
  while (moved.length) {
    const name = moved.pop();
    const from = path.join(root, name + BACKUP_SUFFIX);
    if (fs.existsSync(from)) fs.renameSync(from, path.join(root, name));
  }
}
process.on('SIGINT', () => {
  restore();
  process.exit(130);
});
process.on('exit', restore);

for (const name of envFiles()) {
  fs.renameSync(path.join(root, name), path.join(root, name + BACKUP_SUFFIX));
  moved.push(name);
}

console.log(`\n📦 Publicando update`);
console.log(`   canal : ${target.channel}`);
console.log(`   API   : ${target.apiUrl}`);
if (moved.length) {
  console.log(`   (${moved.join(', ')} ficaram de lado durante a publicação)`);
}
console.log('');

const result = spawnSync(
  'npx',
  ['eas', 'update', '--channel', target.channel, ...extraArgs],
  {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      EXPO_PUBLIC_API_URL: target.apiUrl,
      APP_VARIANT: target.variant,
    },
  },
);

restore();
process.exit(result.status ?? 1);
