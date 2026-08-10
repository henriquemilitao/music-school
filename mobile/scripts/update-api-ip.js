// scripts/update-api-ip.js
//
// Módulo compartilhado: detecta o IPv4 do adaptador Wi-Fi e
// injeta EXPO_PUBLIC_API_URL no ambiente antes do Expo subir.
// Usado tanto pelo start-with-ip.js (Expo Go / celular) quanto
// pelo start-web-with-ip.js (modo --web).

const os = require('os');

const DEFAULT_PORT = '3000';

function getWifiIPv4() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (
        addr.family === 'IPv4' &&
        !addr.internal &&
        !addr.address.startsWith('169.254.')
      ) {
        candidates.push({ name, address: addr.address });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Prefere explicitamente algo com "Wi-Fi" no nome da interface;
  // ignora de propósito qualquer coisa com "WSL" no nome mesmo que
  // contenha "Wi-Fi" em algum lugar (não deveria, mas por segurança).
  const wifiMatch = candidates.find(
    (c) => /wi-?fi/i.test(c.name) && !/wsl/i.test(c.name),
  );
  if (wifiMatch) return wifiMatch.address;

  return candidates[0].address;
}

// Detecta o IP e seta EXPO_PUBLIC_API_URL no ambiente do processo
// atual. Como o Expo é spawnado como filho desse processo, ele
// herda essa env var e o Metro embute o valor no bundle.
function syncApiIp() {
  const ip = getWifiIPv4();

  if (!ip) {
    console.error(
      'ERRO: não consegui detectar um IP de Wi-Fi ativo. Confirme que o Wi-Fi está conectado.',
    );
    process.exit(1);
  }

  const port = process.env.EXPO_PUBLIC_API_PORT || DEFAULT_PORT;
  const apiUrl = `http://${ip}:${port}`;

  process.env.EXPO_PUBLIC_API_URL = apiUrl;

  console.log(`📶 IP Wi-Fi detectado: ${ip}`);
  console.log(`✅ EXPO_PUBLIC_API_URL definido: ${apiUrl}`);

  return ip;
}

module.exports = { syncApiIp, getWifiIPv4 };