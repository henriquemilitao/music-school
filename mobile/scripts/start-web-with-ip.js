// scripts/start-web-with-ip.js
//
// Atualiza lib/api.ts com o IP Wi-Fi atual e inicia o Expo no modo
// --web. Útil tanto pra rodar local no PC quanto pra abrir a versão
// web pelo navegador do celular (usando o IP mostrado no terminal).
//
// Uso (via package.json):
//   npm run start:web
//
// Passa flags extras direto pro expo, ex:
//   npm run start:web -- --clear

const { spawn } = require('child_process');
const { syncApiIp } = require('./update-api-ip');

function startExpoWeb(ip) {
  const extraArgs = process.argv.slice(2);
  const isWindows = process.platform === 'win32';

  console.log('🚀 Iniciando Expo (modo Web)...');
  console.log(`   Acesso local:        http://localhost:8081`);
  console.log(`   Acesso pela rede:    http://${ip}:8081\n`);

  const child = spawn('npx', ['expo', 'start', '--web', ...extraArgs], {
    stdio: 'inherit',
    shell: isWindows,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

function main() {
  const ip = syncApiIp();
  startExpoWeb(ip);
}

main();