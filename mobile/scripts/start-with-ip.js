// scripts/start-with-ip.js
//
// Detecta o IP Wi-Fi atual, injeta EXPO_PUBLIC_API_URL e inicia o Expo.
//
// Uso (via package.json):
//   npm run start:phone       -> Expo Go (celular físico, QR code)
//   npm run start:devclient   -> Development Build (APK de dev instalado)
//
// Passa flags extras direto pro expo, ex:
//   npm run start:phone -- --clear
//   npm run start:phone -- --port 8082   (se o Metro do Enfermaria já usa 8081)
//
// IMPORTANTE: como o pacote expo-dev-client está instalado, o `expo start`
// puro abre em modo "dev client" e o Expo Go não conecta. Por isso o modo
// Expo Go passa --go explicitamente.

const { spawn } = require('child_process');
const { syncApiIp } = require('./update-api-ip');

function startExpo() {
  const isWindows = process.platform === 'win32';
  const args = process.argv.slice(2);

  // --dev-client é consumido aqui só pra escolher o modo; o resto das
  // flags vai direto pro expo.
  const useDevClient = args.includes('--dev-client');
  const extraArgs = args.filter((arg) => arg !== '--dev-client');
  const modeArg = useDevClient ? '--dev-client' : '--go';

  console.log(
    useDevClient
      ? '🚀 Iniciando Expo (Development Build)...\n'
      : '🚀 Iniciando Expo (Expo Go)...\n',
  );

  const child = spawn('npx', ['expo', 'start', modeArg, ...extraArgs], {
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
