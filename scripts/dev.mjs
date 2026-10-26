// Sobe o ambiente de desenvolvimento do Pianíssima com UM comando.
//
//   npm run dev          banco + backend + Prisma Studio + app (Expo Go)
//   npm run dev:back     banco + backend + Prisma Studio (logs na tela)
//   npm run dev:mobile   só o app (o back já precisa estar rodando)
//
// Flags extras vão pro Expo:  npm run dev:mobile -- --clear
// Pra abrir em Development Build (em vez de Expo Go): ... -- --dev-client
import { spawn, spawnSync } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  API_PORT,
  METRO_PORT,
  STUDIO_PORT,
  ensurePortProxy,
  getLanIp,
  isPortBusy,
  isWsl,
} from "./lib/network.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BACK = resolve(ROOT, "backend");
const MOBILE = resolve(ROOT, "mobile");
const LOG_DIR = resolve(ROOT, ".logs");
const RESET = "\x1b[0m";

const SERVICES = [
  {
    name: "api",
    cwd: BACK,
    cmd: ["npm", "run", "start:dev"],
    env: { PORT: String(API_PORT) },
    color: "\x1b[32m",
  },
  {
    name: "studio",
    cwd: BACK,
    cmd: [
      "npx",
      "prisma",
      "studio",
      "--port",
      String(STUDIO_PORT),
      "--browser",
      "none",
    ],
    env: {},
    color: "\x1b[35m",
  },
];

const [mode = "all", ...extraArgs] = process.argv.slice(2);
if (!["all", "back", "mobile"].includes(mode)) {
  console.error("Uso: node scripts/dev.mjs [all|back|mobile] [flags do expo]");
  process.exit(1);
}
mkdirSync(LOG_DIR, { recursive: true });

const backChildren = [];
let mobileChild = null;

function stopBack() {
  for (const c of backChildren) {
    try {
      process.kill(-c.pid, "SIGTERM");
    } catch {
      /* já encerrou */
    }
  }
  backChildren.length = 0;
}
process.on("exit", stopBack);
process.on("SIGTERM", () => {
  stopBack();
  process.exit(0);
});
process.on("SIGINT", () => {
  stopBack();
  // com o Expo em primeiro plano, ele recebe o Ctrl+C e encerra sozinho
  if (!mobileChild) process.exit(0);
});

/** Roda um comando até o fim; se falhar, aborta tudo com a mensagem. */
function step(title, cmd, args, cwd = ROOT) {
  console.log(`▶ ${title}`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`✖ Falhou: ${title}`);
    process.exit(r.status ?? 1);
  }
}

/** Confere pré-requisitos e explica em português o que falta. */
function preflight() {
  const missing = [];
  if (!existsSync(resolve(ROOT, ".env")))
    missing.push(".env (raiz)  -> copie de .env.example e preencha");
  if (!existsSync(resolve(BACK, ".env")))
    missing.push("backend/.env  -> copie de backend/.env.example e preencha");
  if (missing.length) {
    console.error(
      "✖ Faltam arquivos de configuração:\n  - " + missing.join("\n  - "),
    );
    process.exit(1);
  }
}

async function checkPorts(ports) {
  const busy = [];
  for (const [name, port] of ports)
    if (await isPortBusy(port)) busy.push(`${name} (${port})`);
  if (busy.length) {
    console.error(
      `✖ Porta em uso: ${busy.join(", ")}.\n` +
        '  Tem outro projeto rodando (ex: Enfermaria) ou um "npm run dev" antigo?\n' +
        "  Pare com: npm run stop   (cuidado: derruba qualquer coisa nessas portas)\n" +
        "  Ou troque as portas: API_PORT=3001 METRO_PORT=8082 npm run dev",
    );
    process.exit(1);
  }
}

/** Instala dependências só se a pasta node_modules ainda não existir. */
function ensureDeps(dir, label) {
  if (existsSync(resolve(dir, "node_modules"))) return;
  step(`Instalando dependências (${label})`, "npm", ["install"], dir);
}

