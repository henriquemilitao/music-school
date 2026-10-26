// Rede para rodar o app no celular (Expo Go) quando o dev roda DENTRO do WSL.
//
// O celular só enxerga o IP do Windows, não o do WSL. Por isso:
//   1. descobrimos o IP do Windows na rede Wi-Fi (é ele que vai no QR code
//      e na URL da API);
//   2. criamos um "port proxy" no Windows: Windows:3000/8081 -> WSL:3000/8081
//      (só pede administrador/UAC quando o IP do WSL muda).
//
// Fora do WSL (Linux/macOS puros) nada disso é necessário: usamos o IP da
// própria máquina.
import { execFileSync } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';

// Mesmas portas padrão do Enfermaria — assim o port proxy e a regra do
// firewall que já existem no Windows continuam valendo. Dá pra trocar:
//   API_PORT=3001 METRO_PORT=8082 npm run dev
export const API_PORT = Number(process.env.API_PORT ?? 3000);
export const METRO_PORT = Number(process.env.METRO_PORT ?? 8081);
export const STUDIO_PORT = Number(process.env.STUDIO_PORT ?? 5555);
const PROXY_PORTS = [API_PORT, METRO_PORT];

const DEFAULT_PORTS = API_PORT === 3000 && METRO_PORT === 8081;
const RULE_NAME = DEFAULT_PORTS
  ? 'WSL Expo e API'
  : `WSL Expo e API (${PROXY_PORTS.join(',')})`;

export const isWsl = () =>
  process.platform === 'linux' && /microsoft/i.test(os.release());

const powershell = (script) =>
  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();

/** IP do Windows na rede com rota de internet ativa (Wi-Fi, cabo ou hotspot). */
function getWindowsLanIp() {
  const ip = powershell(`
    $ErrorActionPreference = 'SilentlyContinue'
    $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' |
      Where-Object { $_.NextHop -ne '0.0.0.0' } |
      Sort-Object { $_.RouteMetric + (Get-NetIPInterface -InterfaceIndex $_.InterfaceIndex -AddressFamily IPv4).InterfaceMetric } |
      Select-Object -First 1
    $ip = $null
    if ($route) {
      $ip = (Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 | Select-Object -First 1).IPAddress
    }
    if (-not $ip) {
      $ip = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.InterfaceAlias -notmatch 'vEthernet|WSL|Loopback|Bluetooth' -and $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1' } |
        Select-Object -First 1).IPAddress
    }
    $ip
  `);
  return ip;
}

/** IPv4 da própria máquina, ignorando adaptadores virtuais (Docker, VPN...). */
function getLocalLanIp() {
  const virtual =
    /docker|veth|br-|vmware|virtualbox|vbox|hyper-v|tailscale|zerotier|loopback/i;
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (virtual.test(name)) continue;
    const a = addrs?.find(
      (x) =>
        (x.family === 'IPv4' || x.family === 4) &&
        !x.internal &&
        !x.address.startsWith('169.254.'),
    );
    if (a) return a.address;
  }
  return null;
}

/** IP que o celular deve usar pra falar com este computador. */
export function getLanIp() {
  if (process.env.LAN_IP) return process.env.LAN_IP;

  const ip = isWsl() ? getWindowsLanIp() : getLocalLanIp();
  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    throw new Error(
      'Não consegui detectar o IP da rede. Informe manualmente: LAN_IP=192.168.x.x npm run dev',
    );
  }
  return ip;
}

/** IP interno do WSL (eth0). null no modo "mirrored", onde não existe eth0. */
function getWslIp() {
  const addr = os
    .networkInterfaces()
    .eth0?.find((a) => a.family === 'IPv4' || a.family === 4);
  return addr?.address ?? null;
}

function portProxyOk(wslIp) {
  try {
    const out = execFileSync(
      'netsh.exe',
      ['interface', 'portproxy', 'show', 'v4tov4'],
      { encoding: 'utf8' },
    );
    const ip = wslIp.replaceAll('.', '\\.');
    return PROXY_PORTS.every((p) =>
      new RegExp(`0\\.0\\.0\\.0\\s+${p}\\s+${ip}\\s+${p}`).test(out),
    );
  } catch {
    return false;
  }
}

/**
 * Garante Windows:API/METRO -> WSL. Só pede administrador se precisar mudar.
 * Retorna true se mexeu na configuração. Fora do WSL (ou em modo mirrored)
 * não faz nada.
 */
export function ensurePortProxy() {
  if (!isWsl()) return false;
  const wslIp = getWslIp();
  if (!wslIp) return false; // mirrored: Windows e WSL compartilham a rede
  if (portProxyOk(wslIp)) return false;

  console.log(
    '🔐 O IP do WSL mudou. Confirme a janela de administrador do Windows (UAC)...',
  );
  const inner = `
    foreach ($p in ${PROXY_PORTS.join(',')}) {
      netsh interface portproxy delete v4tov4 listenport=$p listenaddress=0.0.0.0 | Out-Null
      netsh interface portproxy add v4tov4 listenport=$p listenaddress=0.0.0.0 connectport=$p connectaddress=${wslIp}
    }
    if (-not (Get-NetFirewallRule -DisplayName '${RULE_NAME}' -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName '${RULE_NAME}' -Direction Inbound -Action Allow -Protocol TCP -LocalPort ${PROXY_PORTS.join(',')} -Profile Private,Public | Out-Null
    }
  `;
  const encoded = Buffer.from(inner, 'utf16le').toString('base64');
  try {
    powershell(
      `Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-EncodedCommand','${encoded}'`,
    );
  } catch {
    // usuário cancelou o UAC; a verificação abaixo avisa
  }

  if (!portProxyOk(wslIp)) {
    throw new Error(
      'Port proxy não foi configurado (UAC cancelado?). Rode o comando de novo e aceite a janela.',
    );
  }
  return true;
}

/** true se alguém já está escutando nessa porta (ex: Enfermaria rodando). */
export function isPortBusy(port) {
  return new Promise((resolve) => {
    const server = net
      .createServer()
      .once('error', (err) => resolve(err.code === 'EADDRINUSE'))
      .once('listening', () => server.close(() => resolve(false)));
    server.listen(port, '0.0.0.0');
  });
}
