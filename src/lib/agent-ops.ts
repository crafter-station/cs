import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const AGENTS_DIR = join(homedir(), ".claude", "agents");
const EXECUTOR_DIR = join(homedir(), ".kai-executor");
const WORKSPACES_DIR = join(homedir(), "kai-workspaces");

export interface AgentInfo {
  name: string;
  displayName: string;
  pillar: string;
  model: string;
  keywords: string[];
  github: boolean;
  description: string;
}

function parseYamlValue(raw: string): string {
  return raw.replace(/^["']|["']$/g, "").trim();
}

function parseAgentMd(filePath: string): AgentInfo | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const fm = fmMatch[1];

    const get = (key: string): string => {
      const multiline = fm.match(new RegExp(`^${key}:\\s*>\\s*\\n([\\s\\S]*?)(?=\\n\\w|$)`, "m"));
      if (multiline) return multiline[1].replace(/\n\s+/g, " ").trim();
      const single = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
      return single ? parseYamlValue(single[1]) : "";
    };

    const name = get("name");
    if (!name || name === "ts-coder") return null;

    const kaiMatch = fm.match(/^kai:\s*\n((?:\s+\S.*\n?)*)/m);
    const kaiBlock = kaiMatch ? kaiMatch[1] : "";

    const getKai = (key: string): string => {
      const match = kaiBlock.match(new RegExp(`^\\s+${key}:\\s*(.+)$`, "m"));
      return match ? parseYamlValue(match[1]) : "";
    };

    const keywordsMatch = kaiBlock.match(/^\s+keywords:\s*\n((?:\s+-\s+.+\n?)*)/m);
    const keywords = keywordsMatch
      ? keywordsMatch[1].split("\n").map((l) => l.replace(/^\s+-\s+/, "").trim()).filter(Boolean).map((v) => parseYamlValue(v))
      : [];

    return {
      name,
      displayName: getKai("displayName") || `[${name}]`,
      pillar: getKai("pillar") || "",
      model: get("model") || "sonnet",
      keywords,
      github: getKai("github") === "true",
      description: get("description"),
    };
  } catch {
    return null;
  }
}

