// scripts/update-api-ip.js
//
// Módulo compartilhado: detecta o IPv4 do adaptador Wi-Fi e
// injeta EXPO_PUBLIC_API_URL no ambiente antes do Expo subir.
// Usado tanto pelo start-with-ip.js (Expo Go / celular) quanto
// pelo start-web-with-ip.js (modo --web).

const os = require('os');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = '3000';

// Adaptadores virtuais (Docker, WSL, VPN, VMs) têm IP que o celular não
// alcança — se um deles for escolhido, o QR code do Expo Go aponta pro
// lugar errado.
const VIRTUAL_ADAPTER =
  /docker|veth|br-|vethernet|vmware|virtualbox|vbox|hyper-v|tailscale|zerotier|loopback/i;

function getWifiIPv4() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs || VIRTUAL_ADAPTER.test(name)) continue;
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
  // Override manual: se você já definiu EXPO_PUBLIC_API_URL (ex: IP
  // detectado errado, ou usando ngrok), o script respeita e não mexe.
  // Ex: EXPO_PUBLIC_API_URL=http://192.168.1.90:3001 npm run start:phone
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log(
      `✅ EXPO_PUBLIC_API_URL já definido: ${process.env.EXPO_PUBLIC_API_URL}`,
    );
    try {
      return new URL(process.env.EXPO_PUBLIC_API_URL).hostname;
    } catch {
      return null;
    }
  }

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

  // O Expo dá prioridade a arquivos .env* sobre a variável de ambiente; este
  // arquivo (ignorado pelo Git) vence qualquer mobile/.env antigo.
  fs.writeFileSync(
    path.join(__dirname, '..', '.env.development.local'),
    `EXPO_PUBLIC_API_URL=${apiUrl}\n`,
  );

  // Faz o Metro anunciar o mesmo IP no QR code do Expo Go. Sem isso, com
  // WSL/Docker/VPN o Metro pode anunciar um IP que o celular não alcança.
  if (!process.env.REACT_NATIVE_PACKAGER_HOSTNAME) {
    process.env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
  }

  console.log(`📶 IP Wi-Fi detectado: ${ip}`);
  console.log(`✅ EXPO_PUBLIC_API_URL definido: ${apiUrl}`);

  return ip;
}

module.exports = { syncApiIp, getWifiIPv4 };
