// scripts/start-with-ip.js
//
// Atualiza lib/api.ts com o IP Wi-Fi atual e inicia o Expo no modo
// padrão (QR code pro Expo Go, uso via celular físico).
//
// Uso (via package.json):
//   npm run start:phone
//
// Passa flags extras direto pro expo, ex:
//   npm run start:phone -- --clear

const { spawn } = require('child_process');
const { syncApiIp } = require('./update-api-ip');

function startExpo() {
  const extraArgs = process.argv.slice(2);
  const isWindows = process.platform === 'win32';

  console.log('🚀 Iniciando Expo (Dev Client)...\n');

  const child = spawn('npx', ['expo', 'start', '--dev-client', ...extraArgs], {
    stdio: 'inherit',
    shell: isWindows,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

function main() {
  syncApiIp();
  startExpo();
}

main();