export function listAgents(): AgentInfo[] {
  if (!existsSync(AGENTS_DIR)) return [];

  return readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parseAgentMd(join(AGENTS_DIR, f)))
    .filter((a): a is AgentInfo => a !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getAgentInfo(name: string): AgentInfo | null {
  const path = join(AGENTS_DIR, `${name}.md`);
  if (!existsSync(path)) return null;
  return parseAgentMd(path);
}

export interface ExecutorConfig {
  memberId: string;
  secret: string;
  centralUrl: string;
  workspacesRoot: string;
  kaiRepoPath?: string;
}

export function getExecutorConfig(): ExecutorConfig | null {
  const configPath = join(EXECUTOR_DIR, "config.json");
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

export function saveExecutorConfig(config: ExecutorConfig) {
  if (!existsSync(EXECUTOR_DIR)) {
    mkdirSync(EXECUTOR_DIR, { recursive: true });
  }
  writeFileSync(join(EXECUTOR_DIR, "config.json"), JSON.stringify(config, null, 2));
}

export function getDaemonScriptPath(): string | null {
  const config = getExecutorConfig();
  if (config?.kaiRepoPath) {
    const p = join(config.kaiRepoPath, "packages/executor/daemon.ts");
    if (existsSync(p)) return p;
  }
  const defaultPath = join(homedir(), "Programming/crafter-station/kai/packages/executor/daemon.ts");
  if (existsSync(defaultPath)) return defaultPath;
  return null;
}

export function ensureWorkspacesDir() {
  if (!existsSync(WORKSPACES_DIR)) {
    mkdirSync(WORKSPACES_DIR, { recursive: true });
  }
}

export function isExecutorInstalled(): boolean {
  return existsSync(join(EXECUTOR_DIR, "config.json"));
}

const PLIST_NAME = "com.crafter.kai-executor";
const PLIST_PATH = join(homedir(), "Library", "LaunchAgents", `${PLIST_NAME}.plist`);

export function generateLaunchdPlist(args: string[]): string {
  const argsXml = args.map((a) => `    <string>${a}</string>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_NAME}</string>
  <key>ProgramArguments</key>
  <array>
${argsXml}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${join(EXECUTOR_DIR, "stdout.log")}</string>
  <key>StandardErrorPath</key>
  <string>${join(EXECUTOR_DIR, "stderr.log")}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:${join(homedir(), ".local/bin")}</string>
  </dict>
</dict>
</plist>`;
}

export function installLaunchdAgent(args: string[]) {
  const plist = generateLaunchdPlist(args);
  writeFileSync(PLIST_PATH, plist);
}

export function getLaunchdPlistPath(): string {
  return PLIST_PATH;
}

export function isLaunchdInstalled(): boolean {
  return existsSync(PLIST_PATH);
}

export interface DoctorCheck {
  label: string;
  status: "pass" | "fail" | "warn";
  detail?: string;
  fix?: () => void;
}

export function runDoctorChecks(): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const { execSync } = require("node:child_process");

  for (const cmd of ["bun", "claude", "gh", "git"]) {
    try {
      const path = execSync(`which ${cmd}`, { encoding: "utf-8" }).trim();
      checks.push({ label: cmd, status: "pass", detail: path });
    } catch {
      checks.push({ label: cmd, status: "fail", detail: "not found" });
    }
  }

  const config = getExecutorConfig();
  if (config) {
    checks.push({ label: "Config", status: "pass", detail: join(EXECUTOR_DIR, "config.json") });
    checks.push(
      config.memberId
        ? { label: "Member", status: "pass", detail: config.memberId }
        : { label: "Member", status: "fail", detail: "missing from config" }
    );
    checks.push(
      config.secret
        ? { label: "Secret", status: "pass", detail: `configured (${config.secret.length} chars)` }
        : { label: "Secret", status: "fail", detail: "missing from config" }
    );
    checks.push(
      config.centralUrl
        ? { label: "Central URL", status: "pass", detail: config.centralUrl }
        : { label: "Central URL", status: "fail", detail: "missing from config" }
    );
  } else {
    checks.push({ label: "Config", status: "fail", detail: "not found — run: crafters agent setup" });
  }

  const agents = listAgents();
  if (agents.length >= 9) {
    checks.push({ label: "Agents", status: "pass", detail: `${agents.length} installed` });
  } else if (agents.length > 0) {
    checks.push({
      label: "Agents",
      status: "warn",
      detail: `${agents.length} installed (expected 9) — run: crafters claude update`,
    });
  } else {
    checks.push({
      label: "Agents",
      status: "fail",
      detail: "none installed — run: crafters claude update",
    });
  }

  if (isLaunchdInstalled()) {
    checks.push({ label: "Plist", status: "pass", detail: PLIST_PATH });
  } else {
    checks.push({
      label: "Plist",
      status: "fail",
      detail: "not installed — run: crafters agent install-daemon",
      fix: () => {
        try {
          const bunPath = execSync("which bun", { encoding: "utf-8" }).trim();
          const scriptPath = join(homedir(), "Programming/crafter-station/kai/packages/executor/daemon.ts");
          installLaunchdAgent([bunPath, "run", scriptPath]);
        } catch {}
      },
    });
  }

  try {
    const launchctlOut = execSync("launchctl list 2>/dev/null", { encoding: "utf-8" });
    const match = launchctlOut.split("\n").find((l: string) => l.includes(PLIST_NAME));
    if (match) {
      const pid = match.trim().split(/\s+/)[0];
      if (pid && pid !== "-") {
        checks.push({ label: "Daemon", status: "pass", detail: `running (PID: ${pid})` });
      } else {
        checks.push({
          label: "Daemon",
          status: "fail",
          detail: "registered but not running",
          fix: () => {
            try {
              execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null || true`, { stdio: "pipe" });
              execSync(`launchctl load "${PLIST_PATH}"`, { stdio: "pipe" });
            } catch {}
          },
        });
      }
    } else {
      checks.push({
        label: "Daemon",
        status: "fail",
        detail: "not registered with launchd",
        fix: isLaunchdInstalled()
          ? () => {
              try {
                execSync(`launchctl load "${PLIST_PATH}"`, { stdio: "pipe" });
              } catch {}
            }
          : undefined,
      });
    }
  } catch {
    checks.push({ label: "Daemon", status: "warn", detail: "could not check launchctl" });
  }

  try {
    const procs = execSync('ps aux | grep "executor/daemon.ts" | grep -v grep', { encoding: "utf-8" });
    const count = procs.trim().split("\n").filter(Boolean).length;
    if (count === 1) {
      checks.push({ label: "Process", status: "pass", detail: "single executor process" });
    } else if (count > 1) {
      checks.push({
        label: "Process",
        status: "fail",
        detail: `${count} executor processes (causes reconnect loop)`,
        fix: () => {
          try {
            const uid = execSync("id -u", { encoding: "utf-8" }).trim();
            execSync(`launchctl kickstart -k "gui/${uid}/${PLIST_NAME}" 2>/dev/null || true`, { stdio: "pipe" });
          } catch {}
        },
      });
    }
  } catch {
    checks.push({ label: "Process", status: "warn", detail: "no executor process detected" });
  }

  const logFile = join(EXECUTOR_DIR, "stdout.log");
  if (existsSync(logFile)) {
    try {
      const last50 = execSync(`tail -50 "${logFile}" 2>/dev/null`, { encoding: "utf-8" });
      if (last50.includes("Connected to central server")) {
        checks.push({ label: "Connection", status: "pass", detail: "connected to central" });
      } else {
        checks.push({ label: "Connection", status: "fail", detail: "no recent connection in logs" });
      }

      const disconnects = (last50.match(/Disconnected/g) || []).length;
      if (disconnects > 10) {
        checks.push({ label: "Stability", status: "fail", detail: `${disconnects} disconnects in last 50 lines` });
      } else {
        checks.push({ label: "Stability", status: "pass", detail: "connection stable" });
      }
    } catch {
      checks.push({ label: "Connection", status: "warn", detail: "could not read logs" });
    }
  } else {
    checks.push({ label: "Connection", status: "warn", detail: "no log file yet" });
  }

  try {
    const ghUser = execSync("gh api user --jq '.login' 2>/dev/null", { encoding: "utf-8" }).trim();
    checks.push(
      ghUser
        ? { label: "GitHub", status: "pass", detail: ghUser }
        : { label: "GitHub", status: "fail", detail: "gh CLI not authenticated" }
    );
  } catch {
    checks.push({ label: "GitHub", status: "fail", detail: "gh CLI not authenticated" });
  }

  try {
    const org = execSync("gh api orgs/crafter-station --jq '.login' 2>/dev/null", { encoding: "utf-8" }).trim();
    checks.push(
      org
        ? { label: "Org access", status: "pass", detail: "crafter-station" }
        : { label: "Org access", status: "fail", detail: "no access to crafter-station" }
    );
  } catch {
    checks.push({ label: "Org access", status: "fail", detail: "no access to crafter-station org" });
  }

  const tokenChecks = checkLinearTokens(execSync);
  checks.push(...tokenChecks);

  return checks;
}

const KAI_DIR = join(homedir(), ".kai");
const KAI_AGENTS_DIR = join(KAI_DIR, "agents");
const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";
const REFRESH_THRESHOLD_MS = 2 * 3600 * 1000;
const AGENT_NAMES = ["bolt", "sage", "orion", "nova", "kai", "pixel", "herald", "archon", "scribe"];

interface LinearConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

function loadLinearConfig(agent: string): LinearConfig | null {
  const path = join(KAI_AGENTS_DIR, agent, "linear.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function saveLinearConfig(agent: string, config: LinearConfig) {
  const path = join(KAI_AGENTS_DIR, agent, "linear.json");
  writeFileSync(path, JSON.stringify(config, null, 2));
}

function checkLinearTokens(_execSync: (cmd: string, opts: { encoding: string }) => string): DoctorCheck[] {
  const checks: DoctorCheck[] = [];

  if (!existsSync(KAI_AGENTS_DIR)) {
    checks.push({ label: "Linear Tokens", status: "warn", detail: "no agent credentials at ~/.kai/agents" });
    return checks;
  }

  const healthy: string[] = [];
  const expiring: string[] = [];
  const missing: string[] = [];
  const now = Date.now();

  for (const agent of AGENT_NAMES) {
    const config = loadLinearConfig(agent);
    if (!config) { missing.push(agent); continue; }
    const remaining = (config.expiresAt || 0) - now;
    if (remaining > REFRESH_THRESHOLD_MS) healthy.push(agent);
    else expiring.push(agent);
  }

  if (healthy.length > 0) {
    checks.push({ label: "Linear Tokens", status: "pass", detail: `${healthy.length} agent(s) valid` });
  }

  if (expiring.length > 0) {
    checks.push({
      label: "Token Expiry",
      status: "fail",
      detail: `expiring/expired: ${expiring.join(", ")}`,
      fix: () => { refreshLinearTokensSync(); },
    });
  }

  if (missing.length > 0) {
    checks.push({ label: "Token Missing", status: "warn", detail: `no config: ${missing.join(", ")}` });
  }

  const renderConfig = join(KAI_DIR, "render.json");
  checks.push(
    existsSync(renderConfig)
      ? { label: "Render Config", status: "pass", detail: renderConfig }
      : { label: "Render Config", status: "warn", detail: "missing — token sync to Render disabled" }
  );

  return checks;
}

async function refreshSingleToken(agent: string, config: LinearConfig): Promise<boolean> {
  if (!config.refreshToken) return false;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
  });

  try {
    const res = await fetch(LINEAR_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) return false;
    const data = await res.json() as Record<string, unknown>;
    config.accessToken = data.access_token as string;
    if (data.refresh_token) config.refreshToken = data.refresh_token as string;
    config.expiresAt = Date.now() + ((data.expires_in as number) || 86400) * 1000;
    saveLinearConfig(agent, config);
    return true;
  } catch {
    return false;
  }
}

async function syncTokensToRender(): Promise<boolean> {
  const renderPath = join(KAI_DIR, "render.json");
  if (!existsSync(renderPath)) return false;

  let renderCfg: { apiKey?: string; serviceId?: string };
  try {
    renderCfg = JSON.parse(readFileSync(renderPath, "utf-8"));
  } catch { return false; }

  const apiKey = renderCfg.apiKey;
  const serviceId = renderCfg.serviceId || "srv-d66hqa95pdvs73d1vqeg";
  if (!apiKey) return false;

  const pairs: string[] = [];
  for (const agent of AGENT_NAMES) {
    const config = loadLinearConfig(agent);
    if (config?.accessToken) pairs.push(`${agent}:${config.accessToken}`);
  }
  if (pairs.length === 0) return false;

  try {
    const res = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars/LINEAR_AGENT_TOKENS`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value: pairs.join(",") }),
    });
    return res.ok;
  } catch { return false; }
}

export async function refreshLinearTokensAsync(): Promise<{ refreshed: number; errors: number }> {
  const now = Date.now();
  let refreshed = 0;
  let errors = 0;

  for (const agent of AGENT_NAMES) {
    const config = loadLinearConfig(agent);
    if (!config) continue;
    const remaining = (config.expiresAt || 0) - now;
    if (remaining > REFRESH_THRESHOLD_MS) continue;
    const ok = await refreshSingleToken(agent, config);
    if (ok) refreshed++; else errors++;
  }

  if (refreshed > 0) await syncTokensToRender();
  return { refreshed, errors };
}

function refreshLinearTokensSync(): { success: boolean; output: string } {
  const now = Date.now();
  const expiring: string[] = [];

  for (const agent of AGENT_NAMES) {
    const config = loadLinearConfig(agent);
    if (!config) continue;
    const remaining = (config.expiresAt || 0) - now;
    if (remaining <= REFRESH_THRESHOLD_MS) expiring.push(agent);
  }

  if (expiring.length === 0) return { success: true, output: "all tokens valid" };

  const { execSync: exec } = require("node:child_process");
  const scriptPath = join(KAI_DIR, "scripts", "refresh-linear-tokens.py");
  if (existsSync(scriptPath)) {
    try {
      const output = exec(`python3 "${scriptPath}" refresh 2>&1`, { encoding: "utf-8" });
      return { success: true, output };
    } catch {}
  }

  return { success: false, output: `${expiring.length} token(s) need refresh but no script at ~/.kai/scripts/` };
}

export function refreshLinearTokens(): { success: boolean; output: string } {
  return refreshLinearTokensSync();
}

export function startDaemon() {
  const { execSync } = require("node:child_process");
  try {
    execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null || true`, { stdio: "pipe" });
    execSync(`launchctl load "${PLIST_PATH}"`, { stdio: "pipe" });
  } catch {}
}