function startBack(toFile) {
  const out = toFile
    ? createWriteStream(resolve(LOG_DIR, "back.log"), { flags: "w" })
    : process.stdout;

  for (const { name, cwd, cmd, env, color } of SERVICES) {
    const [bin, ...args] = cmd;
    const child = spawn(bin, args, {
      cwd,
      env: { ...process.env, ...env },
      detached: true, // grupo próprio: dá para encerrar a árvore inteira
      stdio: ["ignore", "pipe", "pipe"],
    });
    backChildren.push(child);

    const tag = toFile ? `[${name}]` : `${color}[${name}]${RESET}`;
    for (const stream of [child.stdout, child.stderr]) {
      let buffer = "";
      stream.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) out.write(`${tag} ${line}\n`);
      });
    }
    child.on("exit", (code) => {
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

function startMobile() {
  const lanIp = getLanIp();
  const changed = ensurePortProxy();
  const apiUrl = `http://${lanIp}:${API_PORT}`;

  const lastIpFile = resolve(LOG_DIR, "last-ip");
  const ipChanged =
    !existsSync(lastIpFile) || readFileSync(lastIpFile, "utf8") !== lanIp;
  writeFileSync(lastIpFile, lanIp);

  console.log(
    `📶 IP da rede: ${lanIp}${ipChanged ? " (mudou, limpando cache)" : ""}${isWsl() ? " [WSL]" : ""}`,
  );
  if (changed) console.log("🔁 Port proxy atualizado");
  console.log(`📱 API: ${apiUrl}   Swagger: ${apiUrl}/api\n`);

  // O pacote expo-dev-client faz o "expo start" puro abrir em modo Dev
  // Client; pro Expo Go precisa do --go.
  const args = ["expo", "start"];
  if (!extraArgs.includes("--dev-client") && !extraArgs.includes("--go"))
    args.push("--go");
  if (ipChanged && !extraArgs.includes("--clear")) args.push("--clear");
  args.push("--port", String(METRO_PORT), ...extraArgs);

  mobileChild = spawn("npx", args, {
    cwd: MOBILE,
    stdio: "inherit", // mantém o QR code e as teclas do Expo
    env: {
      ...process.env,
      EXPO_PUBLIC_API_URL: apiUrl,
      REACT_NATIVE_PACKAGER_HOSTNAME: lanIp,
    },
  });
  mobileChild.on("exit", (code) => {
    stopBack();
    process.exit(code ?? 0);
  });
}

async function main() {
  if (mode !== "mobile") {
    preflight();
    await checkPorts([
      ["API", API_PORT],
      ["Prisma Studio", STUDIO_PORT],
      ...(mode === "all" ? [["Metro/Expo", METRO_PORT]] : []),
    ]);
    ensureDeps(BACK, "backend");
    step("Subindo o banco (Docker)", "docker", [
      "compose",
      "up",
      "-d",
      "--wait",
    ]);
    step("Gerando o Prisma Client", "npx", ["prisma", "generate"], BACK);
    step("Aplicando migrations", "npx", ["prisma", "migrate", "deploy"], BACK);
    startBack(mode === "all"); // no "all" os logs vão para .logs/back.log
    if (mode === "back") {
      console.log(
        '✅ Back rodando. Ctrl+C para parar (o banco continua; use "npm run stop").',
      );
      return;
    }
  } else {
    await checkPorts([["Metro/Expo", METRO_PORT]]);
  }

  ensureDeps(MOBILE, "mobile");
  if (mode === "all") {
    console.log("⏳ Aguardando a API...");
    const ok = await waitForApi();
    console.log(
      ok ? "✅ API no ar" : "⚠ API não respondeu em 90s. Veja: npm run logs",
    );
  }
  startMobile();
}

main().catch((e) => {
  console.error(`✖ ${e.message}`);
  stopBack();
  process.exit(1);
});
